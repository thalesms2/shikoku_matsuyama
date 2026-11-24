import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { autoPlace } from "../../../src/core/inventory/operations.ts";
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
  deserializeGame(migrate(data), catalog, new ManualClock()).state;

describe("save v5: quests e itens encontrados na raid", () => {
  it("SAVE_VERSION é pelo menos 5 e há migração para cada versão", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(5);
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v]).toBeTypeOf("function");
    }
  });

  it("migração 4 → 5 começa sem quests", () => {
    const data = serializeGame(
      createNewPlayer(new ManualClock()),
      1,
    ) as Partial<SaveData>;
    delete data.quests;
    const migrated = migrate({ ...data, version: 4 });
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.quests).toEqual({});
    expect(MIGRATIONS[4]({ version: 4 }).quests).toEqual({});
  });

  it("quests e marca fir (também dentro de contêineres) voltam iguais", () => {
    const player = createNewPlayer(new ManualClock());
    player.quests = {
      a: { status: "active", progress: [1, 0] },
      b: { status: "completed", progress: [3] },
    };
    const { stash } = player.inventory;
    const bolts = player.factory.create("barter_bolts");
    bolts.fir = true;
    autoPlace(bolts, [stash]);
    const sack = stash.items().find((i) => i.def.id === "backpack_hiker");
    const inner = player.factory.create("food_can");
    inner.fir = true;
    autoPlace(inner, sack!.grids);
    const state = load(serializeGame(player, 1));
    expect(state.quests).toEqual(player.quests);
    const items = state.inventory.stash.items();
    expect(items.find((i) => i.uid === bolts.uid)?.fir).toBe(true);
    const loadedSack = items.find((i) => i.uid === sack!.uid)!;
    expect(loadedSack.grids[0].items()[0].fir).toBe(true);
    const plain = items.find((i) => i.def.id === "money_rub")!;
    expect(plain.fir).toBeUndefined();
  });

  it("quests inválidas são descartadas; progresso inválido vira 0", () => {
    const data = serializeGame(
      createNewPlayer(new ManualClock()),
      1,
    ) as SaveData;
    expect(load({ ...data, quests: undefined }).quests).toEqual({});
    const quests = load({
      ...data,
      quests: {
        ok: { status: "active", progress: [2, "x", -1] },
        semProgresso: { status: "completed" },
        ruim: { status: "talvez", progress: [] },
        nula: null,
      },
    }).quests;
    expect(quests).toEqual({
      ok: { status: "active", progress: [2, 0, 0] },
      semProgresso: { status: "completed", progress: [] },
    });
  });
});
