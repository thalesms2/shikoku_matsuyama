import { describe, expect, it } from "vitest";

import { ItemFactory } from "../../src/core/inventory/item.ts";
import { catalog } from "../../src/data/items.ts";
import {
  STASH_HEIGHT,
  STASH_ITEMS,
  STASH_WIDTH,
  createStarterInventory,
} from "../../src/data/starter.ts";

describe("createStarterInventory", () => {
  it("monta o estoque com todos os itens iniciais", () => {
    const { stash } = createStarterInventory(new ItemFactory(catalog));
    expect(stash.width).toBe(STASH_WIDTH);
    expect(stash.height).toBe(STASH_HEIGHT);
    const ids = stash.items().map((i) => i.def.id);
    for (const [id] of STASH_ITEMS) expect(ids).toContain(id);
  });

  it("equipa pistola, colete tático, mochila e contêiner seguro", () => {
    const { equipment } = createStarterInventory(new ItemFactory(catalog));
    expect(equipment.get("holster")?.def.id).toBe("pistol_pk9");
    expect(equipment.get("rig")?.def.id).toBe("rig_cargo");
    expect(equipment.get("backpack")?.def.id).toBe("backpack_sack");
    expect(equipment.get("secure")?.def.id).toBe("secure_pouch");
    const carried = equipment
      .carryGrids()
      .flatMap((g) => g.items())
      .map((i) => i.def.id);
    expect(carried).toEqual(
      expect.arrayContaining(["ammo_9mm", "med_bandage"]),
    );
  });

  it("enche a caixa de munição", () => {
    const { stash } = createStarterInventory(new ItemFactory(catalog));
    const box = stash.items().find((i) => i.def.id === "ammo_case")!;
    expect(box.grids[0].items()[0].def.id).toBe("ammo_545");
  });

  it("aceita uma lista própria de itens, sem caixa de munição", () => {
    const { stash } = createStarterInventory(new ItemFactory(catalog), [
      ["food_can", 1],
    ]);
    expect(stash.items().map((i) => i.def.id)).toEqual(["food_can"]);
  });

  it("falha se um item inicial não couber no estoque", () => {
    const tooMany = Array.from(
      { length: 20 },
      () => ["backpack_hiker", 1] as [string, number],
    );
    expect(() =>
      createStarterInventory(new ItemFactory(catalog), tooMany),
    ).toThrow("não coube");
  });
});
