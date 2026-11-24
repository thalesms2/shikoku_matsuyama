import type { Grid } from "../inventory/grid.ts";
import { totalValue } from "../inventory/item.ts";
import type { GridLocation, Item, ItemFactory } from "../inventory/item.ts";
import { autoPlace, detach } from "../inventory/operations.ts";
import { maxStack } from "../inventory/size.ts";
import type { Rng } from "../rng.ts";
import type { LootEntry, LootRule } from "./types.ts";

/** Sorteia uma linha da tabela e cria o item (quantidade entre min e max) */
export function rollLoot(
  table: readonly LootEntry[],
  rng: Rng,
  factory: ItemFactory,
): Item {
  const entry = rng.weighted(
    table.map((e) => ({ value: e, weight: e.weight })),
  );
  const def = factory.catalog.get(entry.item);
  const min = Math.max(1, entry.min ?? 1);
  const max = Math.min(maxStack(def), Math.max(min, entry.max ?? min));
  return factory.create(entry.item, rng.int(Math.min(min, max), max));
}

/** Valor do item dividido pelas células que ele ocupa */
export function valuePerCell(item: Item): number {
  return totalValue(item) / (item.def.width * item.def.height);
}

export interface StashResult {
  /** Quantas unidades foram guardadas */
  stored: number;
  /** Loot que ficou para trás para abrir espaço */
  dropped: Item[];
}

function placeFree(item: Item, grids: readonly Grid[]): boolean {
  for (const grid of grids) {
    const spot = grid.findFreeSpot(item);
    if (spot) {
      grid.place(item, spot.x, spot.y, spot.rotated);
      return true;
    }
  }
  return false;
}

/**
 * Guarda o loot nas grades (completa pilhas, depois procura espaço). Se não
 * couber e a regra for `valuePerCell`, larga o loot desta raid (`found`) que
 * vale menos por célula, do mais barato para o mais caro, até caber. O que
 * foi largado mas não era preciso volta para o lugar. Se nem assim couber,
 * nada é largado. O equipamento que o PMC trouxe nunca é largado.
 */
export function stashLoot(
  item: Item,
  grids: readonly Grid[],
  found: Set<Item>,
  rule: LootRule,
): StashResult {
  const start = item.count;
  if (autoPlace(item, grids)) return { stored: start, dropped: [] };
  if (rule === "valuePerCell") {
    const worth = valuePerCell(item);
    const candidates = [...found]
      .filter(
        (i) =>
          i.location?.kind === "grid" &&
          grids.includes(i.location.grid) &&
          valuePerCell(i) < worth,
      )
      .sort((a, b) => valuePerCell(a) - valuePerCell(b));
    const removed: { item: Item; loc: GridLocation }[] = [];
    for (const candidate of candidates) {
      removed.push({
        item: candidate,
        loc: candidate.location as GridLocation,
      });
      detach(candidate);
      if (placeFree(item, grids)) {
        const dropped: Item[] = [];
        for (const { item: back, loc } of removed) {
          if (loc.grid.canPlace(back, loc.x, loc.y, loc.rotated)) {
            loc.grid.place(back, loc.x, loc.y, loc.rotated);
          } else {
            found.delete(back);
            dropped.push(back);
          }
        }
        return { stored: start, dropped };
      }
    }
    for (const { item: back, loc } of removed.reverse()) {
      loc.grid.place(back, loc.x, loc.y, loc.rotated);
    }
  }
  return { stored: start - item.count, dropped: [] };
}
