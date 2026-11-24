import { describe, expect, it } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { inStash, quickMove } from "../../../src/core/inventory/quickMove.ts";
import { catalog } from "../../../src/data/items.ts";

function setup(stashW = 10, stashH = 10) {
  const factory = new ItemFactory(catalog);
  const inv = { stash: new Grid(stashW, stashH), equipment: new Equipment() };
  const inStashAt = (id: string, x: number, y: number, count?: number) => {
    const item = factory.create(id, count);
    inv.stash.place(item, x, y);
    return item;
  };
  return { factory, inv, inStashAt };
}

describe("inStash", () => {
  it("vale para o estoque e para contêineres dentro dele", () => {
    const { factory, inv, inStashAt } = setup();
    const sack = inStashAt("backpack_sack", 0, 0);
    const can = factory.create("food_can");
    sack.grids[0].place(can, 0, 0);
    expect(inStash(sack, inv.stash)).toBe(true);
    expect(inStash(can, inv.stash)).toBe(true);
    expect(inStash(factory.create("food_can"), inv.stash)).toBe(false);
    const pocketItem = factory.create("food_can");
    inv.equipment.pockets[0].place(pocketItem, 0, 0);
    expect(inStash(pocketItem, inv.stash)).toBe(false);
    const rig = factory.create("rig_cargo");
    inv.equipment.equip("rig", rig);
    const inRig = factory.create("food_can");
    rig.grids[0].place(inRig, 0, 0);
    expect(inStash(rig, inv.stash)).toBe(false);
    expect(inStash(inRig, inv.stash)).toBe(false);
  });
});

describe("quickMove", () => {
  it("do estoque: vai para o primeiro slot vazio que aceita o item", () => {
    const { inv, inStashAt } = setup();
    const a = inStashAt("rifle_vk74", 0, 0);
    const b = inStashAt("rifle_vk74", 0, 2);
    expect(quickMove(a, inv)).toBe(true);
    expect(inv.equipment.get("primary")).toBe(a);
    expect(quickMove(b, inv)).toBe(true);
    expect(inv.equipment.get("secondary")).toBe(b);
  });

  it("do estoque, sem slot: vai para as grades de carga; sem espaço, nada muda", () => {
    const { factory, inv, inStashAt } = setup();
    const can = inStashAt("food_can", 0, 0);
    expect(quickMove(can, inv)).toBe(true);
    expect(inv.equipment.pockets[0].has(can)).toBe(true);
    for (const pocket of inv.equipment.pockets.slice(1)) {
      pocket.place(factory.create("barter_bolts"), 0, 0);
    }
    const water = inStashAt("food_water", 0, 0);
    expect(quickMove(water, inv)).toBe(false);
    expect(inv.stash.has(water)).toBe(true);
  });

  it("do equipamento ou da carga: vai para o estoque", () => {
    const { factory, inv } = setup();
    const helmet = factory.create("helmet_tk1");
    inv.equipment.equip("helmet", helmet);
    expect(quickMove(helmet, inv)).toBe(true);
    expect(inv.equipment.get("helmet")).toBeNull();
    expect(inv.stash.has(helmet)).toBe(true);
    const can = factory.create("food_can");
    inv.equipment.pockets[0].place(can, 0, 0);
    expect(quickMove(can, inv)).toBe(true);
    expect(inv.stash.has(can)).toBe(true);
  });

  it("estoque cheio: nada muda; pilha que entra só em parte conta como mudança", () => {
    const { factory, inv, inStashAt } = setup(1, 1);
    const full = inStashAt("ammo_9mm", 0, 0, 45);
    const loose = factory.create("ammo_9mm", 10);
    inv.equipment.pockets[0].place(loose, 0, 0);
    expect(quickMove(loose, inv)).toBe(true);
    expect(full.count).toBe(50);
    expect(loose.count).toBe(5);
    const can = factory.create("food_can");
    inv.equipment.pockets[1].place(can, 0, 0);
    expect(quickMove(can, inv)).toBe(false);
    expect(inv.equipment.pockets[1].has(can)).toBe(true);
  });

  it("item solto não se move", () => {
    const { factory, inv } = setup();
    expect(quickMove(factory.create("food_can"), inv)).toBe(false);
  });
});
