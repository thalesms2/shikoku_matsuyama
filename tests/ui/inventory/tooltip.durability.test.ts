import { describe, expect, it } from "vitest";

import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { catalog } from "../../../src/data/items.ts";
import { itemSheet } from "../../../src/ui/inventory/Tooltip.ts";

describe("itemSheet: durabilidade", () => {
  it("inteira mostra o máximo; gasta mostra atual/máximo", () => {
    const armor = new ItemFactory(catalog).create("armor_civil");
    expect(itemSheet(armor)).toContain("Durabilidade: 40");
    armor.durability = 12.2;
    expect(itemSheet(armor)).toContain("Durabilidade: 13/40");
  });
});
