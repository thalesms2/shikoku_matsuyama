import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import type { SaveData } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { buy } from "../../../src/core/trade/trade.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { TRADERS } from "../../../src/data/traders.ts";

const load = (data: unknown) =>
  deserializeGame(migrate(data), catalog, new ManualClock()).state;

describe("save v4: vendedores", () => {
  it("SAVE_VERSION é pelo menos 4 e há migração para cada versão", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(4);
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v]).toBeTypeOf("function");
    }
  });

  it("migração 3 → 4 começa sem histórico", () => {
    const data = serializeGame(
      createNewPlayer(new ManualClock()),
      1,
    ) as Partial<SaveData>;
    delete data.traders;
    const migrated = migrate({ ...data, version: 3 });
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.traders).toEqual({});
    expect(MIGRATIONS[3]({ version: 3 }).traders).toEqual({});
  });

  it("reputação, volume, compras e reposição voltam iguais", () => {
    const clock = new ManualClock(1000);
    const player = createNewPlayer(clock);
    expect(buy(player, TRADERS[0], "pistol", 1000).ok).toBe(true);
    const state = load(serializeGame(player, 2000));
    expect(state.traders).toEqual(player.traders);
    expect(state.traders).not.toBe(player.traders);
  });

  it("campos inválidos voltam ao padrão", () => {
    const data = serializeGame(
      createNewPlayer(new ManualClock()),
      1,
    ) as SaveData;
    expect(load({ ...data, traders: undefined }).traders).toEqual({});
    const traders = load({
      ...data,
      traders: {
        a: {
          reputation: "x",
          volume: 50,
          bought: { ok: 2, zero: 0, frac: 1.5, txt: "3" },
          restockAt: null,
        },
        b: null,
      },
    }).traders;
    expect(traders).toEqual({
      a: { reputation: 0, volume: 50, bought: { ok: 2 }, restockAt: 0 },
      b: { reputation: 0, volume: 0, bought: {}, restockAt: 0 },
    });
  });
});
