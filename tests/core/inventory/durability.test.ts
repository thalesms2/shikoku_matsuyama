import { describe, expect, it } from "vitest";

import {
  BROKEN_VALUE,
  durabilityOf,
  durabilityRatio,
  durabilityValueFactor,
  isDamaged,
  maxDurability,
  restoreDurability,
  wear,
} from "../../../src/core/inventory/durability.ts";
import { ItemFactory, totalValue } from "../../../src/core/inventory/item.ts";
import { catalog } from "../../../src/data/items.ts";

const factory = new ItemFactory(catalog);

describe("durabilidade", () => {
  it("inteira por padrão; itens sem durabilidade nunca gastam", () => {
    const armor = factory.create("armor_civil");
    expect(maxDurability(armor.def)).toBe(40);
    expect(durabilityOf(armor)).toBe(40);
    expect(durabilityRatio(armor)).toBe(1);
    expect(isDamaged(armor)).toBe(false);
    const can = factory.create("food_can");
    expect(maxDurability(can.def)).toBe(0);
    expect(durabilityRatio(can)).toBe(1);
    expect(durabilityValueFactor(can)).toBe(1);
  });

  it("gasta sem passar de 0 e volta ao máximo", () => {
    const armor = factory.create("armor_civil");
    expect(wear(armor, 10)).toBe(10);
    expect(durabilityOf(armor)).toBe(30);
    expect(isDamaged(armor)).toBe(true);
    expect(wear(armor, 100)).toBe(30);
    expect(durabilityOf(armor)).toBe(0);
    restoreDurability(armor);
    expect(armor.durability).toBeUndefined();
  });

  it("valor cai com a durabilidade, até BROKEN_VALUE", () => {
    const armor = factory.create("armor_civil");
    const full = totalValue(armor);
    armor.durability = 20;
    expect(durabilityValueFactor(armor)).toBeCloseTo(BROKEN_VALUE + 0.35);
    expect(totalValue(armor)).toBeCloseTo(full * (BROKEN_VALUE + 0.35));
    armor.durability = 0;
    expect(totalValue(armor)).toBeCloseTo(full * BROKEN_VALUE);
  });
});
