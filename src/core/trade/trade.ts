import type { Grid } from "../inventory/grid.ts";
import { totalValue } from "../inventory/item.ts";
import type { Catalog, Item, ItemDef } from "../inventory/item.ts";
import { autoPlace, detach } from "../inventory/operations.ts";
import { maxStack } from "../inventory/size.ts";
import { levelForXp } from "../pmc/pmc.ts";
import type { PlayerState } from "../state.ts";
import type {
  BarterCost,
  LoyaltyLevel,
  TradeResult,
  TraderDef,
  TraderOffer,
  TraderState,
  TradersState,
} from "./types.ts";

/** Reputação ganha a cada 100.000 ₽ negociados */
export const REPUTATION_PER_100K = 0.02;

/** Estado do jogador com o vendedor; cria o padrão no primeiro acesso */
export function traderState(
  traders: TradersState,
  def: TraderDef,
  now: number,
): TraderState {
  traders[def.id] ??= {
    reputation: 0,
    volume: 0,
    bought: {},
    restockAt: now + def.restockMs,
  };
  return traders[def.id];
}

/**
 * Repõe o estoque se passou da hora (zera as compras) e marca a próxima
 * reposição no mesmo ritmo, mesmo que várias tenham passado com o jogo
 * fechado. Devolve se repôs.
 */
export function restock(def: TraderDef, state: TraderState, now: number) {
  if (now < state.restockAt) return false;
  const periods = Math.floor((now - state.restockAt) / def.restockMs) + 1;
  state.restockAt += periods * def.restockMs;
  state.bought = {};
  return true;
}

/** Compras restantes da oferta até a reposição */
export function stockLeft(offer: TraderOffer, state: TraderState): number {
  return Math.max(0, offer.stock - (state.bought[offer.id] ?? 0));
}

/** Maior nível de lealdade cujos requisitos o jogador cumpre */
export function loyaltyLevel(
  def: TraderDef,
  state: TraderState,
  pmcXp: number,
): LoyaltyLevel {
  const pmcLevel = levelForXp(pmcXp);
  let current = def.levels[0];
  for (const level of def.levels) {
    if (
      pmcLevel >= level.minPmcLevel &&
      state.reputation >= level.minReputation &&
      state.volume >= level.minVolume
    ) {
      current = level;
    }
  }
  return current;
}

/** Próximo nível de lealdade, ou `null` no máximo */
export function nextLevel(
  def: TraderDef,
  level: LoyaltyLevel,
): LoyaltyLevel | null {
  return def.levels.find((l) => l.level === level.level + 1) ?? null;
}

/** Preço em dinheiro de uma oferta (`null` se for troca) */
export function offerPrice(
  def: TraderDef,
  offer: TraderOffer,
  level: LoyaltyLevel,
  catalog: Catalog,
): { currency: string; amount: number } | null {
  if (offer.barter) return null;
  if (offer.price !== undefined) {
    return { currency: offer.currency ?? def.currency, amount: offer.price };
  }
  const rub =
    catalog.get(offer.item).basePrice * (offer.count ?? 1) * level.buyMarkup;
  const rate = catalog.get(def.currency).basePrice;
  return { currency: def.currency, amount: Math.max(1, Math.ceil(rub / rate)) };
}

/** Todos os itens do estoque, incluindo os de dentro de contêineres */
export function stashItems(stash: Grid): Item[] {
  const all: Item[] = [];
  const visit = (grid: Grid) => {
    for (const item of grid.items()) {
      all.push(item);
      for (const inner of item.grids) visit(inner);
    }
  };
  visit(stash);
  return all;
}

/** Quantidade de um item no estoque (somando pilhas e contêineres) */
export function countInStash(stash: Grid, defId: string): number {
  return stashItems(stash)
    .filter((i) => i.def.id === defId)
    .reduce((sum, i) => sum + i.count, 0);
}

/** Item ocupado no carregamento de carregador em andamento */
function inUse(player: PlayerState, item: Item): boolean {
  const job = player.loader.job;
  return (
    job !== null &&
    (job.magazine === item || (job.kind === "load" && job.ammo === item))
  );
}

/** Itens do estoque que podem pagar `defId` (sem conteúdo, fora de uso) */
function payable(player: PlayerState, defId: string): Item[] {
  return stashItems(player.inventory.stash).filter(
    (i) =>
      i.def.id === defId &&
      !inUse(player, i) &&
      i.grids.every((g) => g.items().length === 0),
  );
}

function available(player: PlayerState, defId: string): number {
  return payable(player, defId).reduce((sum, i) => sum + i.count, 0);
}

/** Tira `count` unidades do estoque (já conferido que há o bastante) */
function take(player: PlayerState, defId: string, count: number): void {
  let left = count;
  for (const item of payable(player, defId)) {
    if (left === 0) break;
    const used = Math.min(item.count, left);
    item.count -= used;
    left -= used;
    if (item.count === 0) detach(item);
  }
}

/**
 * Guarda todos os itens no estoque ou nenhum: se algum não couber, desfaz
 * as pilhas completadas e o que já foi colocado.
 */
export function storeAll(items: readonly Item[], stash: Grid): boolean {
  const counts = new Map(stash.items().map((i) => [i, i.count]));
  const placed: Item[] = [];
  for (const item of items) {
    const ok = autoPlace(item, [stash]);
    if (item.location) placed.push(item);
    if (!ok) {
      for (const [stack, count] of counts) stack.count = count;
      for (const p of placed) detach(p);
      return false;
    }
  }
  return true;
}

/** Cria a quantia em pilhas de no máximo `maxStack` */
function createMoney(player: PlayerState, def: ItemDef, amount: number) {
  const stacks: Item[] = [];
  for (let left = amount; left > 0;) {
    const n = Math.min(left, maxStack(def));
    stacks.push(player.factory.create(def.id, n));
    left -= n;
  }
  return stacks;
}

/** Soma ao volume negociado e à reputação */
function addVolume(state: TraderState, rub: number): void {
  state.volume += Math.round(rub);
  state.reputation += (rub / 100_000) * REPUTATION_PER_100K;
}

const barterValue = (cost: readonly BarterCost[], catalog: Catalog) =>
  cost.reduce((sum, c) => sum + catalog.get(c.item).basePrice * c.count, 0);

/**
 * Compra uma oferta: confere nível, estoque, pagamento e espaço; guarda o
 * item no estoque e só então paga (dinheiro ou itens da troca, tirados do
 * estoque). Soma o valor ao volume e à reputação.
 */
export function buy(
  player: PlayerState,
  def: TraderDef,
  offerId: string,
  now: number,
): TradeResult {
  const { catalog } = player.factory;
  const state = traderState(player.traders, def, now);
  restock(def, state, now);
  const offer = def.offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, reason: "Oferta não existe" };
  const level = loyaltyLevel(def, state, player.pmc.xp);
  if (level.level < offer.level) {
    return { ok: false, reason: `Exige lealdade nível ${offer.level}` };
  }
  if (stockLeft(offer, state) === 0) return { ok: false, reason: "Esgotado" };
  const price = offerPrice(def, offer, level, catalog);
  const cost: readonly BarterCost[] = price
    ? [{ item: price.currency, count: price.amount }]
    : offer.barter!;
  if (cost.some((c) => available(player, c.item) < c.count)) {
    return {
      ok: false,
      reason: price ? "Dinheiro insuficiente" : "Faltam itens para a troca",
    };
  }
  const count = offer.count ?? 1;
  if (
    !storeAll(
      [player.factory.create(offer.item, count)],
      player.inventory.stash,
    )
  ) {
    return { ok: false, reason: "Sem espaço no estoque" };
  }
  for (const c of cost) take(player, c.item, c.count);
  state.bought[offer.id] = (state.bought[offer.id] ?? 0) + 1;
  addVolume(state, barterValue(cost, catalog));
  return { ok: true, amount: count };
}

/**
 * Quanto o vendedor paga pelo item, na moeda dele: `totalValue × sellRate
 * × multiplicador da categoria`, arredondado para baixo. Devolve o motivo
 * quando ele não compra.
 */
export function sellPrice(
  def: TraderDef,
  item: Item,
  level: LoyaltyLevel,
  catalog: Catalog,
): TradeResult {
  const factor = def.buys[item.def.category];
  if (item.def.category === "money" || factor === undefined) {
    return { ok: false, reason: "Não compra este tipo de item" };
  }
  if (item.grids.some((g) => g.items().length > 0)) {
    return { ok: false, reason: "Esvazie antes de vender" };
  }
  const rate = catalog.get(def.currency).basePrice;
  const amount = Math.floor(
    (totalValue(item) * level.sellRate * factor) / rate,
  );
  if (amount < 1) return { ok: false, reason: "Não vale nada" };
  return { ok: true, amount };
}

/**
 * Vende um item do estoque: recebe o dinheiro no estoque (no espaço que o
 * item liberou, se precisar). Se o dinheiro não couber, nada muda.
 */
export function sell(
  player: PlayerState,
  def: TraderDef,
  item: Item,
  now: number,
): TradeResult {
  const { catalog } = player.factory;
  const { stash } = player.inventory;
  if (!stashItems(stash).includes(item)) {
    return { ok: false, reason: "O item precisa estar no estoque" };
  }
  if (inUse(player, item)) {
    return { ok: false, reason: "Item em uso no carregamento" };
  }
  const state = traderState(player.traders, def, now);
  const level = loyaltyLevel(def, state, player.pmc.xp);
  const price = sellPrice(def, item, level, catalog);
  if (!price.ok) return price;
  const loc = item.location as Extract<Item["location"], { kind: "grid" }>;
  detach(item);
  const money = createMoney(player, catalog.get(def.currency), price.amount);
  if (!storeAll(money, stash)) {
    loc.grid.place(item, loc.x, loc.y, loc.rotated);
    return { ok: false, reason: "Sem espaço no estoque para o dinheiro" };
  }
  addVolume(state, price.amount * catalog.get(def.currency).basePrice);
  return price;
}
