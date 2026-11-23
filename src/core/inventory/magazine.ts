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

/** Capacidade do carregador, em cartuchos */
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
    isMagazine(magazine) &&
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
    !weapon.magazine &&
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

/** Munição disponível na arma (no carregador encaixado) */
export function weaponRounds(weapon: Item): number {
  return weapon.magazine ? loadedRounds(weapon.magazine) : 0;
}
