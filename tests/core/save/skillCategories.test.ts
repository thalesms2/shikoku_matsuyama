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

describe("save v15: skills por categoria", () => {
  it("SAVE_VERSION é pelo menos 15 e a migração 14 → 15 não muda nada", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(15);
    const data = { version: 14 };
    expect(MIGRATIONS[14](data)).toBe(data);
  });

  it("save v14 só com as skills antigas carrega com as novas em 0", () => {
    const player = createNewPlayer(new ManualClock());
    player.skills.aim = 55;
    const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
    data.version = 14;
    delete data.skills.pistols;
    delete data.skills.charisma;
    const { state } = deserializeGame(
      migrate(data),
      catalog,
      new ManualClock(1),
    );
    expect(state.skills.aim).toBe(55);
    expect(state.skills.pistols).toBe(0);
    expect(state.skills.charisma).toBe(0);
  });
});
