import type { ItemFactory, Item } from "../inventory/item.ts";
import { rollLoot } from "../raid/loot.ts";
import type { Rng } from "../rng.ts";
import type {
  ContainerDef,
  ContainerKind,
  MatrixCell,
  MatrixExtract,
  MatrixMap,
  MatrixMapDef,
  Terrain,
} from "./types.ts";
import { CONTAINER_KINDS } from "./types.ts";

/** Largura e altura da matriz pela dificuldade (1 a 5) */
export function matrixSize(difficulty: number): {
  width: number;
  height: number;
} {
  return { width: 10 + 4 * difficulty, height: 6 + 2 * difficulty };
}

/** Fração das células com contêiner solto (fora dos pontos de interesse) */
export const CONTAINER_DENSITY = 0.12;

export function inBounds(map: MatrixMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function cellAt(map: MatrixMap, x: number, y: number): MatrixCell {
  return map.cells[y][x];
}

/** Vizinhas de uma célula, sem diagonal (cima, direita, baixo, esquerda) */
export function neighbors(
  map: MatrixMap,
  x: number,
  y: number,
): [number, number][] {
  return (
    [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ] as [number, number][]
  ).filter(([nx, ny]) => inBounds(map, nx, ny));
}

/** Extrações livres (sem requisito) */
export function freeExtracts(map: MatrixMap): MatrixExtract[] {
  return map.extracts.filter((e) => !e.requirement);
}

/**
 * Problemas do mapa (vazio = válido): tamanho das linhas, extrações dentro
 * da matriz, pelo menos uma extração livre na coluna da direita, pontos de
 * interesse dentro da matriz e contêineres de tipos conhecidos.
 */
export function validateMatrix(map: MatrixMap): string[] {
  const problems: string[] = [];
  if (map.cells.length !== map.height) problems.push("Altura errada");
  map.cells.forEach((row, y) => {
    if (row.length !== map.width)
      problems.push(`Linha ${y} com largura errada`);
    row.forEach((cell, x) => {
      if (cell.container && !CONTAINER_KINDS.includes(cell.container)) {
        problems.push(`Contêiner desconhecido em ${x},${y}`);
      }
    });
  });
  for (const e of map.extracts) {
    if (!inBounds(map, e.x, e.y))
      problems.push(`Extração ${e.id} fora do mapa`);
  }
  if (!freeExtracts(map).some((e) => e.x === map.width - 1)) {
    problems.push("Falta uma extração livre na coluna da direita");
  }
  for (const poi of map.pois) {
    if (poi.cells.some(([x, y]) => !inBounds(map, x, y))) {
      problems.push(`Ponto de interesse ${poi.id} fora do mapa`);
    }
  }
  return problems;
}

type MutableCell = {
  terrain: Terrain;
  container?: ContainerKind;
  scavSpawn?: true;
  pmcSpawn?: true;
};

/**
 * Gera o mapa da receita, sempre igual para a mesma receita (`Rng(seed)`):
 * - tamanho pela dificuldade (`matrixSize`);
 * - terreno sorteado pelos pesos;
 * - extrações livres na coluna da direita e as com requisito entre 55% e 80%
 *   da largura (mais perto da entrada, na coluna da esquerda);
 * - pontos de interesse em blocos 2x2 longe das bordas, com os contêineres
 *   deles;
 * - `2 + 2 × dificuldade` spawns de Scav e `dificuldade` spawns de PMC fora
 *   das duas primeiras colunas;
 * - contêineres soltos em `CONTAINER_DENSITY` das células livres.
 */
export function generateMatrix(def: MatrixMapDef, rng: Rng): MatrixMap {
  const { width, height } = matrixSize(def.difficulty);
  const terrains = Object.entries(def.terrain).map(([value, weight]) => ({
    value: value as Terrain,
    weight: weight!,
  }));
  const cells: MutableCell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ terrain: rng.weighted(terrains) })),
  );
  const used = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const free = (x: number, y: number) => !used.has(key(x, y));

  // Extrações: livres na direita, com requisito mais perto da entrada
  const extracts: MatrixExtract[] = [];
  for (const e of def.extracts) {
    let x = width - 1;
    if (e.requirement) {
      x = rng.int(Math.floor(width * 0.55), Math.floor(width * 0.8));
    }
    let y = rng.int(0, height - 1);
    while (!free(x, y)) y = (y + 1) % height;
    used.add(key(x, y));
    extracts.push({ ...e, x, y });
  }

  // Pontos de interesse: blocos 2x2 longe das bordas
  const pois = def.pois.map((poi) => {
    let x: number;
    let y: number;
    do {
      x = rng.int(2, width - 4);
      y = rng.int(0, height - 2);
    } while (
      !free(x, y) ||
      !free(x + 1, y) ||
      !free(x, y + 1) ||
      !free(x + 1, y + 1)
    );
    const block: [number, number][] = [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ];
    const poiCells = block.slice(0, Math.max(2, poi.containers.length));
    poiCells.forEach(([cx, cy], i) => {
      used.add(key(cx, cy));
      cells[cy][cx].container = poi.containers[i % poi.containers.length];
      cells[cy][cx].terrain = "building";
    });
    return {
      id: poi.id,
      name: poi.name,
      obvious: poi.obvious,
      cells: poiCells,
    };
  });

  const randomFreeCell = (minX: number): [number, number] => {
    let x: number;
    let y: number;
    do {
      x = rng.int(minX, width - 2);
      y = rng.int(0, height - 1);
    } while (!free(x, y));
    used.add(key(x, y));
    return [x, y];
  };
  for (let i = 0; i < 2 + 2 * def.difficulty; i++) {
    const [x, y] = randomFreeCell(2);
    cells[y][x].scavSpawn = true;
  }
  for (let i = 0; i < def.difficulty; i++) {
    const [x, y] = randomFreeCell(2);
    cells[y][x].pmcSpawn = true;
  }
  const kinds = Object.entries(def.containers).map(([value, weight]) => ({
    value: value as ContainerKind,
    weight: weight!,
  }));
  const loose = Math.round(width * height * CONTAINER_DENSITY);
  for (let i = 0; i < loose; i++) {
    const [x, y] = randomFreeCell(1);
    cells[y][x].container = rng.weighted(kinds);
  }

  return {
    id: def.id,
    name: def.name,
    difficulty: def.difficulty,
    width,
    height,
    cells,
    extracts,
    pois,
  };
}

/**
 * Sorteia um item do contêiner: com `rareChance + rareBonus` sai da tabela
 * rara (se houver), senão da comum.
 */
export function rollContainer(
  def: ContainerDef,
  rng: Rng,
  factory: ItemFactory,
  rareBonus = 0,
): Item {
  const rare = def.rare.length > 0 && rng.chance(def.rareChance + rareBonus);
  return rollLoot(rare ? def.rare : def.loot, rng, factory);
}
