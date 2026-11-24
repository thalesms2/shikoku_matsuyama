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

describe("save v14: carregamento instantâneo", () => {
  it("SAVE_VERSION é pelo menos 14 e a migração 13 → 14 tira o carregamento em andamento", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(14);
    const job = {
      kind: "load",
      magazine: "i1",
      ammo: "i2",
      startedAt: 0,
      done: 0,
    };
    expect(MIGRATIONS[13]({ version: 13, nextId: 3, loader: job })).toEqual({
      version: 13,
      nextId: 3,
    });
  });

  it("um save v13 com carregamento em andamento carrega sem ele, com os cartuchos onde estavam", () => {
    const player = createNewPlayer(new ManualClock());
    const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
    const mag = data.equipment.slots.holster.magazine;
    data.version = 13;
    data.loader = { kind: "unload", magazine: mag.uid, startedAt: 0, done: 0 };
    const migrated = migrate(data);
    expect("loader" in migrated).toBe(false);
    const { state, warnings } = deserializeGame(
      migrated,
      catalog,
      new ManualClock(1),
    );
    expect(warnings).toEqual([]);
    const pistol = state.inventory.equipment.get("holster")!;
    expect(pistol.magazine!.rounds).toEqual(
      player.inventory.equipment.get("holster")!.magazine!.rounds,
    );
  });

  it("o save novo não tem o campo do carregamento", () => {
    const data = serializeGame(createNewPlayer(new ManualClock()), 1);
    expect("loader" in data).toBe(false);
  });
});
