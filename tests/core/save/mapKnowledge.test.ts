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

const roundTrip = (knowledge: unknown) => {
  const player = createNewPlayer(new ManualClock());
  const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
  data.mapKnowledge = knowledge;
  return deserializeGame(migrate(data), catalog, new ManualClock(1)).state
    .mapKnowledge;
};

describe("save v17: conhecimento dos mapas", () => {
  it("SAVE_VERSION é pelo menos 17 e a migração 16 → 17 começa sem nada", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(17);
    expect(MIGRATIONS[16]({ version: 16 })).toEqual({
      version: 16,
      mapKnowledge: {},
    });
  });

  it("volta do save; valores inválidos são limpos", () => {
    expect(roundTrip({ harbor: { xp: 75, found: ["extract:a"] } })).toEqual({
      harbor: { xp: 75, found: ["extract:a"] },
    });
    expect(
      roundTrip({
        a: { xp: -1, found: ["x", 2] },
        b: { xp: "muito", found: "nada" },
        c: null,
      }),
    ).toEqual({ a: { xp: 0, found: ["x"] }, b: { xp: 0, found: [] } });
    expect(roundTrip(undefined)).toEqual({});
  });
});
