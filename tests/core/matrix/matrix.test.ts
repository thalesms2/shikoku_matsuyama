import { describe, expect, it } from "vitest";

import { ItemFactory } from "../../../src/core/inventory/item.ts";
import {
  CONTAINER_DENSITY,
  cellAt,
  freeExtracts,
  generateMatrix,
  inBounds,
  matrixSize,
  neighbors,
  rollContainer,
  validateMatrix,
} from "../../../src/core/matrix/matrix.ts";
import type {
  ContainerDef,
  MatrixMap,
  MatrixMapDef,
} from "../../../src/core/matrix/types.ts";
import { Rng } from "../../../src/core/rng.ts";
import { catalog } from "../../../src/data/items.ts";
import { ScriptRng } from "../raid/raidFixtures.ts";

const DEF: MatrixMapDef = {
  id: "test",
  name: "Teste",
  difficulty: 2,
  seed: 7,
  terrain: { road: 1, grass: 1 },
  containers: { crate: 1, drawer: 1 },
  pois: [
    {
      id: "a",
      name: "A",
      obvious: true,
      containers: ["medbag", "safe", "crate"],
    },
    { id: "b", name: "B", obvious: false, containers: ["drawer"] },
  ],
  extracts: [
    { id: "free", name: "Saída" },
    {
      id: "key",
      name: "Porta",
      requirement: { kind: "key", item: "key_garage" },
    },
  ],
};

const map = () => generateMatrix(DEF, new Rng(DEF.seed));

describe("geometria da matriz", () => {
  it("o tamanho cresce com a dificuldade", () => {
    expect(matrixSize(1)).toEqual({ width: 14, height: 8 });
    expect(matrixSize(3)).toEqual({ width: 22, height: 12 });
  });

  it("dentro do mapa, célula e vizinhas sem diagonal", () => {
    const m = map();
    expect(inBounds(m, 0, 0)).toBe(true);
    expect(inBounds(m, -1, 0)).toBe(false);
    expect(inBounds(m, m.width, 0)).toBe(false);
    expect(inBounds(m, 0, m.height)).toBe(false);
    expect(cellAt(m, 1, 2)).toBe(m.cells[2][1]);
    expect(neighbors(m, 0, 0)).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(neighbors(m, 3, 3)).toEqual([
      [3, 2],
      [4, 3],
      [3, 4],
      [2, 3],
    ]);
  });
});

describe("generateMatrix", () => {
  it("a mesma receita gera o mesmo mapa", () => {
    expect(map()).toEqual(map());
  });

  it("extrações: a livre na coluna da direita, a com requisito mais perto da entrada", () => {
    const m = map();
    const [free, key] = m.extracts;
    expect(freeExtracts(m)).toEqual([free]);
    expect(free.x).toBe(m.width - 1);
    expect(key.x).toBeGreaterThanOrEqual(Math.floor(m.width * 0.55));
    expect(key.x).toBeLessThanOrEqual(Math.floor(m.width * 0.8));
    expect(key.requirement).toEqual({ kind: "key", item: "key_garage" });
  });

  it("pontos de interesse: blocos com os contêineres deles; pelo menos 2 células", () => {
    const m = map();
    const [a, b] = m.pois;
    expect(a).toMatchObject({ id: "a", name: "A", obvious: true });
    expect(a.cells.map(([x, y]) => cellAt(m, x, y).container)).toEqual([
      "medbag",
      "safe",
      "crate",
    ]);
    for (const [x, y] of a.cells)
      expect(cellAt(m, x, y).terrain).toBe("building");
    expect(b.cells).toHaveLength(2);
    expect(b.cells.map(([x, y]) => cellAt(m, x, y).container)).toEqual([
      "drawer",
      "drawer",
    ]);
  });

  it("spawns e contêineres soltos nas quantidades certas, fora da entrada", () => {
    const m = map();
    const all = m.cells.flatMap((row, y) =>
      row.map((cell, x) => ({ cell, x, y })),
    );
    const scav = all.filter((c) => c.cell.scavSpawn);
    const pmc = all.filter((c) => c.cell.pmcSpawn);
    expect(scav).toHaveLength(2 + 2 * DEF.difficulty);
    expect(pmc).toHaveLength(DEF.difficulty);
    for (const s of [...scav, ...pmc]) expect(s.x).toBeGreaterThanOrEqual(2);
    const poiCells = m.pois.reduce((n, p) => n + p.cells.length, 0);
    const containers = all.filter((c) => c.cell.container);
    expect(containers).toHaveLength(
      Math.round(m.width * m.height * CONTAINER_DENSITY) + poiCells,
    );
    expect(containers.every((c) => c.x >= 1)).toBe(true);
    expect(validateMatrix(m)).toEqual([]);
  });
});

describe("generateMatrix: extrações na mesma célula", () => {
  it("se o sorteio cair numa célula usada, desce para a próxima linha livre", () => {
    /** Rng real, mas as primeiras rolagens de `int` vêm de uma fila */
    class QueuedRng extends Rng {
      queue = [3, 3];
      override int(min: number, max: number): number {
        return this.queue.length > 0
          ? this.queue.shift()!
          : super.int(min, max);
      }
    }
    const def: MatrixMapDef = {
      ...DEF,
      pois: [],
      extracts: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
    };
    const m = generateMatrix(def, new QueuedRng(1));
    expect(m.extracts.map((e) => [e.x, e.y])).toEqual([
      [m.width - 1, 3],
      [m.width - 1, 4],
    ]);
  });
});

describe("validateMatrix", () => {
  it("aponta cada problema", () => {
    const m = map();
    const broken: MatrixMap = {
      ...m,
      height: m.height + 1,
      cells: [
        [...m.cells[0].slice(1), { terrain: "road", container: "x" as never }],
        m.cells[1].slice(1),
        ...m.cells.slice(2),
      ],
      extracts: [
        { id: "out", name: "Fora", x: 99, y: 0 },
        { ...m.extracts[1] },
      ],
      pois: [{ id: "p", name: "P", obvious: false, cells: [[-1, 0]] }],
    };
    expect(validateMatrix(broken)).toEqual([
      "Altura errada",
      `Contêiner desconhecido em ${m.width - 1},0`,
      "Linha 1 com largura errada",
      "Extração out fora do mapa",
      "Falta uma extração livre na coluna da direita",
      "Ponto de interesse p fora do mapa",
    ]);
  });
});

describe("rollContainer", () => {
  const CONTAINER: ContainerDef = {
    kind: "crate",
    name: "Caixote",
    rarity: 1,
    searchTurns: 3,
    findChance: 0.7,
    rareChance: 0.1,
    loot: [{ item: "barter_bolts", weight: 1 }],
    rare: [{ item: "barter_gpu", weight: 1 }],
  };
  const factory = new ItemFactory(catalog);

  it("sai da tabela rara com a chance (mais o bônus), senão da comum", () => {
    const rng = new ScriptRng();
    rng.chances = [true, false];
    expect(rollContainer(CONTAINER, rng, factory, 0.2).def.id).toBe(
      "barter_gpu",
    );
    expect(rollContainer(CONTAINER, rng, factory).def.id).toBe("barter_bolts");
  });

  it("sem tabela rara, sempre a comum", () => {
    const rng = new ScriptRng();
    rng.defaultChance = true;
    expect(rollContainer({ ...CONTAINER, rare: [] }, rng, factory).def.id).toBe(
      "barter_bolts",
    );
  });
});
