import type { Grid } from "./grid.ts";
import type { Item, ItemDef, ItemFactory } from "./item.ts";
import { autoPlace, detach } from "./operations.ts";
import { maxStack } from "./size.ts";

export function isMagazine(item: Item): boolean {
  return item.def.category === "magazine";
}

export function isWeapon(item: Item): boolean {
  return item.def.category === "weapon";
}

/** Arma com tubo interno (escopeta): carregada direto, sem carregador */
export function hasInternalMagazine(item: Item): boolean {
  return isWeapon(item) && capacity(item) > 0;
}

/** Item que guarda cartuchos: carregador ou arma com tubo interno */
export function isFeed(item: Item): boolean {
  return isMagazine(item) || hasInternalMagazine(item);
}

/** De onde a arma puxa os cartuchos: o tubo ou o carregador encaixado */
export function feedOf(weapon: Item): Item | null {
  if (hasInternalMagazine(weapon)) return weapon;
  return weapon.magazine ?? null;
}

/** Capacidade do carregador (ou do tubo), em cartuchos */
export function capacity(item: Item): number {
  return item.def.stats?.capacity ?? 0;
}

/** Cartuchos carregados */
export function loadedRounds(item: Item): number {
  return (item.rounds ?? []).reduce((n, r) => n + r.count, 0);
}

/** Espaço livre no carregador */
export function freeRounds(item: Item): number {
  return Math.max(0, capacity(item) - loadedRounds(item));
}

/** Se os dois itens usam o mesmo calibre */
export function sameCaliber(a: ItemDef, b: ItemDef): boolean {
  const caliber = a.stats?.caliber;
  return caliber !== undefined && caliber === b.stats?.caliber;
}

/** Se a munição pode ser carregada no carregador agora */
export function canLoad(magazine: Item, ammo: Item): boolean {
  return (
    isFeed(magazine) &&
    ammo.def.category === "ammo" &&
    ammo.count > 0 &&
    sameCaliber(magazine.def, ammo.def) &&
    freeRounds(magazine) > 0
  );
}

/**
 * Carrega até `max` cartuchos da pilha `ammo` no carregador e devolve quantos
 * foram carregados. Se a pilha esvaziar, ela é removida de onde estava.
 */
export function loadRounds(magazine: Item, ammo: Item, max = Infinity): number {
  if (!canLoad(magazine, ammo)) return 0;
  const rounds = magazine.rounds as NonNullable<Item["rounds"]>;
  const n = Math.min(max, ammo.count, freeRounds(magazine));
  const top = rounds.at(-1);
  if (top?.def === ammo.def) top.count += n;
  else rounds.push({ def: ammo.def, count: n });
  ammo.count -= n;
  if (ammo.count === 0) detach(ammo);
  return n;
}

/**
 * Tira até `max` cartuchos do topo do carregador e guarda como pilhas de
 * munição nas grades (completando pilhas iguais primeiro). Para quando não
 * couber mais nada e devolve quantos cartuchos saíram.
 */
export function unloadRounds(
  magazine: Item,
  factory: ItemFactory,
  grids: readonly Grid[],
  max = Infinity,
): number {
  const rounds = magazine.rounds ?? [];
  let moved = 0;
  while (moved < max && rounds.length > 0) {
    const top = rounds[rounds.length - 1];
    const take = Math.min(top.count, max - moved, maxStack(top.def));
    const stack = factory.create(top.def.id, take);
    const stored = autoPlace(stack, grids) ? take : take - stack.count;
    top.count -= stored;
    moved += stored;
    if (top.count === 0) rounds.pop();
    if (stored < take) break;
  }
  return moved;
}

/** Tira o cartucho do topo (disparo). `null` se estiver vazio. */
export function popRound(magazine: Item): ItemDef | null {
  const rounds = magazine.rounds ?? [];
  const top = rounds.at(-1);
  if (!top) return null;
  top.count -= 1;
  if (top.count === 0) rounds.pop();
  return top.def;
}

/** Se o carregador pode ser encaixado na arma */
export function canAttachMagazine(weapon: Item, magazine: Item): boolean {
  return (
    isWeapon(weapon) &&
    isMagazine(magazine) &&
    weapon.magazine === null &&
    sameCaliber(weapon.def, magazine.def)
  );
}

/** Encaixa o carregador na arma, tirando-o de onde estava */
export function attachMagazine(weapon: Item, magazine: Item): boolean {
  if (!canAttachMagazine(weapon, magazine)) return false;
  detach(magazine);
  weapon.magazine = magazine;
  magazine.location = { kind: "weapon", weapon };
  return true;
}

/**
 * Tira o carregador da arma e guarda nas grades. Se não couber, ele continua
 * na arma e devolve `null`.
 */
export function removeMagazine(
  weapon: Item,
  grids: readonly Grid[],
): Item | null {
  const magazine = weapon.magazine;
  if (!magazine) return null;
  for (const grid of grids) {
    const spot = grid.findFreeSpot(magazine);
    if (spot) {
      detach(magazine);
      grid.place(magazine, spot.x, spot.y, spot.rotated);
      return magazine;
    }
  }
  return null;
}

/** Munição disponível na arma: a câmara e o carregador (ou o tubo) */
export function weaponRounds(weapon: Item): number {
  const feed = feedOf(weapon);
  return (weapon.chamber ? 1 : 0) + (feed ? loadedRounds(feed) : 0);
}

/**
 * Leva o cartucho do topo do carregador (ou do tubo) para a câmara vazia.
 * Devolve se a câmara foi carregada agora.
 */
export function chamberRound(weapon: Item): boolean {
  if (!isWeapon(weapon) || weapon.chamber) return false;
  const feed = feedOf(weapon);
  const round = feed ? popRound(feed) : null;
  if (!round) return false;
  weapon.chamber = round;
  return true;
}

/**
 * Dispara: sai o cartucho da câmara (carregando antes, se estiver vazia) e o
 * próximo sobe do carregador. `null` se a arma estiver sem munição.
 */
export function fireRound(weapon: Item): ItemDef | null {
  chamberRound(weapon);
  const round = weapon.chamber;
  if (!round) return null;
  delete weapon.chamber;
  chamberRound(weapon);
  return round;
}

/**
 * Tira o cartucho da câmara e guarda nas grades. Se não couber, ele continua
 * na câmara e devolve `false`.
 */
export function unloadChamber(
  weapon: Item,
  factory: ItemFactory,
  grids: readonly Grid[],
): boolean {
  const round = weapon.chamber;
  if (!round) return false;
  if (!autoPlace(factory.create(round.id), grids)) return false;
  delete weapon.chamber;
  return true;
}

/**
 * Se a munição pode entrar na arma agora: mesmo calibre e espaço na câmara
 * vazia ou no carregador encaixado (ou no tubo)
 */
export function canLoadWeapon(weapon: Item, ammo: Item): boolean {
  if (!isWeapon(weapon) || ammo.def.category !== "ammo" || ammo.count < 1) {
    return false;
  }
  if (!sameCaliber(weapon.def, ammo.def)) return false;
  const feed = feedOf(weapon);
  return !weapon.chamber || (feed !== null && canLoad(feed, ammo));
}

/**
 * Munição solta sobre a arma: com a câmara vazia, 1 cartucho vai para ela; o
 * resto vai para o carregador encaixado (ou para o tubo). Devolve quantos
 * cartuchos entraram; a pilha vazia sai de onde estava.
 */
export function loadWeapon(weapon: Item, ammo: Item): number {
  if (!canLoadWeapon(weapon, ammo)) return 0;
  let loaded = 0;
  if (!weapon.chamber) {
    weapon.chamber = ammo.def;
    ammo.count -= 1;
    loaded = 1;
    if (ammo.count === 0) {
      detach(ammo);
      return loaded;
    }
  }
  const feed = feedOf(weapon);
  return loaded + (feed ? loadRounds(feed, ammo) : 0);
}

/** `canLoadWeapon` para armas, `canLoad` para carregadores */
export function canLoadInto(target: Item, ammo: Item): boolean {
  return isWeapon(target) ? canLoadWeapon(target, ammo) : canLoad(target, ammo);
}

/** `loadWeapon` para armas, `loadRounds` para carregadores */
export function loadInto(target: Item, ammo: Item): number {
  return isWeapon(target) ? loadWeapon(target, ammo) : loadRounds(target, ammo);
}
