import type { Equipment, SlotName } from "./equipment.ts";
import type { Grid } from "./grid.ts";
import type { GridLocation, Item, ItemFactory } from "./item.ts";
import { maxStack } from "./size.ts";

/** Tira o item de onde ele estiver (grade ou slot), deixando-o solto */
export function detach(item: Item): void {
  const loc = item.location;
  if (loc?.kind === "grid") loc.grid.remove(item);
  else if (loc?.kind === "slot") loc.equipment.unequip(loc.slot);
}

/** Move o item para uma posição da grade. Não faz nada se não couber. */
export function moveToGrid(
  item: Item,
  grid: Grid,
  x: number,
  y: number,
  rotated = false,
): boolean {
  if (!grid.canPlace(item, x, y, rotated)) return false;
  detach(item);
  grid.place(item, x, y, rotated);
  return true;
}

/** Equipa o item no slot. Não faz nada se o slot não aceitar. */
export function moveToSlot(
  item: Item,
  equipment: Equipment,
  slot: SlotName,
): boolean {
  if (!equipment.canEquip(slot, item)) return false;
  detach(item);
  equipment.equip(slot, item);
  return true;
}

/** Se `source` pode ser somado à pilha `target` */
export function canStack(source: Item, target: Item): boolean {
  return (
    source !== target &&
    source.def === target.def &&
    maxStack(target.def) > 1 &&
    target.count < maxStack(target.def)
  );
}

/**
 * Passa o máximo possível de `source` para a pilha `target` e devolve quanto
 * foi movido. Se `source` esvaziar, ele é removido de onde estava.
 */
export function mergeStack(source: Item, target: Item): number {
  if (!canStack(source, target)) return 0;
  const moved = Math.min(source.count, maxStack(target.def) - target.count);
  target.count += moved;
  source.count -= moved;
  if (source.count === 0) detach(source);
  return moved;
}

/** Separa `amount` unidades da pilha em um novo item solto */
export function splitStack(
  item: Item,
  amount: number,
  factory: ItemFactory,
): Item {
  if (!Number.isInteger(amount) || amount < 1 || amount >= item.count) {
    throw new RangeError(
      `Não é possível separar ${amount} de uma pilha de ${item.count}`,
    );
  }
  const part = factory.create(item.def.id, amount);
  item.count -= amount;
  return part;
}

/**
 * Guarda o item na primeira das grades onde couber: primeiro completa pilhas
 * iguais, depois procura um espaço livre. Devolve `true` se o item inteiro
 * foi guardado; se só parte coube em pilhas, o resto continua no item.
 */
export function autoPlace(item: Item, grids: readonly Grid[]): boolean {
  for (const grid of grids) {
    for (const other of grid.items()) {
      mergeStack(item, other);
      if (item.count === 0) return true;
    }
  }
  for (const grid of grids) {
    const spot = grid.findFreeSpot(item);
    if (spot) return moveToGrid(item, grid, spot.x, spot.y, spot.rotated);
  }
  return false;
}

/**
 * Solta `item` em cima de `target`: soma à pilha se forem iguais, ou guarda
 * dentro de `target` se ele for um contêiner.
 */
export function dropOnItem(item: Item, target: Item): boolean {
  if (canStack(item, target)) return mergeStack(item, target) > 0;
  if (target.grids.length > 0 && item !== target) {
    return autoPlace(item, target.grids);
  }
  return false;
}

const area = (item: Item) => item.def.width * item.def.height;

/**
 * Reorganiza a grade: itens maiores primeiro, agrupados por categoria e nome.
 * Se a nova organização não couber, a grade volta como estava e devolve
 * `false`.
 */
export function sortGrid(grid: Grid): boolean {
  const original = grid.items().map((item) => ({
    item,
    loc: item.location as GridLocation,
  }));
  const sorted = original
    .map((o) => o.item)
    .sort(
      (a, b) =>
        area(b) - area(a) ||
        a.def.category.localeCompare(b.def.category) ||
        a.def.name.localeCompare(b.def.name) ||
        b.count - a.count,
    );

  for (const item of sorted) grid.remove(item);

  for (const item of sorted) {
    const spot = grid.findFreeSpot(item);
    if (!spot) {
      for (const placed of grid.items()) grid.remove(placed);
      for (const { item: it, loc } of original) {
        grid.place(it, loc.x, loc.y, loc.rotated);
      }
      return false;
    }
    grid.place(item, spot.x, spot.y, spot.rotated);
  }
  return true;
}
