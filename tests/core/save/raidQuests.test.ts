import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import type { ActiveRaid } from "../../../src/core/raid/types.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const UPDATE = {
  quest: "cleanup",
  name: "Limpeza",
  objectives: [{ index: 0, from: 1, to: 3, count: 5 }],
  ready: false,
};

/** Salva uma raid em andamento com `quests` e carrega de volta */
function roundTrip(quests: unknown) {
  const player = createNewPlayer(new ManualClock());
  player.raid.active = {
    startedAt: 0,
    events: [],
    summary: {} as ActiveRaid["summary"],
  };
  const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
  data.raid.active.quests = quests;
  return deserializeGame(migrate(data), catalog, new ManualClock(1)).state.raid
    .active!;
}

describe("save v13: quests no resumo da raid", () => {
  it("SAVE_VERSION é pelo menos 13 e a migração 12 → 13 não muda nada", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(13);
    const data = { version: 12 };
    expect(MIGRATIONS[12](data)).toBe(data);
  });

  it("as quests da raid voltam; entradas inválidas somem", () => {
    expect(roundTrip([UPDATE]).quests).toEqual([UPDATE]);
    const bad = [
      null,
      "x",
      { ...UPDATE, quest: 1 },
      { ...UPDATE, name: null },
      { ...UPDATE, ready: "sim" },
      { ...UPDATE, objectives: "nada" },
      { ...UPDATE, objectives: [null] },
      { ...UPDATE, objectives: [{ index: 0, from: 0, to: "1", count: 1 }] },
      UPDATE,
    ];
    expect(roundTrip(bad).quests).toEqual([UPDATE]);
  });

  it("sem lista, a raid volta sem quests", () => {
    expect("quests" in roundTrip(undefined)).toBe(false);
    expect("quests" in roundTrip({ a: 1 })).toBe(false);
  });
});
