import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const KILL = {
  id: "repeat-3",
  trader: "colonel",
  objective: { kind: "kill", target: "scav", count: 4 },
  money: 20000,
  xp: 600,
  reputation: 0.02,
};
const FIND = {
  id: "repeat-1",
  trader: "doctor",
  objective: { kind: "find", item: "med_kit", count: 2 },
  money: 100,
  xp: 300,
  reputation: 0,
};

const roundTrip = (repeatable: unknown) => {
  const player = createNewPlayer(new ManualClock());
  const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
  data.repeatable = repeatable;
  return deserializeGame(migrate(data), catalog, new ManualClock(7)).state
    .repeatable;
};

describe("save v19: quests repetíveis", () => {
  it("SAVE_VERSION 19; migração 17 → 18 sem mudança e 18 → 19 sem ofertas", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(19);
    expect(MIGRATIONS[17]({ version: 17 })).toEqual({ version: 17 });
    expect(MIGRATIONS[18]({ version: 18, savedAt: 5 })).toEqual({
      version: 18,
      savedAt: 5,
      repeatable: { seed: 5, next: 1, offers: [] },
    });
    expect(MIGRATIONS[18]({ version: 18 })).toMatchObject({
      repeatable: { seed: 0 },
    });
  });

  it("volta do save; valores inválidos são limpos", () => {
    const state = { seed: 9, next: 4, offers: [KILL, FIND] };
    expect(roundTrip(state)).toEqual(state);
    expect(
      roundTrip({
        seed: -1,
        next: 0,
        offers: [
          FIND,
          null,
          { ...KILL, id: 3 },
          { ...KILL, trader: null },
          { ...KILL, objective: null },
          { ...KILL, objective: { ...KILL.objective, count: 0 } },
          { ...KILL, objective: { ...KILL.objective, target: "pmc" } },
          { ...FIND, objective: { ...FIND.objective, item: "sumiu" } },
          { ...FIND, objective: { ...FIND.objective, item: 1 } },
          { ...FIND, objective: { kind: "outro", count: 1 } },
          { ...KILL, money: -1 },
          { ...KILL, xp: "x" },
          { ...KILL, reputation: Number.NaN },
          { ...KILL, id: "estranho" },
        ],
      }),
    ).toEqual({
      seed: 7,
      next: 2,
      offers: [FIND, { ...KILL, id: "estranho" }],
    });
    expect(roundTrip(undefined)).toEqual({ seed: 7, next: 1, offers: [] });
    expect(roundTrip({ offers: "nada" })).toEqual({
      seed: 7,
      next: 1,
      offers: [],
    });
  });
});
