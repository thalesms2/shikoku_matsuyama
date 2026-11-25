import { afterEach, describe, expect, it } from "vitest";

import { resetCoreBalance } from "../../../src/core/balance.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import {
  fillRatio,
  findChance,
  fullThreshold,
  leavesWhenFull,
  searchTurns,
  stashFound,
  wantsSearch,
} from "../../../src/core/matrix/loot.ts";
import { fullKnowledge } from "../../../src/core/matrix/plan.ts";
import { runMatrixRaid } from "../../../src/core/matrix/raid.ts";
import { createSkills, skillXpForLevel } from "../../../src/core/pmc/skills.ts";
import { CONTAINERS } from "../../../src/data/containers.ts";
import { ScriptRng, emptyPlayer } from "../raid/raidFixtures.ts";
import { smallMap } from "./matrixFixtures.ts";

afterEach(() => {
  resetCoreBalance();
});

describe("regras de revista", () => {
  it("turnos: conhecido e estratégia rápida descontam, mínimo 1", () => {
    expect(searchTurns(CONTAINERS.safe, "neutral", false)).toBe(5);
    expect(searchTurns(CONTAINERS.safe, "neutral", true)).toBe(4);
    expect(searchTurns(CONTAINERS.safe, "aggressive", true)).toBe(3);
    expect(searchTurns(CONTAINERS.jacket, "psycho", true)).toBe(1);
    expect(
      searchTurns({ ...CONTAINERS.jacket, searchTurns: 1 }, "psycho", true),
    ).toBe(1);
  });

  it("chance de achar: Percepção ajuda, Seguro acha menos, até 1", () => {
    const skills = createSkills();
    expect(findChance(CONTAINERS.jacket, "neutral", skills)).toBeCloseTo(0.8);
    expect(findChance(CONTAINERS.jacket, "safe", skills)).toBeCloseTo(0.64);
    skills.perception = skillXpForLevel(50);
    expect(findChance(CONTAINERS.jacket, "neutral", skills)).toBe(1);
  });

  it("o Seguro pula revistas longas; os outros revistam tudo", () => {
    expect(wantsSearch("safe", 4)).toBe(true);
    expect(wantsSearch("safe", 5)).toBe(false);
    expect(wantsSearch("rat", 5)).toBe(true);
  });

  it("quando o inventário manda para a extração", () => {
    expect(fullThreshold("rat")).toBe(0.8);
    expect(fullThreshold("neutral")).toBe(0.9);
    expect(fullThreshold("aggressive")).toBeNull();
    expect(fullThreshold("psycho")).toBeNull();
    expect(leavesWhenFull("aggressive")).toBe(true);
    expect(leavesWhenFull("psycho")).toBe(false);
    expect(leavesWhenFull("safe")).toBe(false);
  });

  it("fração ocupada das grades", () => {
    const { factory } = emptyPlayer();
    const grid = new Grid(2, 2);
    expect(fillRatio([grid])).toBe(0);
    grid.place(factory.create("food_juice"), 0, 0);
    expect(fillRatio([grid])).toBe(0.5);
    expect(fillRatio([])).toBe(1);
  });
});

describe("stashFound", () => {
  function setup() {
    const { factory } = emptyPlayer();
    const grid = new Grid(1, 1);
    const origin = new Map<Item, number>();
    return { factory, grid, origin };
  }

  it("guarda com espaço e anota a raridade de origem", () => {
    const { factory, grid, origin } = setup();
    const bolts = factory.create("barter_bolts");
    expect(stashFound(bolts, 1, [grid], origin, "neutral")).toEqual({
      stored: true,
      dropped: [],
    });
    expect(origin.get(bolts)).toBe(1);
  });

  it("Agressivo e Psicopata trocam item de contêiner menos raro; os outros não", () => {
    const { factory, grid, origin } = setup();
    const bolts = factory.create("barter_bolts");
    stashFound(bolts, 1, [grid], origin, "aggressive");
    const watch = factory.create("barter_watch");
    expect(stashFound(watch, 1, [grid], origin, "aggressive").stored).toBe(
      false,
    );
    expect(stashFound(watch, 4, [grid], origin, "neutral").stored).toBe(false);
    expect(stashFound(watch, 4, [grid], origin, "psycho")).toEqual({
      stored: true,
      dropped: [bolts],
    });
    expect(grid.items()).toEqual([watch]);
    expect(origin.has(bolts)).toBe(false);
    expect(origin.get(watch)).toBe(4);
  });

  it("se nem largando couber, tudo volta para o lugar", () => {
    const { factory, origin } = setup();
    const grid = new Grid(2, 1);
    const a = factory.create("barter_bolts");
    const b = factory.create("barter_tape");
    stashFound(a, 1, [grid], origin, "aggressive");
    stashFound(b, 3, [grid], origin, "aggressive");
    const big = factory.create("barter_battery");
    expect(stashFound(big, 5, [grid], origin, "aggressive")).toEqual({
      stored: false,
      dropped: [],
    });
    expect(grid.items().sort()).toEqual([a, b].sort());
    // item fora da grade (largado antes) não entra na troca
    a.location = null;
    expect(
      stashFound(
        factory.create("barter_wires"),
        5,
        [new Grid(1, 1)],
        origin,
        "psycho",
      ).stored,
    ).toBe(true);
  });
});

describe("runMatrixRaid: loot", () => {
  const EXIT = { id: "exit", name: "Saída", x: 4, y: 1 };
  function rig() {
    const p = emptyPlayer();
    p.inventory.equipment.equip("rig", p.factory.create("rig_cargo"));
    return p;
  }

  it("revista o que está no caminho: acha, ou não acha nada", () => {
    const map = smallMap([".....", ".cc..", "....."], [EXIT]);
    const p = rig();
    const rng = new ScriptRng();
    rng.ints = [1];
    rng.chances = [true, false, false];
    const result = runMatrixRaid({
      player: p,
      map,
      strategy: "neutral",
      rng,
      containers: CONTAINERS,
      knowledge: { ...fullKnowledge(map), containers: new Set<string>() },
    });
    const texts = result.events.map((e) => e.text);
    expect(texts).toContain("Achou Parafusos em Caixote");
    expect(texts).toContain("Revistou Caixote e não achou nada");
    expect(result.found.map((i) => i.def.id)).toEqual(["barter_bolts"]);
    // 4 células + 2 revistas de 3 turnos
    expect(result.turns).toBe(4 + 3 + 3);
    expect(p.skills.perception).toBe(2);
  });

  it("o Seguro pula a revista longa; contêiner conhecido revista mais rápido", () => {
    const map = smallMap([".....", ".s...", "....."], [EXIT]);
    const rng = new ScriptRng();
    rng.ints = [1];
    const safe = runMatrixRaid({
      player: rig(),
      map,
      strategy: "safe",
      rng,
      containers: CONTAINERS,
      knowledge: { ...fullKnowledge(map), containers: new Set<string>() },
    });
    expect(safe.events.map((e) => e.kind)).not.toContain("search");
    const rng2 = new ScriptRng();
    rng2.ints = [1];
    const known = runMatrixRaid({
      player: rig(),
      map,
      strategy: "neutral",
      rng: rng2,
      containers: CONTAINERS,
      knowledge: fullKnowledge(map),
    });
    expect(known.turns).toBe(4 + 4);
  });

  it("inventário cheio: o Rato larga a rota e vai para a extração", () => {
    const map = smallMap(
      [".ccccc.", ".......", "......."],
      [{ ...EXIT, x: 6, y: 0 }],
    );
    const p = emptyPlayer();
    const rng = new ScriptRng();
    rng.ints = [0];
    rng.chances = Array.from({ length: 10 }, (_, i) => i % 2 === 0);
    const result = runMatrixRaid({
      player: p,
      map,
      strategy: "rat",
      rng,
      containers: CONTAINERS,
    });
    const texts = result.events.map((e) => e.text);
    // 4 bolsos: o 4º item enche 100% (≥ 80%)
    expect(texts.filter((t) => t.startsWith("Achou"))).toHaveLength(4);
    expect(texts).toContain("Inventário cheio: indo para a extração");
  });

  it("item que não cabe: Agressivo vai para a extração; o Seguro segue", () => {
    const map = smallMap([".....", ".cc..", "....."], [EXIT]);
    for (const [strategy, leaves] of [
      ["aggressive", true],
      ["safe", false],
    ] as const) {
      const p = emptyPlayer();
      for (const pocket of p.inventory.equipment.pockets) {
        pocket.place(p.factory.create("barter_tape"), 0, 0);
      }
      const rng = new ScriptRng();
      rng.ints = [1];
      rng.chances = [true, false, true, false];
      const result = runMatrixRaid({
        player: p,
        map,
        strategy,
        rng,
        containers: CONTAINERS,
      });
      const texts = result.events.map((e) => e.text);
      expect(texts).toContain("Sem espaço: deixou Parafusos");
      expect(texts.includes("Inventário cheio: indo para a extração")).toBe(
        leaves,
      );
    }
  });

  it("o Psicopata troca por item de contêiner mais raro", () => {
    const map = smallMap([".....", ".cs..", "....."], [EXIT]);
    const p = emptyPlayer();
    for (const pocket of p.inventory.equipment.pockets.slice(1)) {
      pocket.place(p.factory.create("barter_tape"), 0, 0);
    }
    const rng = new ScriptRng();
    rng.ints = [1];
    rng.chances = [true, false, true, false];
    const result = runMatrixRaid({
      player: p,
      map,
      strategy: "psycho",
      rng,
      containers: CONTAINERS,
    });
    const texts = result.events.map((e) => e.text);
    expect(texts).toContain("Largou Parafusos para levar algo melhor");
    expect(result.found.map((i) => i.def.id)).toContain("money_rub");
  });
});

describe("runMatrixRaid: Neutro larga a rota quando enche", () => {
  it("não chega ao ponto de interesse e vai para a extração", () => {
    const pois = [
      { id: "far", name: "Longe", obvious: true, cells: [[5, 1] as const] },
    ];
    const map = smallMap(
      [".......", ".ccccc.", "......."],
      [{ id: "exit", name: "Saída", x: 6, y: 1 }],
      pois,
    );
    const p = emptyPlayer();
    const rng = new ScriptRng();
    rng.ints = [1];
    rng.chances = Array.from({ length: 10 }, (_, i) => i % 2 === 0);
    const result = runMatrixRaid({
      player: p,
      map,
      strategy: "neutral",
      rng,
      containers: CONTAINERS,
    });
    const texts = result.events.map((e) => e.text);
    expect(texts).toContain("Inventário cheio: indo para a extração");
    expect(texts).not.toContain("Chegou em Longe");
    expect(result.extract.id).toBe("exit");
  });
});
