import { describe, expect, it } from "vitest";

import {
  buyPrice,
  createFleaState,
  fleaBuy,
  fleaTick,
  listItem,
  listingFee,
  lotSize,
  marketDefs,
  marketPrice,
} from "../../src/core/flea/flea.ts";
import { ITEM_CATEGORIES } from "../../src/core/inventory/item.ts";
import { FLEA } from "../../src/data/flea.ts";
import { catalog } from "../../src/data/items.ts";
import { TRADERS } from "../../src/data/traders.ts";
import { market } from "../core/flea/fleaFixtures.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("mercado (dados)", () => {
  it("configuração válida", () => {
    expect(catalog.get(FLEA.currency).category).toBe("money");
    for (const id of FLEA.banned) expect(catalog.has(id)).toBe(true);
    for (const c of FLEA.firCategories) expect(ITEM_CATEGORIES).toContain(c);
    expect(FLEA.maxRatio).toBeGreaterThan(1);
    expect(FLEA.slots).toBeGreaterThan(0);
    expect(FLEA.listingMs).toBeGreaterThan(FLEA.checkMs);
    expect(marketDefs(catalog, FLEA).length).toBeGreaterThan(15);
  });

  it("tendência fica em ±20% do preço base", () => {
    const state = createFleaState(123);
    for (const def of marketDefs(catalog, FLEA)) {
      for (let t = 0; t < 48 * HOUR; t += 37 * MIN) {
        const ratio = marketPrice(state, FLEA, def, t) / def.basePrice;
        expect(ratio).toBeGreaterThan(0.79);
        expect(ratio).toBeLessThan(1.21);
      }
    }
  });

  it("comprar e anunciar na hora pelo preço de mercado dá prejuízo", () => {
    for (const def of marketDefs(catalog, FLEA)) {
      const state = createFleaState(99);
      const spent = buyPrice(state, FLEA, def, catalog, 0);
      const { player, put } = market(10, 10);
      player.flea = state;
      put("money_rub", 500_000);
      expect(fleaBuy(player, { ...FLEA, minPmcLevel: 1 }, def.id, 0).ok).toBe(
        true,
      );
      const value = marketPrice(state, FLEA, def, 0) * lotSize(def);
      const net = value - listingFee(FLEA, value, value);
      expect(net, def.id).toBeLessThan(spent);
    }
  });

  it("vender no mercado paga mais que o melhor vendedor (mas demora)", () => {
    const bestRate = Math.max(
      ...TRADERS.flatMap((t) =>
        t.levels.map((l) => l.sellRate * Math.max(...Object.values(t.buys))),
      ),
    );
    const worst = (1 - FLEA.trendAmplitude) * (1 - FLEA.feeRate);
    expect(worst).toBeGreaterThan(bestRate);
  });

  it("pelo preço de mercado vende em ~20 min; 50% acima, bem mais devagar", () => {
    const meanMinutes = (ratio: number) => {
      let total = 0;
      let sold = 0;
      for (let seed = 0; seed < 200; seed++) {
        const { player, put } = market(10, 10);
        player.flea.seed = seed;
        put("money_rub", 100_000);
        const can = put("food_can");
        const config = { ...FLEA, minPmcLevel: 1 };
        const price = Math.round(
          marketPrice(player.flea, config, can.def, 0) * ratio,
        );
        listItem(player, config, can, price, 0);
        for (let m = 1; m <= 12 * 60; m++) {
          const [result] = fleaTick(player, config, m * MIN);
          if (result) {
            if (result.kind === "sold") {
              total += m;
              sold++;
            }
            break;
          }
        }
      }
      return { mean: total / sold, sold };
    };
    const atMarket = meanMinutes(1);
    expect(atMarket.sold).toBe(200);
    expect(atMarket.mean).toBeGreaterThan(14);
    expect(atMarket.mean).toBeLessThan(28);
    const high = meanMinutes(1.5);
    expect(high.mean).toBeGreaterThan(atMarket.mean * 2.5);
  });
});
