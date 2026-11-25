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

const roundTrip = (strategies: unknown) => {
  const player = createNewPlayer(new ManualClock());
  const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
  data.raid.mapStrategies = strategies;
  return deserializeGame(migrate(data), catalog, new ManualClock(1)).state.raid;
};

describe("save v16: estratégia por mapa", () => {
  it("SAVE_VERSION é pelo menos 16 e a migração 15 → 16 não muda nada", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(16);
    const data = { version: 15 };
    expect(MIGRATIONS[15](data)).toBe(data);
  });

  it("guarda só estratégias conhecidas; sem nenhuma válida, sem o campo", () => {
    expect(roundTrip({ harbor: "rat", cement: "x" }).mapStrategies).toEqual({
      harbor: "rat",
    });
    expect("mapStrategies" in roundTrip({ cement: 1 })).toBe(false);
    expect("mapStrategies" in roundTrip(null)).toBe(false);
  });
});
