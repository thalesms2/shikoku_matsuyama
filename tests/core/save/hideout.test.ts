import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createHideoutState } from "../../../src/core/hideout/hideout.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import type { SaveData } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const load = (data: unknown, now = 9000) =>
  deserializeGame(migrate(data), catalog, new ManualClock(now)).state;

describe("save v6: esconderijo", () => {
  it("SAVE_VERSION é pelo menos 6 e há migração para cada versão", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(6);
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v]).toBeTypeOf("function");
    }
  });

  it("migração 5 → 6 começa vazio, contando do savedAt", () => {
    const data = serializeGame(
      createNewPlayer(new ManualClock()),
      700,
    ) as Partial<SaveData>;
    delete data.hideout;
    const migrated = migrate({ ...data, version: 5 });
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.hideout).toEqual(createHideoutState(700));
    expect(MIGRATIONS[5]({ version: 5 }).hideout).toEqual(
      createHideoutState(0),
    );
  });

  it("módulos, obra, produções, renda e estoque maior voltam iguais", () => {
    const player = createNewPlayer(new ManualClock());
    player.hideout = {
      modules: { stash: 1, generator: 2 },
      construction: { module: "medstation", level: 1, endsAt: 5000 },
      productions: { workbench: { recipe: "ammo-9mm", endsAt: 6000 } },
      incomeSince: 100,
      lastTick: 200,
    };
    player.inventory.stash.addRows(3);
    const state = load(serializeGame(player, 300));
    expect(state.hideout).toEqual(player.hideout);
    expect(state.hideout).not.toBe(player.hideout);
    expect(state.inventory.stash.height).toBe(player.inventory.stash.height);
  });

  it("dados inválidos voltam ao padrão", () => {
    const data = serializeGame(
      createNewPlayer(new ManualClock()),
      1,
    ) as SaveData;
    expect(load({ ...data, hideout: undefined }).hideout).toEqual(
      createHideoutState(9000),
    );
    const hideout = load({
      ...data,
      hideout: {
        modules: { a: 2, b: 0, c: 1.5, d: "x" },
        construction: { module: "a", level: "x", endsAt: 1 },
        productions: {
          ok: { recipe: "r", endsAt: 5 },
          semReceita: { endsAt: 5 },
          nula: null,
        },
        incomeSince: "x",
      },
    }).hideout;
    expect(hideout).toEqual({
      modules: { a: 2 },
      construction: null,
      productions: { ok: { recipe: "r", endsAt: 5 } },
      incomeSince: 9000,
      lastTick: 9000,
    });
    expect(
      load({ ...data, hideout: { construction: null } }).hideout.modules,
    ).toEqual({});
  });
});
