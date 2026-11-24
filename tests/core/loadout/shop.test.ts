import { describe, expect, it } from "vitest";

import {
  buyMissing,
  estimateMissing,
  purchaseOptions,
  quickEquip,
} from "../../../src/core/loadout/loadout.ts";
import type { Loadout, ShopContext } from "../../../src/core/loadout/types.ts";
import { xpForLevel } from "../../../src/core/pmc/pmc.ts";
import { countInStash } from "../../../src/core/trade/trade.ts";
import type { TraderDef } from "../../../src/core/trade/types.ts";
import { TEST_FLEA } from "../flea/fleaFixtures.ts";
import { TEST_TRADER, USD_TRADER, trader } from "../trade/tradeFixtures.ts";

const QUEST_TRADER: TraderDef = {
  ...TEST_TRADER,
  id: "quest",
  offers: [
    { id: "q", item: "barter_bolts", level: 1, stock: 1, quest: "cleanup" },
    { id: "empty", item: "barter_bolts", level: 1, stock: 0 },
  ],
};

const SHOP: ShopContext = { traders: [TEST_TRADER], flea: TEST_FLEA };

const loadout = (carried: Loadout["carried"], slots = {}): Loadout => ({
  name: "L",
  slots,
  magazines: {},
  carried,
});

describe("onde comprar", () => {
  it("só ofertas em dinheiro liberadas, com estoque, e o mercado; mais barato antes", () => {
    const { player } = trader();
    const shop = {
      traders: [TEST_TRADER, USD_TRADER, QUEST_TRADER],
      flea: TEST_FLEA,
    };
    // sem mercado (nível 1): vendedor em ₽ (1,5×) e em $ (convertido)
    expect(purchaseOptions(player, shop, "barter_bolts", 0)).toEqual([
      {
        source: { kind: "trader", trader: "test", offer: "bolts" },
        lot: 1,
        rub: 3750,
      },
      {
        source: { kind: "trader", trader: "usd", offer: "bolts" },
        lot: 1,
        rub: Math.ceil(3750 / 122) * 122,
      },
    ]);
    // troca e nível acima ficam de fora
    expect(purchaseOptions(player, shop, "barter_goldchain", 0)).toEqual([]);
    expect(purchaseOptions(player, shop, "barter_gpu", 0)).toEqual([]);
    expect(purchaseOptions(player, shop, "nada", 0)).toEqual([]);
    // com o mercado liberado, ele entra (mais barato que 1,5×)
    player.pmc.xp = xpForLevel(2);
    const withFlea = purchaseOptions(player, shop, "barter_bolts", 0);
    expect(withFlea[0]).toEqual({
      source: { kind: "flea" },
      lot: 1,
      rub: 2750,
    });
    // quest concluída libera a oferta
    player.quests.cleanup = { status: "completed", progress: [] };
    expect(
      purchaseOptions(player, shop, "barter_bolts", 0).some(
        (o) => o.source.kind === "trader" && o.source.offer === "q",
      ),
    ).toBe(true);
    // fora do mercado (banido)
    expect(
      purchaseOptions(player, shop, "key_garage", 0).some(
        (o) => o.source.kind === "flea",
      ),
    ).toBe(false);
  });

  it("estimativa do que falta e o que não está à venda", () => {
    const { player, put } = trader();
    put("ammo_9mm", 10);
    const want = loadout([
      { item: "ammo_9mm", count: 60 },
      { item: "barter_gpu", count: 1 },
    ]);
    // 50 faltando = 1 compra de 50 a 1,5× → ceil(45×50×1,5)
    expect(estimateMissing(player, want, SHOP, 0)).toEqual({
      rub: Math.ceil(45 * 50 * 1.5),
      unavailable: ["barter_gpu"],
    });
  });
});

describe("comprar o que falta", () => {
  it("compra até cobrir; passa para a próxima opção; falha sem dinheiro", () => {
    const { player, put } = trader(10, 10);
    player.pmc.xp = xpForLevel(2);
    put("money_rub", 20_000);
    const want = loadout([{ item: "barter_bolts", count: 4 }]);
    // o vendedor tem 2 (estoque) e o mercado o resto
    const result = buyMissing(player, want, SHOP, 0);
    expect(result.bought).toEqual([{ item: "barter_bolts", count: 4 }]);
    expect(result.failed).toEqual([]);
    expect(result.spent).toBe(
      20_000 - countInStash(player.inventory.stash, "money_rub"),
    );
    expect(countInStash(player.inventory.stash, "barter_bolts")).toBe(4);

    const broke = trader();
    const fail = buyMissing(broke.player, want, SHOP, 0);
    expect(fail).toEqual({
      bought: [],
      failed: [{ item: "barter_bolts", count: 4 }],
      spent: 0,
    });
    // sem opção nenhuma
    expect(
      buyMissing(
        broke.player,
        loadout([{ item: "barter_gpu", count: 1 }]),
        SHOP,
        0,
      ).failed,
    ).toEqual([{ item: "barter_gpu", count: 1 }]);
  });

  it("um clique: compra e monta", () => {
    const { player, put } = trader();
    put("money_rub", 10_000);
    const want = loadout([{ item: "ammo_9mm", count: 30 }]);
    const { purchase, apply } = quickEquip(player, want, SHOP, 0);
    expect(purchase.bought).toEqual([{ item: "ammo_9mm", count: 50 }]);
    expect(apply).toEqual({ missing: [], noSpace: [] });
    expect(player.inventory.equipment.pockets[0].items()[0]).toMatchObject({
      count: 30,
    });
  });
});
