// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import type { QuestContext } from "../../../src/core/quests/types.ts";
import type { ActiveRaid, QuestUpdate } from "../../../src/core/raid/types.ts";
import { catalog } from "../../../src/data/items.ts";
import { MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { QUESTS } from "../../../src/data/quests.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import {
  MAX_QUEST_LINES,
  RaidScene,
  clampLines,
  questLines,
} from "../../../src/ui/scenes/RaidScene.ts";

const CTX: QuestContext = { quests: QUESTS, traders: TRADERS, maps: MAPS };

const CLEANUP: QuestUpdate = {
  quest: "cleanup",
  name: "Limpeza",
  objectives: [{ index: 0, from: 1, to: 3, count: 5 }],
  ready: false,
};
const RECON: QuestUpdate = {
  quest: "recon",
  name: "Reconhecimento",
  objectives: [{ index: 0, from: 0, to: 1, count: 1 }],
  ready: true,
};

describe("questLines", () => {
  it("descreve cada objetivo que avançou; pronta vira uma linha só", () => {
    expect(questLines([CLEANUP, RECON], catalog, CTX)).toEqual([
      'Quest "Limpeza": Abater 5 Scav(s): 1 → 3/5',
      'Quest "Reconhecimento": pronta para concluir ✓',
    ]);
  });

  it("sem as quests do jogo, ou quest que saiu do jogo, usa o número", () => {
    expect(questLines([CLEANUP], catalog)).toEqual([
      'Quest "Limpeza": Objetivo 1: 1 → 3/5',
    ]);
    const gone = { ...CLEANUP, quest: "sumiu", name: "Antiga" };
    expect(questLines([gone], catalog, CTX)).toEqual([
      'Quest "Antiga": Objetivo 1: 1 → 3/5',
    ]);
  });

  it(`passou de ${MAX_QUEST_LINES} linhas, o resto vira "e mais N"`, () => {
    const lines = ["a", "b", "c", "d"];
    expect(clampLines(lines)).toEqual(lines);
    expect(clampLines([...lines, "e", "f"])).toEqual([
      "a",
      "b",
      "c",
      "... e mais 3 avanço(s) em Quests",
    ]);
  });
});

describe("RaidScene: quests no resumo", () => {
  function scene(quests?: QuestUpdate[], ctx?: QuestContext) {
    const player = createNewPlayer(new ManualClock());
    const raid: ActiveRaid = {
      startedAt: 0,
      events: [{ t: 0, kind: "start", text: "Entrou" }],
      summary: {
        outcome: "extracted",
        map: "outskirts",
        strategy: "balanced",
        minutes: 0,
        kills: { scav: 2, pmc: 0 },
        loot: [],
        lootValue: 0,
        lost: [],
        xp: 300,
        skillXp: {},
        karma: 0,
        extract: "Estrada do Posto",
        killedBy: null,
      },
      ...(quests && { quests }),
    };
    player.raid.active = raid;
    return new RaidScene(player, {
      clock: new ManualClock(0),
      map: MAPS[0],
      onDone: vi.fn(),
      quests: ctx,
    });
  }

  it("o resumo termina com as quests que avançaram", () => {
    const text = scene([CLEANUP], CTX).summaryText.text;
    expect(text.split("\n").at(-1)).toBe(
      'Quest "Limpeza": Abater 5 Scav(s): 1 → 3/5',
    );
  });

  it("sem quests guardadas, o resumo não muda", () => {
    expect(scene().summaryText.text).not.toContain("Quest");
  });
});
