import { describe, expect, it } from "vitest";

import { createAutoState } from "../../../src/core/auto/auto.ts";
import type { AutoState } from "../../../src/core/auto/types.ts";
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

const load = (data: unknown, now = 5) =>
  deserializeGame(migrate(data), catalog, new ManualClock(now)).state;
const saved = () =>
  serializeGame(createNewPlayer(new ManualClock()), 1) as SaveData;

describe("save v9: raids automáticas", () => {
  it("SAVE_VERSION é pelo menos 9 e há migração para cada versão", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(9);
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v]).toBeTypeOf("function");
    }
  });

  it("migração 8 → 9 começa parada, com as regras padrão", () => {
    const data = saved() as Partial<SaveData>;
    delete data.auto;
    const migrated = migrate({ ...data, version: 8 });
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.auto).toEqual(createAutoState());
  });

  it("regras, andamento e histórico voltam iguais", () => {
    const player = createNewPlayer(new ManualClock());
    player.auto = {
      rules: {
        map: "port",
        strategy: "stealth",
        loadout: "L",
        buyMissing: true,
        maxRaids: 10,
        minHealth: 0.8,
        lowHealth: "stop",
        stopOnDeath: false,
      },
      running: true,
      done: 2,
      nextAt: 900,
      current: 300,
      log: [
        {
          n: 2,
          map: "port",
          outcome: "killed",
          minutes: 12,
          lootValue: 0,
          xp: 0,
          kills: 1,
        },
      ],
      stopReason: null,
    };
    const state = load(JSON.parse(JSON.stringify(serializeGame(player, 1))));
    expect(state.auto).toEqual(player.auto);
  });

  it("dados inválidos voltam ao padrão", () => {
    const data = saved();
    data.auto = {
      rules: {
        map: 3,
        strategy: "doido",
        loadout: 7,
        buyMissing: "sim",
        maxRaids: 999,
        minHealth: 5,
        lowHealth: "fugir",
        stopOnDeath: null,
      },
      running: "sim",
      done: -1,
      nextAt: "logo",
      current: "x",
      log: [
        {
          n: 1,
          map: "a",
          outcome: "extracted",
          minutes: 1,
          lootValue: 1,
          xp: 1,
          kills: 0,
        },
        {
          n: 1,
          map: "a",
          outcome: "venceu",
          minutes: 1,
          lootValue: 1,
          xp: 1,
          kills: 0,
        },
        {
          n: 1,
          map: 2,
          outcome: "mia",
          minutes: 1,
          lootValue: 1,
          xp: 1,
          kills: 0,
        },
        {
          n: 1,
          map: "a",
          outcome: "mia",
          minutes: "x",
          lootValue: 1,
          xp: 1,
          kills: 0,
        },
        null,
      ],
      stopReason: 4,
    } as unknown as AutoState;
    const { auto } = load(data, 77);
    expect(auto).toEqual({
      rules: { ...createAutoState().rules, minHealth: 1 },
      running: false,
      done: 0,
      nextAt: 77,
      current: null,
      log: [
        {
          n: 1,
          map: "a",
          outcome: "extracted",
          minutes: 1,
          lootValue: 1,
          xp: 1,
          kills: 0,
        },
      ],
      stopReason: null,
    });
    data.auto = {
      log: "x",
      done: 1.5,
      stopReason: "Motivo",
    } as unknown as AutoState;
    expect(load(data).auto).toMatchObject({
      log: [],
      done: 0,
      stopReason: "Motivo",
    });
    delete data.auto;
    expect(load(data).auto).toEqual(createAutoState());
  });
});
