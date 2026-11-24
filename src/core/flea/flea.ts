import type { Catalog, Item, ItemDef } from "../inventory/item.ts";
import { detach } from "../inventory/operations.ts";
import { maxStack } from "../inventory/size.ts";
import { levelForXp } from "../pmc/pmc.ts";
import { Rng } from "../rng.ts";
import type { PlayerState } from "../state.ts";
import {
  available,
  createStacks,
  inUse,
  stashItems,
  storeAll,
  take,
} from "../trade/trade.ts";
import type { TradeResult } from "../trade/types.ts";
import type {
  FleaConfig,
  FleaListing,
  FleaResult,
  FleaState,
} from "./types.ts";

/** Mercado novo: sem anúncios nem pressão; a seed vem do momento */
export function createFleaState(now: number): FleaState {
  return {
    seed: mix(Math.floor(now)),
    nextListing: 1,
    listings: [],
    results: [],
    pressure: {},
    lastCheck: now,
    stats: { sold: 0, earned: 0, fees: 0, bought: 0, spent: 0 },
  };
}

/** Mistura inteiros em uma seed de 32 bits (determinística) */
export function mix(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    h = Math.imul(h ^ (v >>> 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

/** Hash de um texto (id de item) para entrar na seed */
export function hashText(text: string): number {
  return mix(...Array.from(text, (c) => c.charCodeAt(0)));
}

const fail = (reason: string): TradeResult => ({ ok: false, reason });

export function fleaUnlocked(player: PlayerState, config: FleaConfig) {
  return levelForXp(player.pmc.xp) >= config.minPmcLevel;
}

/** Itens que existem no mercado: fora dinheiro, sem valor e banidos */
export function tradeable(def: ItemDef, config: FleaConfig): boolean {
  return (
    def.category !== "money" &&
    def.basePrice > 0 &&
    !config.banned.includes(def.id)
  );
}

/** Itens à venda no mercado, por nome */
export function marketDefs(catalog: Catalog, config: FleaConfig): ItemDef[] {
  return catalog
    .all()
    .filter((d) => tradeable(d, config))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Tendência do preço no momento: um valor sorteado por período (seed, item,
 * período) em `1 ± amplitude`, em linha reta entre um período e o próximo.
 */
export function trendFactor(
  config: FleaConfig,
  seed: number,
  defId: string,
  now: number,
): number {
  const period = Math.floor(now / config.trendMs);
  const t = now / config.trendMs - period;
  const at = (p: number) => {
    const roll = new Rng(mix(seed, hashText(defId), p)).next();
    return 1 + config.trendAmplitude * (2 * roll - 1);
  };
  return at(period) * (1 - t) + at(period + 1) * t;
}

/** Pressão do item no momento (cai pela metade a cada meia-vida) */
export function pressureAt(
  state: FleaState,
  config: FleaConfig,
  defId: string,
  now: number,
): number {
  const entry = state.pressure[defId];
  if (!entry) return 0;
  const elapsed = Math.max(0, now - entry.at);
  return entry.value * 0.5 ** (elapsed / config.pressureHalfLifeMs);
}

/** Soma pressão: `units > 0` = oferta (preço cai), `< 0` = demanda */
function addPressure(
  state: FleaState,
  config: FleaConfig,
  def: ItemDef,
  units: number,
  now: number,
): void {
  const value =
    pressureAt(state, config, def.id, now) +
    (units / maxStack(def)) * config.pressurePerStack;
  // Um sorteio antigo (calculado depois) não volta o relógio da pressão
  const at = Math.max(now, state.pressure[def.id]?.at ?? now);
  state.pressure[def.id] = { value, at };
}

/**
 * Preço de mercado por unidade, em rublos: `basePrice × tendência ×
 * (1 − pressão)`, com a pressão limitada a `±pressureLimit`. Mínimo 1.
 */
export function marketPrice(
  state: FleaState,
  config: FleaConfig,
  def: ItemDef,
  now: number,
): number {
  const limit = config.pressureLimit;
  const pressure = Math.min(
    limit,
    Math.max(-limit, pressureAt(state, config, def.id, now)),
  );
  const trend = trendFactor(config, state.seed, def.id, now);
  return Math.max(1, Math.round(def.basePrice * trend * (1 - pressure)));
}

/**
 * Direção da tendência na última hora: −1, 0 ou 1. Só a tendência do
 * mercado (a pressão do passado não fica guardada).
 */
export function priceTrend(
  state: FleaState,
  config: FleaConfig,
  def: ItemDef,
  now: number,
): number {
  const at = (t: number) =>
    Math.round(def.basePrice * trendFactor(config, state.seed, def.id, t));
  return Math.sign(at(now) - at(now - config.trendMs));
}

/** Uma compra no mercado traz uma pilha cheia */
export function lotSize(def: ItemDef): number {
  return maxStack(def);
}

/** Preço de uma pilha cheia na moeda do mercado */
export function buyPrice(
  state: FleaState,
  config: FleaConfig,
  def: ItemDef,
  catalog: Catalog,
  now: number,
): number {
  const rub =
    marketPrice(state, config, def, now) * lotSize(def) * config.buyMarkup;
  return Math.max(1, Math.ceil(rub / catalog.get(config.currency).basePrice));
}

/**
 * Compra uma pilha cheia de outros jogadores. O item chega sem a marca de
 * "encontrado na raid", e a compra aumenta a demanda (o preço sobe).
 */
export function fleaBuy(
  player: PlayerState,
  config: FleaConfig,
  defId: string,
  now: number,
): TradeResult {
  if (!fleaUnlocked(player, config)) {
    return fail(`O mercado libera no nível ${config.minPmcLevel}`);
  }
  const { catalog } = player.factory;
  if (!catalog.has(defId) || !tradeable(catalog.get(defId), config)) {
    return fail("Item fora do mercado");
  }
  const def = catalog.get(defId);
  const price = buyPrice(player.flea, config, def, catalog, now);
  if (available(player, config.currency) < price) {
    return fail("Dinheiro insuficiente");
  }
  const count = lotSize(def);
  if (!storeAll(createStacks(player, def, count), player.inventory.stash)) {
    return fail("Sem espaço no estoque");
  }
  take(player, config.currency, price);
  addPressure(player.flea, config, def, -count, now);
  player.flea.stats.bought += 1;
  player.flea.stats.spent += price;
  return { ok: true, amount: count };
}

/**
 * Valor de mercado do item para anunciar (preço × quantidade), ou o motivo
 * de não poder anunciar.
 */
export function listingValue(
  player: PlayerState,
  config: FleaConfig,
  item: Item,
  now: number,
): TradeResult {
  if (!fleaUnlocked(player, config)) {
    return fail(`O mercado libera no nível ${config.minPmcLevel}`);
  }
  if (!stashItems(player.inventory.stash).includes(item)) {
    return fail("O item precisa estar no estoque");
  }
  if (inUse(player, item)) return fail("Item em uso no carregamento");
  if (!tradeable(item.def, config)) {
    return fail("Não pode ser vendido no mercado");
  }
  if (
    item.grids.some((g) => g.items().length > 0) ||
    (item.rounds?.length ?? 0) > 0 ||
    item.magazine ||
    item.chamber
  ) {
    return fail("Esvazie antes de anunciar");
  }
  if (config.firCategories.includes(item.def.category) && !item.fir) {
    return fail("Só itens encontrados na raid");
  }
  const price = marketPrice(player.flea, config, item.def, now);
  return { ok: true, amount: price * item.count };
}

/** Taxa do anúncio: cresce com o quadrado da razão preço/valor */
export function listingFee(
  config: FleaConfig,
  value: number,
  price: number,
): number {
  return Math.max(1, Math.ceil(value * config.feeRate * (price / value) ** 2));
}

/**
 * Chance de venda a cada sorteio: `saleChance × ((máx − razão)/(máx − 1))²`,
 * limitada a 1; zero da razão máxima para cima.
 */
export function saleChance(config: FleaConfig, ratio: number): number {
  if (ratio >= config.maxRatio) return 0;
  const k = (config.maxRatio - ratio) / (config.maxRatio - 1);
  return Math.min(1, config.saleChance * k * k);
}

/** Tempo médio até vender (`Infinity` se nunca vende) */
export function expectedSaleMs(config: FleaConfig, ratio: number): number {
  const p = saleChance(config, ratio);
  return p === 0 ? Infinity : config.checkMs / p;
}

/**
 * Anuncia uma pilha do estoque pelo preço pedido: paga a taxa (do estoque) e
 * o item sai do estoque até vender, vencer ou ser cancelado.
 */
export function listItem(
  player: PlayerState,
  config: FleaConfig,
  item: Item,
  price: number,
  now: number,
): TradeResult {
  if (!Number.isInteger(price) || price < 1) return fail("Preço inválido");
  const value = listingValue(player, config, item, now);
  if (!value.ok) return value;
  const { flea } = player;
  if (flea.listings.length >= config.slots) {
    return fail("Todos os anúncios estão ocupados");
  }
  const fee = listingFee(config, value.amount, price);
  if (available(player, config.currency) < fee) {
    return fail("Dinheiro insuficiente para a taxa");
  }
  take(player, config.currency, fee);
  detach(item);
  flea.listings.push({
    id: flea.nextListing++,
    item,
    price,
    listedAt: now,
    expiresAt: now + config.listingMs,
  });
  flea.stats.fees += fee;
  return { ok: true, amount: fee };
}

/** Cancela um anúncio (a taxa não volta); o item volta ao estoque */
export function cancelListing(player: PlayerState, id: number): TradeResult {
  const { flea } = player;
  const listing = flea.listings.find((l) => l.id === id);
  if (!listing) return fail("Anúncio não existe");
  if (!storeAll([listing.item], player.inventory.stash)) {
    return fail("Sem espaço no estoque");
  }
  flea.listings = flea.listings.filter((l) => l !== listing);
  return { ok: true, amount: listing.item.count };
}

/** Retira o dinheiro de uma venda ou o item de um anúncio vencido */
export function collectResult(
  player: PlayerState,
  config: FleaConfig,
  id: number,
): TradeResult {
  const { flea } = player;
  const result = flea.results.find((r) => r.id === id);
  if (!result) return fail("Nada para retirar");
  const { catalog } = player.factory;
  const items =
    result.kind === "sold"
      ? createStacks(player, catalog.get(config.currency), result.price)
      : [result.item];
  if (!storeAll(items, player.inventory.stash)) {
    return fail("Sem espaço no estoque");
  }
  flea.results = flea.results.filter((r) => r !== result);
  return {
    ok: true,
    amount: result.kind === "sold" ? result.price : result.item.count,
  };
}

function expire(flea: FleaState, listing: FleaListing): FleaResult {
  flea.listings = flea.listings.filter((l) => l !== listing);
  const result: FleaResult = {
    kind: "expired",
    id: listing.id,
    item: listing.item,
  };
  flea.results.push(result);
  return result;
}

/**
 * Sorteia as vendas dos anúncios desde o último cálculo, um sorteio a cada
 * `checkMs` (alinhado ao relógio, então o tempo com o jogo fechado conta).
 * Cada sorteio usa o preço de mercado daquele momento e uma seed própria
 * (seed do mercado, anúncio, sorteio). Anúncios vencidos devolvem o item.
 * Devolve os resultados novos.
 */
export function fleaTick(
  player: PlayerState,
  config: FleaConfig,
  now: number,
): FleaResult[] {
  const { flea } = player;
  const created: FleaResult[] = [];
  if (flea.listings.length > 0) {
    const oldest = Math.min(...flea.listings.map((l) => l.listedAt));
    const first =
      Math.max(
        Math.floor(flea.lastCheck / config.checkMs),
        Math.floor(oldest / config.checkMs),
      ) + 1;
    const last = Math.floor(now / config.checkMs);
    for (let k = first; k <= last && flea.listings.length > 0; k++) {
      const t = k * config.checkMs;
      for (const listing of flea.listings) {
        if (t <= listing.listedAt) continue;
        if (t > listing.expiresAt) {
          created.push(expire(flea, listing));
          continue;
        }
        const { item } = listing;
        const value = marketPrice(flea, config, item.def, t) * item.count;
        const p = saleChance(config, listing.price / value);
        if (!new Rng(mix(flea.seed, listing.id, k)).chance(p)) continue;
        flea.listings = flea.listings.filter((l) => l !== listing);
        const sold: FleaResult = {
          kind: "sold",
          id: listing.id,
          def: item.def.id,
          count: item.count,
          price: listing.price,
        };
        flea.results.push(sold);
        created.push(sold);
        addPressure(flea, config, item.def, item.count, t);
        flea.stats.sold += 1;
        flea.stats.earned += listing.price;
      }
    }
  }
  for (const listing of flea.listings) {
    if (listing.expiresAt <= now) created.push(expire(flea, listing));
  }
  flea.lastCheck = Math.max(flea.lastCheck, now);
  return created;
}
