import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import type { Loadout } from "../../../src/core/loadout/types.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import type { SaveData } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const load = (data: unknown) =>
  deserializeGame(migrate(data), catalog, new ManualClock(1)).state;
const saved = () =>
  serializeGame(createNewPlayer(new ManualClock()), 1) as SaveData;

describe("save v8: loadouts", () => {
  it("SAVE_VERSION é pelo menos 8 e há migração para cada versão", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(8);
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v]).toBeTypeOf("function");
    }
  });

  it("migração 7 → 8 começa sem loadouts", () => {
    const data = saved() as Partial<SaveData>;
    delete data.loadouts;
    const migrated = migrate({ ...data, version: 7 });
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.loadouts).toEqual([]);
  });

  it("loadouts voltam iguais (e não são o mesmo objeto)", () => {
    const player = createNewPlayer(new ManualClock());
    player.loadouts = [
      {
        name: "Furtivo",
        slots: { primary: "rifle_vk74", rig: "rig_cargo" },
        magazines: { primary: "mag_vk74" },
        carried: [{ item: "ammo_545", count: 60 }],
      },
    ];
    const state = load(JSON.parse(JSON.stringify(serializeGame(player, 1))));
    expect(state.loadouts).toEqual(player.loadouts);
  });

  it("dados inválidos somem; sem loadouts no save, lista vazia", () => {
    const data = saved();
    data.loadouts = [
      {
        name: "Ok",
        slots: { primary: "rifle_vk74", bolso: "x", helmet: 3 },
        magazines: null,
        carried: [
          { item: "ammo_545", count: 10 },
          { item: "ammo_545", count: 0 },
          { item: "ammo_545", count: 1.5 },
          { item: 4, count: 1 },
          null,
        ],
      },
      { name: 3 },
      null,
      { name: "Sem nada" },
    ] as unknown as Loadout[];
    expect(load(data).loadouts).toEqual([
      {
        name: "Ok",
        slots: { primary: "rifle_vk74" },
        magazines: {},
        carried: [{ item: "ammo_545", count: 10 }],
      },
      { name: "Sem nada", slots: {}, magazines: {}, carried: [] },
    ]);
    data.loadouts = "x" as unknown as Loadout[];
    expect(load(data).loadouts).toEqual([]);
    delete data.loadouts;
    expect(load(data).loadouts).toEqual([]);
  });
});
