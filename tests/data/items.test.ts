import { describe, expect, it } from "vitest";

import { ItemFactory } from "../../src/core/inventory/item.ts";
import { ITEM_DEFS, catalog } from "../../src/data/items.ts";

describe("catálogo de itens", () => {
  it("carrega todas as definições sem erro", () => {
    expect(catalog.all()).toHaveLength(ITEM_DEFS.length);
  });

  it("todo item pode ser instanciado", () => {
    const factory = new ItemFactory(catalog);
    for (const def of ITEM_DEFS) {
      expect(factory.create(def.id).def).toBe(def);
    }
  });

  it("itens equipáveis em mochila/colete/seguro têm grades", () => {
    for (const def of ITEM_DEFS) {
      if (["backpack", "rig", "secure"].includes(def.equipSlot ?? "")) {
        expect(def.grids?.length, def.id).toBeGreaterThan(0);
      }
    }
  });

  it("o nome curto cabe na largura do item (até 7 caracteres por célula)", () => {
    for (const def of ITEM_DEFS) {
      expect(def.shortName.length, def.id).toBeLessThanOrEqual(7 * def.width);
    }
  });

  it("mochilas não aceitam outras mochilas", () => {
    const factory = new ItemFactory(catalog);
    const sack = factory.create("backpack_sack");
    expect(sack.grids[0].accepts(factory.create("backpack_hiker"))).toBe(false);
  });

  it("caixa de munição só aceita munição", () => {
    const factory = new ItemFactory(catalog);
    const box = factory.create("ammo_case");
    expect(box.grids[0].accepts(factory.create("ammo_545"))).toBe(true);
    expect(box.grids[0].accepts(factory.create("med_bandage"))).toBe(false);
  });
});
