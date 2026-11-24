import { describe, expect, it } from "vitest";

import { recordRaidQuests } from "../../../src/core/quests/quests.ts";
import type { QuestContext, QuestDef } from "../../../src/core/quests/types.ts";
import type { ActiveRaid, RaidSummary } from "../../../src/core/raid/types.ts";
import { MAPS } from "../../../src/data/maps.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import { trader } from "../trade/tradeFixtures.ts";

const HUNT: QuestDef = {
  id: "hunt",
  name: "Caçada",
  trader: "colonel",
  description: "",
  requires: {},
  objectives: [
    { kind: "kill", target: "scav", count: 5 },
    { kind: "kill", target: "pmc", count: 1 },
    { kind: "find", item: "food_water", count: 1 },
  ],
  rewards: {},
};

const EXIT: QuestDef = {
  id: "exit",
  name: "Saída",
  trader: "colonel",
  description: "",
  requires: {},
  objectives: [{ kind: "extract", count: 1 }],
  rewards: {},
};

const IDLE: QuestDef = { ...EXIT, id: "idle", name: "Parada", objectives: [] };

const CTX: QuestContext = {
  quests: [HUNT, EXIT, IDLE],
  traders: TRADERS,
  maps: MAPS,
};

const SUMMARY: RaidSummary = {
  outcome: "extracted",
  map: "outskirts",
  strategy: "balanced",
  minutes: 20,
  kills: { scav: 2, pmc: 0 },
  loot: [],
  lootValue: 0,
  lost: [],
  xp: 0,
  skillXp: {},
  karma: 0,
  extract: "Saída",
  killedBy: null,
};

const raidOf = (summary: RaidSummary = SUMMARY): ActiveRaid => ({
  startedAt: 0,
  events: [],
  summary,
});

describe("recordRaidQuests", () => {
  it("guarda na raid os objetivos que avançaram e se a quest ficou pronta", () => {
    const { player } = trader();
    player.quests.hunt = { status: "active", progress: [1] };
    player.quests.exit = { status: "active", progress: [0] };
    player.quests.idle = { status: "active", progress: [] };
    const raid = raidOf();
    const updates = recordRaidQuests(player, CTX, raid);
    expect(updates).toEqual([
      {
        quest: "hunt",
        name: "Caçada",
        objectives: [{ index: 0, from: 1, to: 3, count: 5 }],
        ready: false,
      },
      {
        quest: "exit",
        name: "Saída",
        objectives: [{ index: 0, from: 0, to: 1, count: 1 }],
        ready: true,
      },
    ]);
    expect(raid.quests).toBe(updates);
    expect(player.quests.hunt.progress).toEqual([3, 0, 0]);
  });

  it("nada avançou (ou raid Scav): lista vazia", () => {
    const { player } = trader();
    player.quests.hunt = { status: "active", progress: [0, 0, 0] };
    const raid = raidOf({
      ...SUMMARY,
      kills: { scav: 0, pmc: 0 },
      outcome: "killed",
    });
    expect(recordRaidQuests(player, CTX, raid)).toEqual([]);
    expect(raid.quests).toEqual([]);
    const scav = raidOf({
      ...SUMMARY,
      scav: { stored: [], storedValue: 0, left: [] },
    });
    expect(recordRaidQuests(player, CTX, scav)).toEqual([]);
  });
});
