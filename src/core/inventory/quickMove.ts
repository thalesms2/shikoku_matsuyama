import { SLOT_NAMES } from "./equipment.ts";
import type { Equipment } from "./equipment.ts";
import type { Grid } from "./grid.ts";
import type { Item } from "./item.ts";
import { autoPlace, moveToSlot } from "./operations.ts";

/** Estoque e equipamento (o mesmo formato do `InventoryState`) */
export interface QuickMoveInventory {
  readonly stash: Grid;
  readonly equipment: Equipment;
}

/** Se o item está no estoque, direto ou dentro de um contêiner dele */
export function inStash(item: Item, stash: Grid): boolean {
  let current = item;
  for (;;) {
    const loc = current.location;
    if (loc?.kind !== "grid") return false;
    if (loc.grid === stash) return true;
    if (!loc.grid.owner) return false;
    current = loc.grid.owner;
  }
}

/**
 * Ctrl+clique: do estoque, o item vai para o primeiro slot vazio que o aceita
 * ou, se não houver, para as grades de carga (bolsos, colete tático,
 * mochila). De qualquer outro lugar (vestido, bolsos, colete, mochila,
 * contêiner seguro), ele vai para o estoque. Devolve se mudou algo: pilhas
 * podem entrar só em parte, completando pilhas iguais.
 */
export function quickMove(item: Item, inventory: QuickMoveInventory): boolean {
  const { stash, equipment } = inventory;
  if (!item.location) return false;
  const count = item.count;
  if (inStash(item, stash)) {
    const slot = SLOT_NAMES.find((s) => equipment.canEquip(s, item));
    if (slot) return moveToSlot(item, equipment, slot);
    return autoPlace(item, equipment.carryGrids()) || item.count < count;
  }
  return autoPlace(item, [stash]) || item.count < count;
}
