import {
  buyPrice,
  fleaBuy,
  fleaUnlocked,
  lotSize,
  tradeable,
} from "../flea/flea.ts";
import { durabilityRatio } from "../inventory/durability.ts";
import { SLOT_NAMES } from "../inventory/equipment.ts";
import type { Equipment } from "../inventory/equipment.ts";
import type { Grid } from "../inventory/grid.ts";
import type { GridLocation, Item } from "../inventory/item.ts";
import {
  attachMagazine,
  canLoad,
  canLoadWeapon,
  isMagazine,
  isWeapon,
  loadRounds,
  loadWeapon,
  loadedRounds,
  removeMagazine,
  sameCaliber,
} from "../inventory/magazine.ts";
import { autoPlace, detach, splitStack } from "../inventory/operations.ts";
import type { PlayerState } from "../state.ts";
import {
  buy,
  loyaltyLevel,
  offerPrice,
  questUnlocked,
  restock,
  stashItems,
  stockLeft,
  traderState,
} from "../trade/trade.ts";
import type {
  ApplyReport,
  Loadout,
  LoadoutItem,
  PurchaseOption,
  ShopContext,
} from "./types.ts";

/** Loadouts guardados ao mesmo tempo */
export const MAX_LOADOUTS = 5;
/** Tamanho máximo do nome de um loadout */
export const MAX_LOADOUT_NAME = 24;

/** Itens nas grades de carga (bolsos, colete tático, mochila), com o conteúdo */
export function carriedItems(equipment: Equipment): Item[] {
  const all: Item[] = [];
  const visit = (grid: Grid) => {
    for (const item of grid.items()) {
      all.push(item);
      for (const inner of item.grids) visit(inner);
    }
  };
  for (const grid of equipment.carryGrids()) visit(grid);
  return all;
}

/** Soma por tipo, na ordem em que cada tipo aparece */
function sumByDef(entries: readonly LoadoutItem[]): LoadoutItem[] {
  const counts = new Map<string, number>();
  for (const { item, count } of entries) {
    counts.set(item, (counts.get(item) ?? 0) + count);
  }
  return [...counts].map(([item, count]) => ({ item, count }));
}

/** Foto do equipamento atual como loadout */
export function snapshotLoadout(player: PlayerState, name: string): Loadout {
  const { equipment } = player.inventory;
  const loadout: Loadout = { name, slots: {}, magazines: {}, carried: [] };
  for (const slot of SLOT_NAMES) {
    const item = equipment.get(slot);
    if (!item) continue;
    loadout.slots[slot] = item.def.id;
    if (item.magazine) loadout.magazines[slot] = item.magazine.def.id;
  }
  loadout.carried = sumByDef(
    carriedItems(equipment).map((i) => ({ item: i.def.id, count: i.count })),
  );
  return loadout;
}

/** Tudo que o loadout pede: slots, carregadores e itens carregados */
export function requiredItems(loadout: Loadout): LoadoutItem[] {
  return sumByDef([
    ...Object.values(loadout.slots).map((item) => ({ item, count: 1 })),
    ...Object.values(loadout.magazines).map((item) => ({ item, count: 1 })),
    ...loadout.carried,
  ]);
}

/**
 * Itens do estoque que podem ir para o equipamento: carregadores mais cheios
 * e armaduras mais inteiras antes
 */
function stashCandidates(player: PlayerState, defId: string): Item[] {
  return stashItems(player.inventory.stash)
    .filter((i) => i.def.id === defId)
    .sort(
      (a, b) =>
        rounds(b) - rounds(a) || durabilityRatio(b) - durabilityRatio(a),
    );
}

const rounds = (item: Item) => (isMagazine(item) ? loadedRounds(item) : 0);

/** Unidades do tipo que o jogador já tem no equipamento e no estoque */
function owned(player: PlayerState, defId: string): number {
  const { equipment } = player.inventory;
  const worn = equipment.equipped();
  const items = [
    ...worn,
    ...worn.flatMap((i) => i.magazine ?? []),
    ...carriedItems(equipment),
    ...stashCandidates(player, defId),
  ];
  return items
    .filter((i) => i.def.id === defId)
    .reduce((sum, i) => sum + i.count, 0);
}

/** O que falta (nem no equipamento nem no estoque) para montar o loadout */
export function missingItems(
  player: PlayerState,
  loadout: Loadout,
): LoadoutItem[] {
  return requiredItems(loadout)
    .map(({ item, count }) => ({ item, count: count - owned(player, item) }))
    .filter((m) => m.count > 0);
}

/** Volta um item solto para a posição de onde saiu */
function putBack(item: Item, loc: GridLocation): void {
  loc.grid.place(item, loc.x, loc.y, loc.rotated);
}

/**
 * Monta o loadout com o que há no estoque. Slots diferentes trocam de item
 * (o antigo vai para o estoque); slots fora do loadout e itens a mais nas
 * grades ficam como estão. Os itens carregados vão para bolsos, colete
 * tático e mochila. Nada é comprado aqui.
 */
export function applyLoadout(
  player: PlayerState,
  loadout: Loadout,
): ApplyReport {
  const { stash, equipment } = player.inventory;
  const missing: LoadoutItem[] = [];
  const noSpace: LoadoutItem[] = [];

  for (const slot of SLOT_NAMES) {
    const want = loadout.slots[slot];
    const current = equipment.get(slot);
    if (!want || current?.def.id === want) continue;
    const [candidate] = stashCandidates(player, want);
    if (!candidate) {
      missing.push({ item: want, count: 1 });
      continue;
    }
    const from = candidate.location as GridLocation;
    detach(candidate);
    if (current) {
      equipment.unequip(slot);
      if (!autoPlace(current, [stash])) {
        equipment.equip(slot, current);
        putBack(candidate, from);
        noSpace.push({ item: want, count: 1 });
        continue;
      }
    }
    equipment.equip(slot, candidate);
  }

  for (const slot of SLOT_NAMES) {
    const want = loadout.magazines[slot];
    const weapon = equipment.get(slot);
    if (!want || !weapon || weapon.magazine?.def.id === want) continue;
    const [candidate] = stashCandidates(player, want);
    if (!candidate) {
      missing.push({ item: want, count: 1 });
      continue;
    }
    if (weapon.magazine && !removeMagazine(weapon, [stash])) {
      noSpace.push({ item: want, count: 1 });
      continue;
    }
    attachMagazine(weapon, candidate);
  }

  const carry = equipment.carryGrids();
  for (const { item: defId, count } of loadout.carried) {
    let need =
      count -
      carriedItems(equipment)
        .filter((i) => i.def.id === defId)
        .reduce((sum, i) => sum + i.count, 0);
    let full = false;
    for (const candidate of stashCandidates(player, defId)) {
      if (need <= 0) break;
      if (candidate.count > need) {
        const part = splitStack(candidate, need, player.factory);
        if (autoPlace(part, carry)) {
          need = 0;
          continue;
        }
        // o que não coube volta para a pilha de origem
        need = part.count;
        candidate.count += part.count;
        full = true;
        break;
      }
      const from = candidate.location as GridLocation;
      const before = candidate.count;
      detach(candidate);
      if (autoPlace(candidate, carry)) {
        need -= before;
        continue;
      }
      // parte pode ter completado pilhas; o resto volta para o lugar
      need -= before - candidate.count;
      putBack(candidate, from);
      full = true;
      break;
    }
    if (need > 0) (full ? noSpace : missing).push({ item: defId, count: need });
  }
  return { missing: sumByDef(missing), noSpace: sumByDef(noSpace) };
}

/**
 * Onde dá para comprar o item agora, do mais barato por unidade: ofertas em
 * dinheiro dos vendedores (nível, quest e estoque ok) e o mercado.
 */
export function purchaseOptions(
  player: PlayerState,
  ctx: ShopContext,
  defId: string,
  now: number,
): PurchaseOption[] {
  const { catalog } = player.factory;
  const options: PurchaseOption[] = [];
  for (const trader of ctx.traders) {
    const state = traderState(player.traders, trader, now);
    restock(trader, state, now);
    const level = loyaltyLevel(trader, state, player.pmc.xp);
    for (const offer of trader.offers) {
      if (offer.item !== defId || offer.level > level.level) continue;
      if (!questUnlocked(player, offer) || stockLeft(offer, state) === 0) {
        continue;
      }
      const price = offerPrice(trader, offer, level, catalog);
      if (!price) continue;
      options.push({
        source: { kind: "trader", trader: trader.id, offer: offer.id },
        lot: offer.count ?? 1,
        rub: price.amount * catalog.get(price.currency).basePrice,
      });
    }
  }
  if (
    catalog.has(defId) &&
    fleaUnlocked(player, ctx.flea) &&
    tradeable(catalog.get(defId), ctx.flea)
  ) {
    const def = catalog.get(defId);
    options.push({
      source: { kind: "flea" },
      lot: lotSize(def),
      rub:
        buyPrice(player.flea, ctx.flea, def, catalog, now) *
        catalog.get(ctx.flea.currency).basePrice,
    });
  }
  return options.sort((a, b) => a.rub / a.lot - b.rub / b.lot);
}

/** Custo estimado (rublos) do que falta e o que não está à venda */
export function estimateMissing(
  player: PlayerState,
  loadout: Loadout,
  ctx: ShopContext,
  now: number,
): { rub: number; unavailable: string[] } {
  let rub = 0;
  const unavailable: string[] = [];
  for (const { item, count } of missingItems(player, loadout)) {
    const [best] = purchaseOptions(player, ctx, item, now);
    if (best) rub += Math.ceil(count / best.lot) * best.rub;
    else unavailable.push(item);
  }
  return { rub, unavailable };
}

/**
 * Compra o que falta, sempre na opção mais barata que der certo, até cobrir
 * a quantidade. Devolve o que comprou, o que não conseguiu e o gasto.
 */
export function buyMissing(
  player: PlayerState,
  loadout: Loadout,
  ctx: ShopContext,
  now: number,
): { bought: LoadoutItem[]; failed: LoadoutItem[]; spent: number } {
  const bought: LoadoutItem[] = [];
  const failed: LoadoutItem[] = [];
  let spent = 0;
  for (const { item, count } of missingItems(player, loadout)) {
    let left = count;
    while (left > 0) {
      const options = purchaseOptions(player, ctx, item, now);
      const done = options.find((option) => {
        const { source } = option;
        const result =
          source.kind === "flea"
            ? fleaBuy(player, ctx.flea, item, now)
            : buy(
                player,
                ctx.traders.find((t) => t.id === source.trader)!,
                source.offer,
                now,
              );
        if (!result.ok) return false;
        left -= result.amount;
        spent += option.rub;
        bought.push({ item, count: result.amount });
        return true;
      });
      if (!done) {
        failed.push({ item, count: left });
        break;
      }
    }
  }
  return { bought: sumByDef(bought), failed, spent };
}

/** Reequipar com um clique: compra o que falta e monta o loadout */
export function quickEquip(
  player: PlayerState,
  loadout: Loadout,
  ctx: ShopContext,
  now: number,
) {
  const purchase = buyMissing(player, loadout, ctx, now);
  return { purchase, apply: applyLoadout(player, loadout) };
}

/** Guarda o equipamento atual como um loadout novo (até `MAX_LOADOUTS`) */
export function saveLoadout(player: PlayerState, name: string): boolean {
  if (player.loadouts.length >= MAX_LOADOUTS) return false;
  player.loadouts.push(snapshotLoadout(player, name));
  return true;
}

/** Troca o loadout pelo equipamento atual, mantendo o nome */
export function replaceLoadout(player: PlayerState, index: number): void {
  const old = player.loadouts[index];
  if (old) player.loadouts[index] = snapshotLoadout(player, old.name);
}

export function deleteLoadout(player: PlayerState, index: number): void {
  player.loadouts.splice(index, 1);
}

/**
 * Renomeia o loadout. O nome não pode ser vazio, passar de
 * `MAX_LOADOUT_NAME` nem repetir o de outro loadout. As raids automáticas que
 * usavam o nome antigo passam a usar o novo.
 */
export function renameLoadout(
  player: PlayerState,
  index: number,
  name: string,
): { ok: true } | { ok: false; reason: string } {
  const loadout = player.loadouts[index];
  if (!loadout) return { ok: false, reason: "Loadout não existe" };
  const clean = name.trim();
  if (!clean) return { ok: false, reason: "O nome não pode ficar vazio" };
  if (clean.length > MAX_LOADOUT_NAME) {
    return {
      ok: false,
      reason: `Nome muito longo (máx. ${MAX_LOADOUT_NAME} letras)`,
    };
  }
  if (player.loadouts.some((l, i) => i !== index && l.name === clean)) {
    return { ok: false, reason: "Já existe um loadout com esse nome" };
  }
  if (player.auto.rules.loadout === loadout.name) {
    player.auto.rules.loadout = clean;
  }
  loadout.name = clean;
  return { ok: true };
}

/**
 * Carrega na hora as armas vestidas (câmara e carregador ou tubo) e os
 * carregadores levados no equipamento com munição do calibre que está no
 * estoque. Usa primeiro os tipos de munição da carga do loadout e depois as
 * pilhas maiores. Devolve quantos cartuchos entraram.
 */
export function loadMagazines(player: PlayerState, loadout?: Loadout): number {
  const { stash, equipment } = player.inventory;
  const preferred = (loadout?.carried ?? []).map((c) => c.item);
  const rank = (i: Item) => {
    const p = preferred.indexOf(i.def.id);
    return p < 0 ? preferred.length : p;
  };
  const ammoFor = (target: Item) =>
    stashItems(stash)
      .filter(
        (i) => i.def.category === "ammo" && sameCaliber(target.def, i.def),
      )
      .sort((a, b) => rank(a) - rank(b) || b.count - a.count);
  let loaded = 0;
  for (const weapon of equipment.equipped().filter(isWeapon)) {
    for (const ammo of ammoFor(weapon)) {
      if (!canLoadWeapon(weapon, ammo)) continue;
      loaded += loadWeapon(weapon, ammo);
    }
  }
  for (const mag of carriedItems(equipment).filter(isMagazine)) {
    for (const ammo of ammoFor(mag)) {
      if (!canLoad(mag, ammo)) continue;
      loaded += loadRounds(mag, ammo);
    }
  }
  return loaded;
}
