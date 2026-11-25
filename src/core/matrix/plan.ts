import { coreBalance } from "../balance.ts";
import { cellAt, neighbors } from "./matrix.ts";
import { findPath, pathTurns } from "./path.ts";
import type { Cell } from "./path.ts";
import type { MatrixStrategyId } from "./strategy.ts";
import type { MatrixExtract, MatrixMap } from "./types.ts";

/** O que o personagem sabe do mapa (a habilidade do mapa preenche na 12C) */
export interface MatrixKnowledge {
  /** Ids das extrações conhecidas */
  readonly extracts: ReadonlySet<string>;
  /** Ids dos pontos de interesse conhecidos */
  readonly pois: ReadonlySet<string>;
  /** Células ("x,y") com contêiner conhecido */
  readonly containers: ReadonlySet<string>;
  /** Células ("x,y") com spawn conhecido */
  readonly spawns: ReadonlySet<string>;
}

const key = (x: number, y: number) => `${x},${y}`;

/** Conhece tudo do mapa */
export function fullKnowledge(map: MatrixMap): MatrixKnowledge {
  const containers = new Set<string>();
  const spawns = new Set<string>();
  map.cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell.container) containers.add(key(x, y));
      if (cell.scavSpawn || cell.pmcSpawn) spawns.add(key(x, y));
    }),
  );
  return {
    extracts: new Set(map.extracts.map((e) => e.id)),
    pois: new Set(map.pois.map((p) => p.id)),
    containers,
    spawns,
  };
}

/** Plano de uma raid: os alvos na ordem e a extração escolhida */
export interface RoutePlan {
  /** Células a visitar antes da extração (pontos de interesse, contêineres) */
  readonly targets: readonly Cell[];
  /** Extração escolhida, ou `null` se não conhece nenhuma que possa usar */
  readonly extract: MatrixExtract | null;
}

/**
 * Custo extra de cada célula para a estratégia: o Rato e o Seguro desviam
 * dos spawns conhecidos (a célula do spawn e as vizinhas); o Rato também
 * prefere as bordas do mapa (linha de cima e de baixo).
 */
export function cellPenalty(
  map: MatrixMap,
  strategy: MatrixStrategyId,
  knowledge: MatrixKnowledge,
): (cell: Cell) => number {
  const b = coreBalance().matrix;
  const danger = new Set<string>();
  if (strategy === "rat" || strategy === "safe") {
    for (const s of knowledge.spawns) {
      const [x, y] = s.split(",").map(Number);
      danger.add(s);
      for (const [nx, ny] of neighbors(map, x, y)) danger.add(key(nx, ny));
    }
  }
  return ([x, y]) => {
    let extra = danger.has(key(x, y)) ? b.spawnAvoidCost : 0;
    if (strategy === "rat" && y > 0 && y < map.height - 1) {
      extra += b.ratInteriorCost;
    }
    return extra;
  };
}

/**
 * Planeja a rota a partir de `start`:
 * - extração: a conhecida e utilizável (`canUse`) de caminho mais curto;
 * - Rato e Seguro: direto para a extração (o loot é só o do caminho, 12D);
 * - Neutro: pontos de interesse conhecidos cujo desvio não passa de
 *   `neutralDetour`, do mais perto para o mais longe;
 * - Agressivo: pontos de interesse e contêineres conhecidos de raridade ≥ 3;
 * - Psicopata: todos os pontos de interesse e contêineres conhecidos.
 * Agressivo e Psicopata visitam sempre o alvo mais perto do ponto atual.
 */
export function planRoute(
  map: MatrixMap,
  start: Cell,
  strategy: MatrixStrategyId,
  knowledge: MatrixKnowledge,
  canUse: (extract: MatrixExtract) => boolean,
  rarity: (x: number, y: number) => number,
): RoutePlan {
  const extra = cellPenalty(map, strategy, knowledge);
  const turns = (from: Cell, to: Cell) =>
    pathTurns(map, findPath(map, from, to, strategy, extra), strategy);
  const extracts = map.extracts
    .filter((e) => knowledge.extracts.has(e.id) && canUse(e))
    .map((e) => ({ e, t: turns(start, [e.x, e.y]) }))
    .sort((a, b) => a.t - b.t);
  const extract = extracts[0]?.e ?? null;

  const poiTargets = map.pois
    .filter((p) => knowledge.pois.has(p.id))
    .map((p) => p.cells[0]);
  let candidates: Cell[] = [];
  if (strategy === "neutral" && extract) {
    const end: Cell = [extract.x, extract.y];
    const direct = turns(start, end);
    const limit = direct * (1 + coreBalance().matrix.neutralDetour);
    candidates = poiTargets
      .filter((c) => turns(start, c) + turns(c, end) <= limit)
      .sort((a, b) => turns(start, a) - turns(start, b));
    return { targets: candidates, extract };
  }
  if (strategy === "aggressive" || strategy === "psycho") {
    const containers = [...knowledge.containers]
      .map((s) => s.split(",").map(Number) as unknown as Cell)
      .filter(([x, y]) => cellAt(map, x, y).container)
      .filter(([x, y]) => strategy === "psycho" || rarity(x, y) >= 3);
    candidates = [...poiTargets, ...containers];
  }
  // o mais perto de onde está, um depois do outro
  const targets: Cell[] = [];
  const left = candidates.filter(
    (c, i) => candidates.findIndex((d) => key(...d) === key(...c)) === i,
  );
  let at = start;
  while (left.length > 0) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (turns(at, left[i]) < turns(at, left[best])) best = i;
    }
    at = left.splice(best, 1)[0];
    targets.push(at);
  }
  return { targets, extract };
}
