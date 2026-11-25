import { coreBalance } from "../balance.ts";
import { cellAt, neighbors } from "./matrix.ts";
import { moveFactor } from "./strategy.ts";
import type { MatrixStrategyId } from "./strategy.ts";
import type { MatrixMap, Terrain } from "./types.ts";

export type Cell = readonly [number, number];

const key = ([x, y]: Cell) => `${x},${y}`;

/** Turnos para atravessar o terreno (antes da estratégia) */
export function terrainTurns(terrain: Terrain): number {
  return coreBalance().matrix[`${terrain}Turns`];
}

/**
 * Turnos para entrar numa célula: terreno × estratégia, arredondado para
 * cima, no mínimo 1.
 */
export function stepTurns(
  map: MatrixMap,
  [x, y]: Cell,
  strategy: MatrixStrategyId,
): number {
  const raw = terrainTurns(cellAt(map, x, y).terrain) * moveFactor(strategy);
  return Math.max(1, Math.ceil(raw));
}

/**
 * Caminho mais barato de `from` até `to` (Dijkstra, só entre vizinhas). O
 * custo de entrar numa célula é `stepTurns` mais `extra(célula)`. Devolve
 * as células depois de `from`, terminando em `to` (vazio se `from === to`).
 * Em empate, a ordem das vizinhas (cima, direita, baixo, esquerda) decide.
 */
export function findPath(
  map: MatrixMap,
  from: Cell,
  to: Cell,
  strategy: MatrixStrategyId,
  extra: (cell: Cell) => number = () => 0,
): Cell[] {
  const target = key(to);
  const dist = new Map<string, number>([[key(from), 0]]);
  const prev = new Map<string, Cell>();
  const open: { cell: Cell; cost: number }[] = [{ cell: from, cost: 0 }];
  while (open.length > 0) {
    // a menor fila; o mapa é pequeno, então uma busca linear basta
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].cost < open[best].cost) best = i;
    }
    const { cell, cost } = open.splice(best, 1)[0];
    if (key(cell) === target) break;
    for (const next of neighbors(map, cell[0], cell[1])) {
      const c = cost + stepTurns(map, next, strategy) + extra(next);
      const k = key(next);
      if (c < (dist.get(k) ?? Infinity)) {
        dist.set(k, c);
        prev.set(k, cell);
        open.push({ cell: next, cost: c });
      }
    }
  }
  const path: Cell[] = [];
  for (let at: Cell = to; key(at) !== key(from); at = prev.get(key(at))!) {
    path.unshift(at);
  }
  return path;
}

/** Turnos para percorrer o caminho com a estratégia */
export function pathTurns(
  map: MatrixMap,
  path: readonly Cell[],
  strategy: MatrixStrategyId,
): number {
  return path.reduce((sum, cell) => sum + stepTurns(map, cell, strategy), 0);
}
