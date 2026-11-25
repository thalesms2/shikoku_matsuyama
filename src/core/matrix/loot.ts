import { coreBalance } from "../balance.ts";
import type { Grid } from "../inventory/grid.ts";
import type { Item } from "../inventory/item.ts";
import { autoPlace, detach } from "../inventory/operations.ts";
import { skillBonus } from "../pmc/skills.ts";
import type { SkillsState } from "../pmc/skills.ts";
import type { MatrixStrategyId } from "./strategy.ts";
import type { ContainerDef } from "./types.ts";

/**
 * Turnos para revistar: os do contêiner, menos `knownSearchDiscount` se ele
 * já é conhecido e menos `fastSearchDiscount` para Agressivo e Psicopata;
 * nunca menos de 1.
 */
export function searchTurns(
  def: ContainerDef,
  strategy: MatrixStrategyId,
  known: boolean,
): number {
  const b = coreBalance().matrix;
  let turns = def.searchTurns;
  if (known) turns -= b.knownSearchDiscount;
  if (strategy === "aggressive" || strategy === "psycho") {
    turns -= b.fastSearchDiscount;
  }
  return Math.max(1, turns);
}

/** Chance de achar: a do contêiner × (1 + Percepção), × `safeFindFactor` no Seguro, até 1 */
export function findChance(
  def: ContainerDef,
  strategy: MatrixStrategyId,
  skills: SkillsState,
): number {
  let chance = def.findChance * (1 + skillBonus(skills, "perception"));
  if (strategy === "safe") chance *= coreBalance().matrix.safeFindFactor;
  return Math.min(1, chance);
}

/** Se a estratégia revista o contêiner por onde passa */
export function wantsSearch(
  strategy: MatrixStrategyId,
  turns: number,
): boolean {
  return (
    strategy !== "safe" || turns <= coreBalance().matrix.safeMaxSearchTurns
  );
}

/** Fração das células das grades ocupadas */
export function fillRatio(grids: readonly Grid[]): number {
  let used = 0;
  let total = 0;
  for (const grid of grids) {
    total += grid.width * grid.height;
    for (const item of grid.items()) used += item.def.width * item.def.height;
  }
  return total === 0 ? 1 : used / total;
}

/**
 * Fração ocupada que manda a estratégia para a extração (`null` = nunca por
 * isso). Rato, Neutro e Agressivo também vão quando um item achado não cabe.
 */
export function fullThreshold(strategy: MatrixStrategyId): number | null {
  const b = coreBalance().matrix;
  if (strategy === "rat") return b.ratFullAt;
  if (strategy === "neutral") return b.neutralFullAt;
  return null;
}

/** Se a estratégia vai para a extração quando um item achado não cabe */
export function leavesWhenFull(strategy: MatrixStrategyId): boolean {
  return (
    strategy === "rat" || strategy === "neutral" || strategy === "aggressive"
  );
}

/** Resultado de guardar um item achado */
export interface MatrixStash {
  readonly stored: boolean;
  /** Itens desta raid largados para abrir espaço */
  readonly dropped: Item[];
}

/**
 * Guarda o item achado nas grades. Agressivo e Psicopata, sem espaço, largam
 * itens desta raid de contêineres menos raros (do menos raro para o mais
 * raro) até caber; se nem assim couber, nada muda. O personagem não sabe o
 * valor dos itens: só a raridade do contêiner de onde vieram (`origin`).
 */
export function stashFound(
  item: Item,
  rarity: number,
  grids: readonly Grid[],
  origin: Map<Item, number>,
  strategy: MatrixStrategyId,
): MatrixStash {
  if (autoPlace(item, grids)) {
    origin.set(item, rarity);
    return { stored: true, dropped: [] };
  }
  const swaps = strategy === "aggressive" || strategy === "psycho";
  if (!swaps) return { stored: false, dropped: [] };
  const candidates = [...origin.entries()]
    .filter(([i, r]) => r < rarity && i.location?.kind === "grid")
    .sort((a, b) => a[1] - b[1]);
  const removed: {
    item: Item;
    grid: Grid;
    x: number;
    y: number;
    r: boolean;
  }[] = [];
  for (const [old] of candidates) {
    const loc = old.location as Extract<Item["location"], { kind: "grid" }>;
    removed.push({
      item: old,
      grid: loc.grid,
      x: loc.x,
      y: loc.y,
      r: loc.rotated,
    });
    detach(old);
    if (autoPlace(item, grids)) {
      for (const r of removed) origin.delete(r.item);
      origin.set(item, rarity);
      return { stored: true, dropped: removed.map((r) => r.item) };
    }
  }
  // não coube: tudo volta para o lugar
  for (const r of removed) r.grid.place(r.item, r.x, r.y, r.r);
  return { stored: false, dropped: [] };
}
