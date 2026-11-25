import { describe, expect, it } from "vitest";

import { CORE_DEFAULTS } from "../../../src/core/balance.ts";
import { ManualClock } from "../../../src/core/clock.ts";
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

const saved = () =>
  serializeGame(createNewPlayer(new ManualClock()), 1) as SaveData;

describe("save v18: várias obras e combustível", () => {
  it("SAVE_VERSION é pelo menos 18", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(18);
  });

  it("migração 17 → 18: gerador construído começa com o tanque cheio", () => {
    const data = saved();
    const withGenerator = {
      ...data,
      version: 17,
      hideout: { ...data.hideout!, modules: { generator: 1 } },
    };
    expect(migrate(withGenerator).hideout!.fuel).toBe(CORE_DEFAULTS.fuel.max);
    expect(migrate({ ...data, version: 17 }).hideout!.fuel).toBeUndefined();
    const noHideout = { version: 17 };
    expect(MIGRATIONS[17](noHideout)).toBe(noHideout);
  });

  it("outras obras e combustível voltam iguais", () => {
    const player = createNewPlayer(new ManualClock());
    player.hideout.construction = { module: "stash", level: 1, endsAt: 5 };
    player.hideout.extraConstructions = [
      { module: "medstation", level: 1, endsAt: 6 },
    ];
    player.hideout.fuel = 12.5;
    const state = load(serializeGame(player, 300));
    expect(state.hideout).toEqual(player.hideout);
  });

  it("dados inválidos somem", () => {
    const data = saved();
    const hideout = (extra: object) =>
      load({ ...data, hideout: { ...data.hideout, ...extra } }).hideout;
    const bad = hideout({
      extraConstructions: [
        { module: "kitchen", level: 1, endsAt: 7 },
        { module: "x", level: "1", endsAt: 1 },
        null,
      ],
      fuel: -1,
    });
    expect(bad.extraConstructions).toEqual([
      { module: "kitchen", level: 1, endsAt: 7 },
    ]);
    expect(bad.fuel).toBeUndefined();
    const none = hideout({ extraConstructions: "x", fuel: "x" });
    expect(none.extraConstructions).toBeUndefined();
    expect(none.fuel).toBeUndefined();
    expect(hideout({ extraConstructions: [null] }).extraConstructions).toBe(
      undefined,
    );
  });
});
