import { coreBalance } from "../balance.ts";
import type { EnemyKind } from "../raid/types.ts";
import type { Rng } from "../rng.ts";
import { neighbors } from "./matrix.ts";
import type { Cell } from "./path.ts";
import type { MatrixStrategyId } from "./strategy.ts";
import type { MatrixMap, Terrain } from "./types.ts";

/** Inimigo andando pelo mapa */
export interface MatrixEnemy {
  readonly id: number;
  readonly kind: EnemyKind;
  x: number;
  y: number;
  /** Percebeu o personagem e vem atrás dele */
  chasing: boolean;
  /** O personagem notou este inimigo (vindo atrás dele) */
  noticed: boolean;
  /** O personagem viu e decidiu não brigar (não decide de novo até sair do alcance) */
  ignored: boolean;
}

/** Distância em células (sem diagonal) */
export function distance(a: Cell, b: Cell): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/** Número que aparece no d10 para surgir um inimigo na dificuldade */
export function spawnTarget(difficulty: number): number {
  const b = coreBalance().encounter;
  return b.spawnBase - Math.ceil(b.spawnPerDifficulty * difficulty);
}

/** Pontos de spawn do mapa com o peso de cada um (PMC mais raro) */
export function spawnPoints(
  map: MatrixMap,
): { value: { cell: Cell; kind: EnemyKind }; weight: number }[] {
  const points: { value: { cell: Cell; kind: EnemyKind }; weight: number }[] =
    [];
  map.cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell.scavSpawn)
        points.push({ value: { cell: [x, y], kind: "scav" }, weight: 1 });
      if (cell.pmcSpawn) {
        points.push({
          value: { cell: [x, y], kind: "pmc" },
          weight: coreBalance().encounter.pmcSpawnWeight,
        });
      }
    }),
  );
  return points;
}

/**
 * Rolagem de spawn do turno: com d10 ≥ `spawnTarget`, surge um inimigo num
 * ponto de spawn sorteado. Devolve o inimigo novo (ou `null`).
 */
export function rollSpawn(
  map: MatrixMap,
  rng: Rng,
  nextId: number,
): MatrixEnemy | null {
  const points = spawnPoints(map);
  if (points.length === 0 || rng.int(1, 10) < spawnTarget(map.difficulty)) {
    return null;
  }
  const { cell, kind } = rng.weighted(points);
  return {
    id: nextId,
    kind,
    x: cell[0],
    y: cell[1],
    chasing: false,
    noticed: false,
    ignored: false,
  };
}

/**
 * Movimento do inimigo no turno: perseguindo, anda 1 célula na direção do
 * personagem (primeiro na horizontal); senão, com d6 ≥ `moveBase −
 * dificuldade`, anda para uma vizinha sorteada.
 */
export function moveEnemy(
  enemy: MatrixEnemy,
  map: MatrixMap,
  player: Cell,
  rng: Rng,
): void {
  if (enemy.chasing) {
    if (enemy.x !== player[0]) enemy.x += Math.sign(player[0] - enemy.x);
    else if (enemy.y !== player[1]) enemy.y += Math.sign(player[1] - enemy.y);
    return;
  }
  const b = coreBalance().encounter;
  if (rng.int(1, 6) < b.moveBase - map.difficulty) return;
  const [x, y] = rng.pick(neighbors(map, enemy.x, enemy.y));
  enemy.x = x;
  enemy.y = y;
}

/**
 * Alcance em que o inimigo percebe o personagem: `hearingRange` (2); o Rato
 * só na mesma célula; o Agressivo e o Psicopata fazem barulho e são ouvidos
 * de mais longe (o Psicopata mais ainda em mato e metal).
 */
export function hearingRange(
  strategy: MatrixStrategyId,
  terrain: Terrain,
): number {
  const b = coreBalance().encounter;
  if (strategy === "rat") return 0;
  if (strategy === "aggressive") return b.hearingRange + b.aggressiveNoise;
  if (strategy === "psycho") {
    const loud = terrain === "grass" || terrain === "metal";
    return b.hearingRange + b.psychoNoise + (loud ? b.psychoTerrainNoise : 0);
  }
  return b.hearingRange;
}

/** Disputa de percepção no d20: positivo = o personagem percebe; negativo = o inimigo; 0 = ninguém */
export function perceptionContest(
  rng: Rng,
  playerBonus: number,
  enemyBonus: number,
): number {
  const player = rng.int(1, 20) + playerBonus;
  const enemy = rng.int(1, 20) + enemyBonus;
  return Math.sign(player - enemy);
}

/** Fuga: o d20 do personagem (+ bônus) precisa ser ≥ `fleeFactor` × o do inimigo */
export function fleeRoll(rng: Rng, playerBonus: number): boolean {
  const player = rng.int(1, 20) + playerBonus;
  const enemy = rng.int(1, 20);
  return player >= coreBalance().encounter.fleeFactor * enemy;
}
