import { describe, expect, it } from "vitest";

import { autoPlace } from "../../../src/core/inventory/operations.ts";
import {
  countInStash,
  damagedItems,
  repair,
  repairCost,
} from "../../../src/core/trade/trade.ts";
import { catalog } from "../../../src/data/items.ts";
import { traderById } from "../../../src/data/traders.ts";
import { TEST_TRADER, trader } from "./tradeFixtures.ts";

const REPAIRER = { ...TEST_TRADER, repairRate: 0.5 };

describe("conserto", () => {
  it("itens gastos no estoque (com contêineres), vestidos e nos bolsos", () => {
    const { player, put, factory } = trader();
    const { equipment } = player.inventory;
    const inStash = put("armor_civil");
    put("helmet_tk1");
    const worn = factory.create("helmet_tk1");
    equipment.equip("helmet", worn);
    const backpack = factory.create("backpack_hiker");
    equipment.equip("backpack", backpack);
    const packed = factory.create("helmet_tk1");
    autoPlace(packed, backpack.grids);
    const pocket = factory.create("food_can");
    equipment.pockets[0].place(pocket, 0, 0, false);
    expect(damagedItems(player)).toEqual([]);
    for (const item of [inStash, worn, packed]) item.durability = 5;
    expect(damagedItems(player)).toEqual([inStash, worn, packed]);
  });

  it("preço pela parte gasta; recusa sem conserto ou item inteiro", () => {
    const { factory } = trader();
    const armor = factory.create("armor_civil");
    expect(repairCost(TEST_TRADER, armor, catalog)).toEqual({
      ok: false,
      reason: "Não faz consertos",
    });
    expect(repairCost(REPAIRER, armor, catalog)).toEqual({
      ok: false,
      reason: "Não precisa de conserto",
    });
    armor.durability = 30;
    expect(repairCost(REPAIRER, armor, catalog)).toEqual({
      ok: true,
      amount: Math.ceil(12_000 * 0.25 * 0.5),
    });
    armor.durability = 39.999;
    expect(repairCost(REPAIRER, armor, catalog)).toEqual({
      ok: true,
      amount: 1,
    });
    const usd = { ...REPAIRER, currency: "money_usd" };
    armor.durability = 0;
    expect(repairCost(usd, armor, catalog)).toEqual({
      ok: true,
      amount: Math.ceil(6000 / 122),
    });
  });

  it("conserta pagando do estoque e soma ao volume", () => {
    const { player, put, factory } = trader();
    const armor = put("armor_civil");
    armor.durability = 20;
    expect(repair(player, REPAIRER, armor, 0)).toEqual({
      ok: false,
      reason: "Dinheiro insuficiente",
    });
    put("money_rub", 10_000);
    expect(repair(player, REPAIRER, armor, 0)).toEqual({
      ok: true,
      amount: 3000,
    });
    expect(armor.durability).toBeUndefined();
    expect(countInStash(player.inventory.stash, "money_rub")).toBe(7000);
    expect(player.traders[REPAIRER.id].volume).toBe(3000);

    const loose = factory.create("armor_civil");
    loose.durability = 1;
    expect(repair(player, REPAIRER, loose, 0)).toEqual({
      ok: false,
      reason: "O item precisa estar com você ou no estoque",
    });
    expect(repair(player, TEST_TRADER, loose, 0).ok).toBe(false);
  });

  it("o Mercador Tito conserta", () => {
    expect(traderById("merchant")!.repairRate).toBeGreaterThan(0);
  });
});
