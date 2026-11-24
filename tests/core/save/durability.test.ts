import { describe, expect, it } from "vitest";

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

const load = (data: unknown) =>
  deserializeGame(migrate(data), catalog, new ManualClock(1)).state;

describe("save v10: durabilidade", () => {
  it("SAVE_VERSION é pelo menos 10 e a migração 9 → 10 não muda nada", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(10);
    const data = { version: 9, x: 1 };
    expect(MIGRATIONS[9](data)).toBe(data);
  });

  it("armadura gasta volta gasta; inteira não grava o campo", () => {
    const player = createNewPlayer(new ManualClock());
    const armor = player.factory.create("armor_civil");
    armor.durability = 12.5;
    player.inventory.stash.addRows(3);
    player.inventory.stash.place(armor, 0, 14, false);
    const helmet = player.factory.create("helmet_tk1");
    player.inventory.equipment.equip("helmet", helmet);
    const data = serializeGame(player, 1);
    expect(data.stash.items.find((i) => i.uid === armor.uid)!.dur).toBe(12.5);
    expect(data.equipment.slots.helmet!.dur).toBeUndefined();
    const state = load(JSON.parse(JSON.stringify(data)));
    const loaded = state.inventory.stash
      .items()
      .find((i) => i.uid === armor.uid)!;
    expect(loaded.durability).toBe(12.5);
    expect(state.inventory.equipment.get("helmet")!.durability).toBeUndefined();
  });

  it("durabilidade inválida, acima do máximo ou em item sem durabilidade é ignorada", () => {
    const player = createNewPlayer(new ManualClock());
    const data = serializeGame(player, 1) as SaveData;
    const base = { x: 0, y: 13, r: false, count: 1 };
    data.stash.items.push(
      { ...base, uid: "a", def: "armor_civil", dur: -5 },
      { ...base, x: 3, uid: "b", def: "armor_civil", dur: 99 },
      { ...base, x: 6, uid: "c", def: "helmet_tk1", dur: "x" as never },
      { ...base, x: 8, uid: "d", def: "food_can", dur: 3 },
    );
    const items = load(data).inventory.stash.items();
    const by = (uid: string) => items.find((i) => i.uid === uid)!;
    expect(by("a").durability).toBe(0);
    expect(by("b").durability).toBeUndefined();
    expect(by("c").durability).toBeUndefined();
    expect(by("d").durability).toBeUndefined();
  });
});
