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

const roundTrip = (progress: unknown) => {
  const player = createNewPlayer(new ManualClock());
  const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
  data.hideout.surgeryProgress = progress;
  return deserializeGame(migrate(data), catalog, new ManualClock(1)).state
    .hideout.surgeryProgress;
};

describe("save v11: cirurgia da enfermaria", () => {
  it("SAVE_VERSION é pelo menos 11 e a migração 10 → 11 não muda nada", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(11);
    const data = { version: 10 };
    expect(MIGRATIONS[10](data)).toBe(data);
  });

  it("o progresso volta; inválido, zero ou negativo some", () => {
    expect(roundTrip(12.5)).toBe(12.5);
    expect(roundTrip(0)).toBeUndefined();
    expect(roundTrip(-3)).toBeUndefined();
    expect(roundTrip("x")).toBeUndefined();
    expect(roundTrip(undefined)).toBeUndefined();
  });
});
