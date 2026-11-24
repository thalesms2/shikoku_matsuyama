import { describe, expect, it } from "vitest";

import { catalog } from "../../src/data/items.ts";
import { LOYALTY_LEVELS, TRADERS, traderById } from "../../src/data/traders.ts";

describe("vendedores", () => {
  it("entre 4 e 6, ids únicos e busca por id", () => {
    expect(TRADERS.length).toBeGreaterThanOrEqual(4);
    expect(TRADERS.length).toBeLessThanOrEqual(6);
    expect(new Set(TRADERS.map((t) => t.id)).size).toBe(TRADERS.length);
    expect(traderById("doctor")?.name).toBe("Doutora Iara");
    expect(traderById("nada")).toBeNull();
  });

  it("níveis de lealdade: exigem mais e dão preços melhores", () => {
    expect(LOYALTY_LEVELS[0]).toMatchObject({
      level: 1,
      minPmcLevel: 1,
      minReputation: 0,
      minVolume: 0,
    });
    for (let i = 1; i < LOYALTY_LEVELS.length; i++) {
      const [prev, cur] = [LOYALTY_LEVELS[i - 1], LOYALTY_LEVELS[i]];
      expect(cur.level).toBe(prev.level + 1);
      expect(cur.minVolume).toBeGreaterThan(prev.minVolume);
      expect(cur.buyMarkup).toBeLessThan(prev.buyMarkup);
      expect(cur.sellRate).toBeGreaterThan(prev.sellRate);
      // nunca dá para comprar e revender com lucro
      expect(cur.sellRate).toBeLessThan(cur.buyMarkup);
    }
  });

  it("usa moeda principal e ao menos uma estrangeira", () => {
    const currencies = new Set(TRADERS.map((t) => t.currency));
    expect(currencies.has("money_rub")).toBe(true);
    expect(currencies.size).toBeGreaterThan(1);
  });

  it.each(TRADERS.map((t) => [t.id, t] as const))(
    "%s: ofertas válidas",
    (_, trader) => {
      expect(catalog.get(trader.currency).category).toBe("money");
      expect(trader.restockMs).toBeGreaterThan(0);
      expect(new Set(trader.offers.map((o) => o.id)).size).toBe(
        trader.offers.length,
      );
      for (const offer of trader.offers) {
        const def = catalog.get(offer.item);
        expect(offer.stock).toBeGreaterThan(0);
        expect(offer.count ?? 1).toBeLessThanOrEqual(def.maxStack ?? 1);
        expect(offer.level).toBeLessThanOrEqual(trader.levels.length);
        if (offer.currency) {
          expect(catalog.get(offer.currency).category).toBe("money");
        }
        for (const cost of offer.barter ?? []) {
          expect(catalog.has(cost.item)).toBe(true);
          expect(cost.item).not.toBe(offer.item);
        }
      }
      for (const category of Object.keys(trader.buys)) {
        expect(category).not.toBe("money");
      }
    },
  );

  it("o câmbio custa mais que o valor de referência", () => {
    for (const trader of TRADERS) {
      for (const offer of trader.offers.filter((o) => o.price)) {
        const value = catalog.get(offer.item).basePrice * (offer.count ?? 1);
        const rate = catalog.get(offer.currency ?? trader.currency).basePrice;
        expect(offer.price! * rate).toBeGreaterThan(value);
      }
    }
  });
});
