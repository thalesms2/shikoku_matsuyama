import { describe, expect, it } from "vitest";

import {
  Equipment,
  POCKET_COUNT,
  SLOTS,
  SLOT_NAMES,
} from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { setup } from "./fixtures.ts";

describe("Equipment", () => {
  it("tem os slots esperados e 4 bolsos 1x1", () => {
    const equipment = new Equipment();
    expect(SLOT_NAMES).toEqual([
      "primary",
      "secondary",
      "holster",
      "helmet",
      "armor",
      "rig",
      "backpack",
      "secure",
    ]);
    expect(SLOTS.primary).toBe("longWeapon");
    expect(SLOTS.holster).toBe("pistol");
    expect(equipment.pockets).toHaveLength(POCKET_COUNT);
    for (const pocket of equipment.pockets) {
      expect(pocket.width).toBe(1);
      expect(pocket.height).toBe(1);
    }
    expect(equipment.equipped()).toEqual([]);
  });

  it("equipa itens no slot do tipo certo", () => {
    const { make } = setup();
    const equipment = new Equipment();
    const rifle = make("rifle");
    expect(equipment.canEquip("primary", rifle)).toBe(true);
    expect(equipment.canEquip("secondary", rifle)).toBe(true);
    expect(equipment.canEquip("holster", rifle)).toBe(false);
    equipment.equip("primary", rifle);
    expect(equipment.get("primary")).toBe(rifle);
    expect(rifle.location).toEqual({
      kind: "slot",
      equipment,
      slot: "primary",
    });
  });

  it("não equipa em slot ocupado ou de tipo errado", () => {
    const { make } = setup();
    const equipment = new Equipment();
    equipment.equip("helmet", make("helmet"));
    const other = make("helmet");
    expect(equipment.canEquip("helmet", other)).toBe(false);
    expect(() => equipment.equip("helmet", other)).toThrow("não pode ir");
    expect(() => equipment.equip("armor", make("small"))).toThrow(
      "não pode ir",
    );
  });

  it("exige item solto para equipar", () => {
    const { make } = setup();
    const equipment = new Equipment();
    const pistol = make("pistol");
    new Grid(2, 1).place(pistol, 0, 0);
    expect(() => equipment.equip("holster", pistol)).toThrow("removido antes");
  });

  it("unequip solta o item e libera o slot", () => {
    const { make } = setup();
    const equipment = new Equipment();
    const pistol = make("pistol");
    equipment.equip("holster", pistol);
    expect(equipment.unequip("holster")).toBe(pistol);
    expect(pistol.location).toBeNull();
    expect(equipment.get("holster")).toBeNull();
    expect(equipment.unequip("holster")).toBeNull();
  });

  it("carryGrids lista bolsos, colete e mochila, sem o contêiner seguro", () => {
    const { make } = setup();
    const equipment = new Equipment();
    expect(equipment.carryGrids()).toEqual(equipment.pockets);
    const rig = make("rig");
    const bag = make("bag");
    equipment.equip("rig", rig);
    equipment.equip("backpack", bag);
    equipment.equip("secure", make("pouch"));
    expect(equipment.carryGrids()).toEqual([
      ...equipment.pockets,
      ...rig.grids,
      ...bag.grids,
    ]);
  });

  it("equipped lista os itens na ordem dos slots", () => {
    const { make } = setup();
    const equipment = new Equipment();
    const bag = make("bag");
    const rifle = make("rifle");
    equipment.equip("backpack", bag);
    equipment.equip("primary", rifle);
    expect(equipment.equipped()).toEqual([rifle, bag]);
  });
});
