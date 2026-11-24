import { describe, expect, it } from "vitest";

import {
  collectResult,
  fleaBuy,
  fleaTick,
  listItem,
  pressureAt,
} from "../../../src/core/flea/flea.ts";
import { countInStash } from "../../../src/core/trade/trade.ts";
import { HOUR, MIN, TEST_FLEA, market } from "./fleaFixtures.ts";

/** Sempre vende no primeiro sorteio pelo preço de mercado */
const SURE = { ...TEST_FLEA, saleChance: 1 };

function listed(now = 0, config = TEST_FLEA) {
  const m = market(10, 10, now);
  m.put("money_rub", 10_000);
  const can = m.put("food_can");
  return {
    ...m,
    can,
    list: (price: number, at = now) =>
      listItem(m.player, config, can, price, at),
  };
}

describe("fleaTick", () => {
  it("sem anúncios só marca o último cálculo (e o relógio não volta)", () => {
    const { player } = market();
    expect(fleaTick(player, TEST_FLEA, 5 * MIN)).toEqual([]);
    expect(player.flea.lastCheck).toBe(5 * MIN);
    fleaTick(player, TEST_FLEA, MIN);
    expect(player.flea.lastCheck).toBe(5 * MIN);
  });

  it("vende no sorteio depois do anúncio, soma pressão e estatísticas", () => {
    const { player, list } = listed(30_000, SURE);
    list(1500);
    expect(fleaTick(player, SURE, 59_999)).toEqual([]);
    const sold = fleaTick(player, SURE, MIN);
    expect(sold).toEqual([
      { kind: "sold", id: 1, def: "food_can", count: 1, price: 1500 },
    ]);
    expect(player.flea.listings).toEqual([]);
    expect(player.flea.results).toEqual(sold);
    expect(player.flea.stats).toMatchObject({ sold: 1, earned: 1500 });
    expect(player.flea.pressure.food_can).toEqual({ value: 0.1, at: MIN });
  });

  it("preço alto demais nunca vende: vence e devolve o item", () => {
    const { player, can, list } = listed();
    list(3000);
    const results = fleaTick(player, TEST_FLEA, 11 * MIN);
    expect(results).toEqual([{ kind: "expired", id: 1, item: can }]);
    expect(player.flea.listings).toEqual([]);
    expect(player.flea.stats.sold).toBe(0);
  });

  it("vence no momento exato mesmo sem sorteio depois", () => {
    const { player, list } = listed();
    list(3000);
    expect(fleaTick(player, TEST_FLEA, 10 * MIN)).toHaveLength(1);
  });

  it("é determinístico pela seed e conta o tempo com o jogo fechado", () => {
    const outcome = (seed: number) => {
      const { player, put } = market();
      player.flea.seed = seed;
      put("money_rub", 10_000);
      const cans = [put("food_can"), put("food_can")];
      for (const can of cans) listItem(player, TEST_FLEA, can, 1500, 0);
      // de uma vez, como se o jogo ficasse fechado 1 h
      fleaTick(player, TEST_FLEA, HOUR);
      return player.flea.results.map((r) => r.kind).join();
    };
    expect(outcome(42)).toBe(outcome(42));
    const all = new Set(Array.from({ length: 30 }, (_, s) => outcome(s)));
    expect([...all].some((r) => r.includes("sold"))).toBe(true);
    expect([...all].join()).toMatch(/sold|expired/);
  });

  it("um anúncio novo não sorteia momentos de antes dele", () => {
    const { player, put } = market();
    put("money_rub", 10_000);
    const a = put("food_can");
    const b = put("food_can");
    // último cálculo bem antigo: começa no anúncio mais velho
    player.flea.lastCheck = -1000 * HOUR;
    listItem(player, SURE, a, 1500, 0);
    listItem(player, SURE, b, 1500, 3 * MIN + 1);
    expect(fleaTick(player, SURE, 2 * MIN).map((r) => r.id)).toEqual([1]);
    expect(player.flea.listings.map((l) => l.id)).toEqual([2]);
    expect(fleaTick(player, SURE, 4 * MIN).map((r) => r.id)).toEqual([2]);
  });

  it("venda sorteada depois de uma compra mais nova não volta a pressão", () => {
    const { player, list } = listed(0, SURE);
    list(1500);
    fleaBuy(player, SURE, "food_can", 5 * MIN);
    fleaTick(player, SURE, 5 * MIN);
    expect(player.flea.pressure.food_can.at).toBe(5 * MIN);
    expect(pressureAt(player.flea, SURE, "food_can", 5 * MIN)).toBeCloseTo(0);
  });
});

describe("retirar resultados", () => {
  it("venda vira dinheiro; vencido volta ao estoque", () => {
    const { player, put, list } = listed(0, SURE);
    expect(collectResult(player, SURE, 1)).toEqual({
      ok: false,
      reason: "Nada para retirar",
    });
    list(1500);
    fleaTick(player, SURE, MIN);
    const before = countInStash(player.inventory.stash, "money_rub");
    expect(collectResult(player, SURE, 1)).toEqual({ ok: true, amount: 1500 });
    expect(countInStash(player.inventory.stash, "money_rub")).toBe(
      before + 1500,
    );
    expect(player.flea.results).toEqual([]);

    const can = put("food_can");
    listItem(player, TEST_FLEA, can, 3000, MIN);
    fleaTick(player, TEST_FLEA, HOUR);
    expect(collectResult(player, TEST_FLEA, 2)).toEqual({
      ok: true,
      amount: 1,
    });
    expect(can.location?.kind).toBe("grid");
  });

  it("sem espaço, o resultado espera", () => {
    const { player, put } = market(2, 1);
    put("money_rub", 1000);
    const can = put("food_can");
    listItem(player, TEST_FLEA, can, 3000, 0);
    put("food_can");
    fleaTick(player, TEST_FLEA, HOUR);
    expect(collectResult(player, TEST_FLEA, 1)).toEqual({
      ok: false,
      reason: "Sem espaço no estoque",
    });
    expect(player.flea.results).toHaveLength(1);
  });
});
