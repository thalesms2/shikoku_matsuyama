import { afterEach, describe, expect, it } from "vitest";

import {
  CORE_DEFAULTS,
  resetCoreBalance,
  setCoreBalance,
} from "../../../src/core/balance.ts";
import {
  createMapKnowledge,
  knowledgeFor,
  knowledgeLevel,
  learnFromRaid,
  revealOrder,
} from "../../../src/core/matrix/knowledge.ts";
import { runMatrixRaid } from "../../../src/core/matrix/raid.ts";
import { CONTAINERS } from "../../../src/data/containers.ts";
import { matrixMapById } from "../../../src/data/matrixMaps.ts";
import { ScriptRng, emptyPlayer } from "../raid/raidFixtures.ts";
import { smallMap } from "./matrixFixtures.ts";

afterEach(() => {
  resetCoreBalance();
});

const pois = [
  { id: "obvious", name: "Óbvio", obvious: true, cells: [[1, 0] as const] },
  { id: "hidden", name: "Escondido", obvious: false, cells: [[2, 0] as const] },
];
const map = smallMap(
  [".cc..", "..S..", "...c."],
  [{ id: "exit", name: "Saída", x: 4, y: 1 }],
  pois,
);

describe("conhecimento do mapa", () => {
  it("nível pelo XP", () => {
    expect(knowledgeLevel({ xp: 59, found: [] })).toBe(0);
    expect(knowledgeLevel({ xp: 120, found: [] })).toBe(2);
  });

  it("ordem de revelação: sempre a mesma, com todos os pontos que não são óbvios", () => {
    const order = revealOrder(map);
    expect(order).toEqual(revealOrder(map));
    expect([...order].sort()).toEqual(
      [
        "extract:exit",
        "poi:hidden",
        "spawn:2,1",
        "container:1,0",
        "container:2,0",
        "container:3,2",
      ].sort(),
    );
    expect(revealOrder(matrixMapById("harbor")!)).not.toEqual(
      revealOrder(matrixMapById("cement")!),
    );
  });

  it("no começo só os pontos óbvios; o que achou e o nível revelam mais", () => {
    const start = knowledgeFor(map);
    expect([...start.pois]).toEqual(["obvious"]);
    expect(start.extracts.size).toBe(0);
    const found = knowledgeFor(map, {
      xp: 0,
      found: ["extract:exit", "container:3,2", "spawn:2,1", "poi:hidden"],
    });
    expect([...found.extracts]).toEqual(["exit"]);
    expect([...found.containers]).toEqual(["3,2"]);
    expect([...found.spawns]).toEqual(["2,1"]);
    expect([...found.pois].sort()).toEqual(["hidden", "obvious"]);
    const leveled = knowledgeFor(map, { xp: 60, found: [] });
    const size = (k: ReturnType<typeof knowledgeFor>) =>
      k.extracts.size + k.containers.size + k.spawns.size + k.pois.size - 1;
    expect(size(leveled)).toBe(2);
    expect(size(knowledgeFor(map, { xp: 600, found: [] }))).toBe(6);
  });

  it("aprende com a raid: células, sobreviver, contêineres novos e a extração", () => {
    const record = createMapKnowledge();
    const path = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ] as const;
    expect(learnFromRaid(record, map, path, true, "exit")).toBe(4 + 20 + 5 + 5);
    expect(record.found.sort()).toEqual(
      ["container:1,0", "container:2,0", "extract:exit"].sort(),
    );
    // de novo: os mesmos contêineres não dão XP; morrer não dá o fixo
    expect(learnFromRaid(record, map, path, false, null)).toBe(4);
    expect(record.xp).toBe(38);
  });

  it("os números vêm do balanceamento", () => {
    const b = structuredClone(CORE_DEFAULTS);
    b.knowledge = {
      cellXp: 2,
      surviveXp: 0,
      containerXp: 0,
      xpPerLevel: 10,
      revealPerLevel: 1,
    };
    setCoreBalance(b);
    expect(knowledgeLevel({ xp: 25, found: [] })).toBe(2);
    expect(learnFromRaid(createMapKnowledge(), map, [[0, 0]], true, null)).toBe(
      2,
    );
  });

  it("sem conhecer a extração, a raid procura pela borda", () => {
    const rng = new ScriptRng();
    rng.ints = [1];
    const result = runMatrixRaid({
      player: emptyPlayer(),
      map,
      strategy: "neutral",
      rng,
      containers: CONTAINERS,
      knowledge: knowledgeFor(map),
    });
    expect(result.events.map((e) => e.kind)).toContain("search");
  });
});
