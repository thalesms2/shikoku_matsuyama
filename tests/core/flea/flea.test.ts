import { describe, expect, it } from "vitest";

import {
  buyPrice,
  cancelListing,
  createFleaState,
  expectedSaleMs,
  fleaBuy,
  fleaUnlocked,
  hashText,
  listItem,
  listingFee,
  listingValue,
  lotSize,
  marketDefs,
  marketPrice,
  mix,
  pressureAt,
  priceTrend,
  saleChance,
  tradeable,
  trendFactor,
} from "../../../src/core/flea/flea.ts";
import { attachMagazine } from "../../../src/core/inventory/magazine.ts";
import { autoPlace, detach } from "../../../src/core/inventory/operations.ts";
import { countInStash } from "../../../src/core/trade/trade.ts";
import { catalog } from "../../../src/data/items.ts";
import { HOUR, MIN, TEST_FLEA, market } from "./fleaFixtures.ts";

const def = (id: string) => catalog.get(id);

describe("mercado: seed e liberação", () => {
  it("mix e hashText são determinísticos e espalham", () => {
    expect(mix(1, 2, 3)).toBe(mix(1, 2, 3));
    expect(mix(1, 2, 3)).not.toBe(mix(3, 2, 1));
    expect(mix(-1)).toBeGreaterThanOrEqual(0);
    expect(hashText("ammo_9mm")).toBe(hashText("ammo_9mm"));
    expect(hashText("ammo_9mm")).not.toBe(hashText("ammo_545"));
  });

  it("estado novo", () => {
    const state = createFleaState(1234.7);
    expect(state).toEqual({
      seed: mix(1234),
      nextListing: 1,
      listings: [],
      results: [],
      pressure: {},
      lastCheck: 1234.7,
      stats: { sold: 0, earned: 0, fees: 0, bought: 0, spent: 0 },
    });
  });

  it("libera pelo nível do PMC", () => {
    const { player } = market();
    expect(fleaUnlocked(player, TEST_FLEA)).toBe(true);
    player.pmc.xp = 0;
    expect(fleaUnlocked(player, TEST_FLEA)).toBe(false);
  });

  it("itens do mercado: sem dinheiro, sem valor e sem banidos, por nome", () => {
    expect(tradeable(def("money_rub"), TEST_FLEA)).toBe(false);
    expect(tradeable(def("secure_pouch"), TEST_FLEA)).toBe(false);
    expect(tradeable(def("key_garage"), TEST_FLEA)).toBe(false);
    expect(tradeable(def("barter_bolts"), TEST_FLEA)).toBe(true);
    const defs = marketDefs(catalog, TEST_FLEA);
    expect(defs.map((d) => d.id)).not.toContain("money_usd");
    expect(defs.map((d) => d.name)).toEqual(
      defs.map((d) => d.name).sort((a, b) => a.localeCompare(b)),
    );
  });
});

describe("mercado: preços", () => {
  const WAVY = { ...TEST_FLEA, trendAmplitude: 0.2 };

  it("tendência: dentro da faixa, contínua e diferente por item", () => {
    expect(trendFactor(TEST_FLEA, 1, "ammo_9mm", 12345)).toBe(1);
    const at = (t: number, id = "ammo_9mm") => trendFactor(WAVY, 7, id, t);
    for (let t = 0; t < 30 * HOUR; t += 17 * MIN) {
      expect(at(t)).toBeGreaterThanOrEqual(0.8);
      expect(at(t)).toBeLessThanOrEqual(1.2);
    }
    // linha reta entre os pontos de cada hora
    expect(at(3.5 * HOUR)).toBeCloseTo((at(3 * HOUR) + at(4 * HOUR)) / 2);
    expect(at(4 * HOUR - 1)).toBeCloseTo(at(4 * HOUR), 5);
    const values = new Set(
      Array.from({ length: 10 }, (_, h) => at(h * HOUR).toFixed(6)),
    );
    expect(values.size).toBeGreaterThan(5);
    expect(at(HOUR)).not.toBe(at(HOUR, "ammo_545"));
    expect(trendFactor(WAVY, 8, "ammo_9mm", HOUR)).not.toBe(at(HOUR));
  });

  it("pressão cai pela metade a cada meia-vida", () => {
    const state = createFleaState(0);
    expect(pressureAt(state, TEST_FLEA, "ammo_9mm", 0)).toBe(0);
    state.pressure.ammo_9mm = { value: 0.2, at: HOUR };
    expect(pressureAt(state, TEST_FLEA, "ammo_9mm", 0)).toBe(0.2);
    expect(pressureAt(state, TEST_FLEA, "ammo_9mm", 2 * HOUR)).toBeCloseTo(0.1);
    expect(pressureAt(state, TEST_FLEA, "ammo_9mm", 3 * HOUR)).toBeCloseTo(
      0.05,
    );
  });

  it("preço de mercado: base × tendência × (1 − pressão limitada)", () => {
    const state = createFleaState(0);
    expect(marketPrice(state, TEST_FLEA, def("barter_bolts"), 0)).toBe(2500);
    state.pressure.barter_bolts = { value: 0.1, at: 0 };
    expect(marketPrice(state, TEST_FLEA, def("barter_bolts"), 0)).toBe(2250);
    state.pressure.barter_bolts = { value: 5, at: 0 };
    expect(marketPrice(state, TEST_FLEA, def("barter_bolts"), 0)).toBe(1750);
    state.pressure.barter_bolts = { value: -5, at: 0 };
    expect(marketPrice(state, TEST_FLEA, def("barter_bolts"), 0)).toBe(3250);
    // nunca abaixo de 1
    state.pressure.money_rub = { value: 0.9, at: 0 };
    const deep = { ...TEST_FLEA, pressureLimit: 0.9 };
    expect(marketPrice(state, deep, def("money_rub"), 0)).toBe(1);
  });

  it("seta da tendência compara com uma hora antes (sem a pressão)", () => {
    const { player } = market(10, 10, 2 * HOUR);
    const bolts = def("barter_bolts");
    expect(priceTrend(player.flea, TEST_FLEA, bolts, 2 * HOUR)).toBe(0);
    player.flea.pressure.barter_bolts = { value: -0.1, at: 2 * HOUR };
    expect(priceTrend(player.flea, TEST_FLEA, bolts, 2 * HOUR)).toBe(0);
    const seen = new Set<number>();
    for (let h = 1; h < 40; h++) {
      const now = h * HOUR;
      const dir = priceTrend(player.flea, WAVY, bolts, now);
      const trend = (t: number) => trendFactor(WAVY, 42, "barter_bolts", t);
      expect(dir).toBe(
        Math.sign(
          Math.round(2500 * trend(now)) - Math.round(2500 * trend(now - HOUR)),
        ),
      );
      seen.add(dir);
    }
    expect(seen).toEqual(new Set([-1, 1]));
  });

  it("compra: pilha cheia pelo preço de mercado × markup", () => {
    const state = createFleaState(0);
    expect(lotSize(def("ammo_9mm"))).toBe(50);
    expect(lotSize(def("barter_bolts"))).toBe(1);
    expect(buyPrice(state, TEST_FLEA, def("barter_bolts"), catalog, 0)).toBe(
      2750,
    );
    expect(
      buyPrice(
        state,
        { ...TEST_FLEA, currency: "money_usd" },
        def("barter_bolts"),
        catalog,
        0,
      ),
    ).toBe(Math.ceil(2750 / 122));
  });
});

describe("mercado: comprar", () => {
  it("recusa bloqueado, fora do mercado, sem dinheiro ou sem espaço", () => {
    const { player, put } = market(2, 1);
    expect(fleaBuy(player, TEST_FLEA, "nada", 0)).toEqual({
      ok: false,
      reason: "Item fora do mercado",
    });
    expect(fleaBuy(player, TEST_FLEA, "key_garage", 0)).toEqual({
      ok: false,
      reason: "Item fora do mercado",
    });
    expect(fleaBuy(player, TEST_FLEA, "barter_bolts", 0)).toEqual({
      ok: false,
      reason: "Dinheiro insuficiente",
    });
    put("money_rub", 10_000);
    put("food_can");
    expect(fleaBuy(player, TEST_FLEA, "barter_bolts", 0)).toEqual({
      ok: false,
      reason: "Sem espaço no estoque",
    });
    player.pmc.xp = 0;
    expect(fleaBuy(player, TEST_FLEA, "barter_bolts", 0)).toEqual({
      ok: false,
      reason: "O mercado libera no nível 2",
    });
    expect(countInStash(player.inventory.stash, "money_rub")).toBe(10_000);
  });

  it("compra: item sem marca de raid, paga, sobe o preço e conta", () => {
    const { player, put } = market();
    put("money_rub", 10_000);
    const price = buyPrice(player.flea, TEST_FLEA, def("ammo_9mm"), catalog, 0);
    expect(fleaBuy(player, TEST_FLEA, "ammo_9mm", 0)).toEqual({
      ok: true,
      amount: 50,
    });
    const ammo = player.inventory.stash
      .items()
      .find((i) => i.def.id === "ammo_9mm")!;
    expect(ammo.count).toBe(50);
    expect(ammo.fir).toBeFalsy();
    expect(countInStash(player.inventory.stash, "money_rub")).toBe(
      10_000 - price,
    );
    expect(pressureAt(player.flea, TEST_FLEA, "ammo_9mm", 0)).toBeCloseTo(-0.1);
    expect(marketPrice(player.flea, TEST_FLEA, def("ammo_9mm"), 0)).toBe(50);
    expect(player.flea.stats).toMatchObject({ bought: 1, spent: price });
  });
});

describe("mercado: anunciar", () => {
  it("valor de mercado e motivos para não anunciar", () => {
    const { player, put, factory } = market();
    const ammo = put("ammo_9mm", 10);
    expect(listingValue(player, TEST_FLEA, ammo, 0)).toEqual({
      ok: true,
      amount: 450,
    });
    const loose = factory.create("food_can");
    expect(listingValue(player, TEST_FLEA, loose, 0)).toEqual({
      ok: false,
      reason: "O item precisa estar no estoque",
    });
    const money = put("money_rub", 100);
    expect(listingValue(player, TEST_FLEA, money, 0)).toEqual({
      ok: false,
      reason: "Não pode ser vendido no mercado",
    });
    const bolts = put("barter_bolts");
    expect(listingValue(player, TEST_FLEA, bolts, 0)).toEqual({
      ok: false,
      reason: "Só itens encontrados na raid",
    });
    bolts.fir = true;
    expect(listingValue(player, TEST_FLEA, bolts, 0).ok).toBe(true);

    const box = put("ammo_case");
    autoPlace(factory.create("ammo_545", 5), [box.grids[0]]);
    expect(listingValue(player, TEST_FLEA, box, 0)).toEqual({
      ok: false,
      reason: "Esvazie antes de anunciar",
    });
    const mag = put("mag_pk9");
    mag.rounds!.push({ def: def("ammo_9mm"), count: 3 });
    expect(listingValue(player, TEST_FLEA, mag, 0).ok).toBe(false);
    mag.rounds!.length = 0;
    const pistol = put("pistol_pk9");
    attachMagazine(pistol, factory.create("mag_pk9"));
    expect(listingValue(player, TEST_FLEA, pistol, 0)).toEqual({
      ok: false,
      reason: "Esvazie antes de anunciar",
    });

    player.loader.start({ kind: "load", magazine: mag, ammo });
    expect(listingValue(player, TEST_FLEA, ammo, 0)).toEqual({
      ok: false,
      reason: "Item em uso no carregamento",
    });
    player.pmc.xp = 0;
    expect(listingValue(player, TEST_FLEA, bolts, 0)).toEqual({
      ok: false,
      reason: "O mercado libera no nível 2",
    });
  });

  it("taxa cresce com o quadrado da razão; mínimo 1", () => {
    expect(listingFee(TEST_FLEA, 10_000, 10_000)).toBe(500);
    expect(listingFee(TEST_FLEA, 10_000, 20_000)).toBe(2000);
    expect(listingFee(TEST_FLEA, 10_000, 5000)).toBe(125);
    expect(listingFee(TEST_FLEA, 1, 1)).toBe(1);
  });

  it("chance de venda pela razão preço/valor", () => {
    expect(saleChance(TEST_FLEA, 1)).toBe(0.5);
    expect(saleChance(TEST_FLEA, 1.5)).toBeCloseTo(0.125);
    expect(saleChance(TEST_FLEA, 0.5)).toBe(1);
    expect(saleChance(TEST_FLEA, 2)).toBe(0);
    expect(saleChance(TEST_FLEA, 3)).toBe(0);
    expect(expectedSaleMs(TEST_FLEA, 1)).toBe(2 * MIN);
    expect(expectedSaleMs(TEST_FLEA, 2)).toBe(Infinity);
  });

  it("anuncia: paga a taxa e o item sai do estoque", () => {
    const { player, put } = market();
    put("money_rub", 1000);
    const ammo = put("ammo_9mm", 20);
    expect(listItem(player, TEST_FLEA, ammo, 900, 5)).toEqual({
      ok: true,
      amount: 45,
    });
    expect(ammo.location).toBeNull();
    expect(countInStash(player.inventory.stash, "money_rub")).toBe(955);
    expect(player.flea.listings).toEqual([
      { id: 1, item: ammo, price: 900, listedAt: 5, expiresAt: 5 + 10 * MIN },
    ]);
    expect(player.flea.nextListing).toBe(2);
    expect(player.flea.stats.fees).toBe(45);
  });

  it("recusa preço inválido, item inválido, sem vaga ou sem dinheiro", () => {
    const { player, put } = market();
    const a = put("food_can");
    const b = put("food_can");
    const c = put("food_can");
    expect(listItem(player, TEST_FLEA, a, 0, 0)).toEqual({
      ok: false,
      reason: "Preço inválido",
    });
    expect(listItem(player, TEST_FLEA, a, 1.5, 0).ok).toBe(false);
    expect(listItem(player, TEST_FLEA, a, 1500, 0)).toEqual({
      ok: false,
      reason: "Dinheiro insuficiente para a taxa",
    });
    put("money_rub", 1000);
    expect(listItem(player, TEST_FLEA, a, 1500, 0).ok).toBe(true);
    expect(listItem(player, TEST_FLEA, a, 1500, 0)).toEqual({
      ok: false,
      reason: "O item precisa estar no estoque",
    });
    expect(listItem(player, TEST_FLEA, b, 1500, 0).ok).toBe(true);
    expect(listItem(player, TEST_FLEA, c, 1500, 0)).toEqual({
      ok: false,
      reason: "Todos os anúncios estão ocupados",
    });
  });

  it("cancelar: o item volta (a taxa não); sem espaço, continua anunciado", () => {
    const { player, put } = market(2, 1);
    put("money_rub", 1000);
    const can = put("food_can");
    listItem(player, TEST_FLEA, can, 1500, 0);
    expect(cancelListing(player, 99)).toEqual({
      ok: false,
      reason: "Anúncio não existe",
    });
    const filler = put("food_can");
    expect(cancelListing(player, 1)).toEqual({
      ok: false,
      reason: "Sem espaço no estoque",
    });
    expect(player.flea.listings).toHaveLength(1);
    detach(filler);
    expect(cancelListing(player, 1)).toEqual({ ok: true, amount: 1 });
    expect(can.location?.kind).toBe("grid");
    expect(player.flea.listings).toEqual([]);
  });
});
