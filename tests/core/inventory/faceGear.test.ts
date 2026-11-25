import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Equipment, SLOTS } from "../../../src/core/inventory/equipment.ts";
import { gearBonuses } from "../../../src/core/inventory/gear.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { autoPlace } from "../../../src/core/inventory/operations.ts";
import { quickMove } from "../../../src/core/inventory/quickMove.ts";
import { snapshotLoadout } from "../../../src/core/loadout/loadout.ts";
import { migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { TRADERS } from "../../../src/data/traders.ts";

const make = (id: string) => new ItemFactory(catalog).create(id);

describe("óculos e cobertura do rosto", () => {
  it("slots novos aceitam só o tipo certo", () => {
    expect(SLOTS.eyewear).toBe("eyewear");
    expect(SLOTS.face).toBe("face");
    const equipment = new Equipment();
    const glasses = make("eyewear_sun");
    const mask = make("face_balaclava");
    expect(equipment.canEquip("face", glasses)).toBe(false);
    expect(equipment.canEquip("helmet", mask)).toBe(false);
    equipment.equip("eyewear", glasses);
    equipment.equip("face", mask);
    expect(equipment.equipped()).toEqual([glasses, mask]);
  });

  it("gearBonuses soma percepção, furtividade e visibilidade vestidas", () => {
    const equipment = new Equipment();
    expect(gearBonuses(equipment)).toEqual({
      perception: 0,
      stealth: 0,
      visibility: 0,
    });
    equipment.equip("eyewear", make("eyewear_tactical"));
    equipment.equip("face", make("face_balaclava"));
    equipment.equip("backpack", make("backpack_school"));
    equipment.equip("helmet", make("helmet_tk1"));
    expect(gearBonuses(equipment)).toEqual({
      perception: 3,
      stealth: 1 + 2,
      visibility: catalog.get("backpack_school").stats!.visibility,
    });
  });

  it("os itens novos têm bônus pequenos (1 a 3) e algum vendedor vende", () => {
    const ids = [
      "eyewear_sun",
      "eyewear_shooting",
      "eyewear_tactical",
      "face_balaclava",
      "face_scarf",
    ];
    for (const id of ids) {
      const def = catalog.get(id);
      expect(def.category).toBe("accessory");
      const { perceptionBonus = 0, stealthBonus = 0 } = def.stats!;
      expect(perceptionBonus + stealthBonus).toBeGreaterThanOrEqual(1);
      expect(Math.max(perceptionBonus, stealthBonus)).toBeLessThanOrEqual(3);
    }
    const sold = TRADERS.flatMap((t) => t.offers.map((o) => o.item));
    expect(sold).toContain("eyewear_sun");
    expect(sold).toContain("face_balaclava");
  });

  it("Ctrl+clique do estoque veste no slot vazio", () => {
    const player = createNewPlayer(new ManualClock());
    const { stash, equipment } = player.inventory;
    const glasses = player.factory.create("eyewear_shooting");
    expect(autoPlace(glasses, [stash])).toBe(true);
    expect(quickMove(glasses, player.inventory)).toBe(true);
    expect(equipment.get("eyewear")).toBe(glasses);
  });

  it("loadout e save guardam os slots novos; save sem eles carrega", () => {
    const player = createNewPlayer(new ManualClock());
    const { equipment } = player.inventory;
    equipment.equip("eyewear", player.factory.create("eyewear_sun"));
    equipment.equip("face", player.factory.create("face_scarf"));
    expect(snapshotLoadout(player, "x").slots).toMatchObject({
      eyewear: "eyewear_sun",
      face: "face_scarf",
    });

    const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
    const load = (d: unknown) =>
      deserializeGame(migrate(d), catalog, new ManualClock(1)).state.inventory
        .equipment;
    const loaded = load(data);
    expect(loaded.get("eyewear")?.def.id).toBe("eyewear_sun");
    expect(loaded.get("face")?.def.id).toBe("face_scarf");

    delete data.equipment.slots.eyewear;
    delete data.equipment.slots.face;
    const old = load(data);
    expect(old.get("eyewear")).toBeNull();
    expect(old.get("face")).toBeNull();
  });
});
