import { afterEach, describe, expect, it } from "vitest";

import {
  CORE_DEFAULTS,
  resetCoreBalance,
  setCoreBalance,
} from "../../../src/core/balance.ts";
import {
  findPath,
  pathTurns,
  stepTurns,
  terrainTurns,
} from "../../../src/core/matrix/path.ts";
import {
  cellPenalty,
  fullKnowledge,
  planRoute,
} from "../../../src/core/matrix/plan.ts";
import type { MatrixKnowledge } from "../../../src/core/matrix/plan.ts";
import {
  DEFAULT_MATRIX_STRATEGY,
  MATRIX_STRATEGY_IDS,
  MATRIX_STRATEGY_NAMES,
  isMatrixStrategy,
  mapStrategy,
  moveFactor,
  setMapStrategy,
} from "../../../src/core/matrix/strategy.ts";
import { createRaidProfile } from "../../../src/core/raid/profile.ts";
import { smallMap } from "./matrixFixtures.ts";

afterEach(() => {
  resetCoreBalance();
});

const FREE = { id: "exit", name: "Saída", x: 5, y: 1 };

describe("estratégias da matriz", () => {
  it("cinco estratégias com nome; o multiplicador vem do balanceamento", () => {
    expect(MATRIX_STRATEGY_IDS.map((id) => MATRIX_STRATEGY_NAMES[id])).toEqual([
      "Rato",
      "Seguro",
      "Neutro",
      "Agressivo",
      "Psicopata",
    ]);
    expect(moveFactor("rat")).toBe(2);
    expect(moveFactor("psycho")).toBe(0.5);
    const b = structuredClone(CORE_DEFAULTS);
    b.matrix.psychoMove = 0.25;
    setCoreBalance(b);
    expect(moveFactor("psycho")).toBe(0.25);
  });

  it("guarda a estratégia de cada mapa", () => {
    const profile = createRaidProfile(1);
    expect(mapStrategy(profile, "harbor")).toBe(DEFAULT_MATRIX_STRATEGY);
    setMapStrategy(profile, "harbor", "rat");
    setMapStrategy(profile, "cement", "psycho");
    expect(mapStrategy(profile, "harbor")).toBe("rat");
    expect(mapStrategy(profile, "cement")).toBe("psycho");
    profile.mapStrategies!.outskirts = "x";
    expect(mapStrategy(profile, "outskirts")).toBe("neutral");
    expect(isMatrixStrategy("safe")).toBe(true);
    expect(isMatrixStrategy(3)).toBe(false);
  });
});

describe("caminho", () => {
  const map = smallMap(["......", "..rrr.", "......"], [FREE]);

  it("turnos por célula: terreno × estratégia, para cima, mínimo 1", () => {
    expect(terrainTurns("rubble")).toBe(2);
    expect(stepTurns(map, [0, 0], "neutral")).toBe(1);
    expect(stepTurns(map, [0, 0], "psycho")).toBe(1);
    expect(stepTurns(map, [2, 1], "rat")).toBe(4);
    expect(stepTurns(map, [0, 0], "safe")).toBe(2);
    expect(stepTurns(map, [2, 1], "aggressive")).toBe(2);
  });

  it("anda só entre vizinhas e desvia do terreno caro", () => {
    const path = findPath(map, [0, 1], [5, 1], "neutral");
    expect(path.at(-1)).toEqual([5, 1]);
    // não atravessa os escombros em (2,1): passa por cima ou por baixo
    expect(path).not.toContainEqual([2, 1]);
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBe(1);
    }
    expect(pathTurns(map, path, "neutral")).toBe(path.length);
    expect(findPath(map, [3, 1], [3, 1], "neutral")).toEqual([]);
  });

  it("o custo extra muda o caminho", () => {
    const open = smallMap(["......", "......", "......"], [FREE]);
    const direct = findPath(open, [0, 1], [5, 1], "neutral");
    expect(direct.every(([, y]) => y === 1)).toBe(true);
    const avoid = findPath(open, [0, 1], [5, 1], "neutral", ([x, y]) =>
      y === 1 && x > 0 && x < 5 ? 10 : 0,
    );
    expect(avoid.some(([, y]) => y !== 1)).toBe(true);
  });
});

describe("planRoute", () => {
  const canUse = () => true;
  const rarity = (x: number, y: number) => (x === 4 && y === 0 ? 5 : 1);

  it("conhecimento completo e custo extra das estratégias", () => {
    const map = smallMap(["c...s.", ".S....", "......"], [FREE]);
    const k = fullKnowledge(map);
    expect([...k.containers].sort()).toEqual(["0,0", "4,0"]);
    expect([...k.spawns]).toEqual(["1,1"]);
    expect([...k.extracts]).toEqual(["exit"]);
    const rat = cellPenalty(map, "rat", k);
    expect(rat([1, 1])).toBe(6 + 2);
    expect(rat([2, 1])).toBe(6 + 2);
    expect(rat([3, 1])).toBe(2);
    expect(rat([3, 0])).toBe(0);
    const safe = cellPenalty(map, "safe", k);
    expect(safe([1, 0])).toBe(6);
    expect(safe([3, 1])).toBe(0);
    expect(cellPenalty(map, "neutral", k)([1, 1])).toBe(0);
  });

  it("extração utilizável mais perto; sem nenhuma conhecida, null", () => {
    const near = {
      id: "near",
      name: "Perto",
      x: 3,
      y: 1,
      requirement: { kind: "noBackpack" as const },
    };
    const map = smallMap(["......", "......", "......"], [FREE, near]);
    const k = fullKnowledge(map);
    expect(planRoute(map, [0, 1], "neutral", k, canUse, rarity).extract).toBe(
      near,
    );
    expect(
      planRoute(map, [0, 1], "neutral", k, (e) => !e.requirement, rarity)
        .extract,
    ).toBe(FREE);
    const none: MatrixKnowledge = { ...k, extracts: new Set() };
    expect(planRoute(map, [0, 1], "neutral", none, canUse, rarity)).toEqual({
      targets: [],
      extract: null,
    });
  });

  it("Rato e Seguro vão direto; Neutro só pega ponto de interesse no caminho", () => {
    const pois = [
      { id: "near", name: "Perto", obvious: true, cells: [[2, 1] as const] },
      { id: "far", name: "Longe", obvious: true, cells: [[2, 4] as const] },
    ];
    const map = smallMap(
      ["......", "..c...", "......", "......", "..c..."],
      [FREE],
      pois,
    );
    const k = fullKnowledge(map);
    expect(planRoute(map, [0, 1], "rat", k, canUse, rarity).targets).toEqual(
      [],
    );
    expect(planRoute(map, [0, 1], "safe", k, canUse, rarity).targets).toEqual(
      [],
    );
    expect(
      planRoute(map, [0, 1], "neutral", k, canUse, rarity).targets,
    ).toEqual([[2, 1]]);
    const unknown = { ...k, extracts: new Set<string>() };
    expect(
      planRoute(map, [0, 1], "neutral", unknown, canUse, rarity).targets,
    ).toEqual([]);
  });

  it("Agressivo vai aos contêineres raros; Psicopata a todos, sempre o mais perto", () => {
    const pois = [
      { id: "p", name: "P", obvious: true, cells: [[1, 2] as const] },
    ];
    const map = smallMap(["c...s.", "......", ".c...."], [FREE], pois);
    const k = fullKnowledge(map);
    expect(
      planRoute(map, [0, 1], "aggressive", k, canUse, rarity).targets,
    ).toEqual([
      [1, 2],
      [4, 0],
    ]);
    expect(planRoute(map, [0, 1], "psycho", k, canUse, rarity).targets).toEqual(
      [
        [0, 0],
        [1, 2],
        [4, 0],
      ],
    );
    // contêiner conhecido que não existe mais no mapa é ignorado
    const stale = { ...k, containers: new Set([...k.containers, "3,1"]) };
    expect(
      planRoute(map, [0, 1], "psycho", stale, canUse, rarity).targets,
    ).toHaveLength(3);
  });
});

describe("planRoute: Neutro com dois pontos no caminho", () => {
  it("visita do mais perto para o mais longe", () => {
    const both = smallMap(
      ["......", "..c.c.", "......"],
      [FREE],
      [
        { id: "b", name: "B", obvious: true, cells: [[4, 1] as const] },
        { id: "a", name: "A", obvious: true, cells: [[2, 1] as const] },
      ],
    );
    const plan = planRoute(
      both,
      [0, 1],
      "neutral",
      fullKnowledge(both),
      () => true,
      () => 1,
    );
    expect(plan.targets).toEqual([
      [2, 1],
      [4, 1],
    ]);
  });
});
