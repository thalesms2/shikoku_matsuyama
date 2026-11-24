import { describe, expect, it } from "vitest";

import { xpForLevel } from "../../../src/core/pmc/pmc.ts";
import {
  REPUTATION_PER_100K,
  buy,
  countInStash,
  loyaltyLevel,
  nextLevel,
  offerPrice,
  restock,
  sell,
  sellPrice,
  stashItems,
  stockLeft,
  storeAll,
  traderState,
} from "../../../src/core/trade/trade.ts";
import { catalog } from "../../../src/data/items.ts";
import { HOUR, TEST_TRADER, USD_TRADER, trader } from "./tradeFixtures.ts";

const offer = (id: string) => TEST_TRADER.offers.find((o) => o.id === id)!;
const [L1, L2] = TEST_TRADER.levels;

describe("estado e reposição", () => {
  it("cria o estado no primeiro acesso e reaproveita depois", () => {
    const traders = {};
    const state = traderState(traders, TEST_TRADER, 500);
    expect(state).toEqual({
      reputation: 0,
      volume: 0,
      bought: {},
      restockAt: 500 + HOUR,
    });
    expect(traderState(traders, TEST_TRADER, 9999)).toBe(state);
  });

  it("repõe na hora e mantém o ritmo depois de várias reposições", () => {
    const state = traderState({}, TEST_TRADER, 0);
    state.bought = { bolts: 2 };
    expect(restock(TEST_TRADER, state, HOUR - 1)).toBe(false);
    expect(state.bought).toEqual({ bolts: 2 });
    expect(restock(TEST_TRADER, state, HOUR)).toBe(true);
    expect(state.bought).toEqual({});
    expect(state.restockAt).toBe(2 * HOUR);
    expect(restock(TEST_TRADER, state, 4.5 * HOUR)).toBe(true);
    expect(state.restockAt).toBe(5 * HOUR);
  });

  it("estoque restante", () => {
    const state = traderState({}, TEST_TRADER, 0);
    expect(stockLeft(offer("bolts"), state)).toBe(2);
    state.bought.bolts = 5;
    expect(stockLeft(offer("bolts"), state)).toBe(0);
  });
});

describe("lealdade", () => {
  it("nível pelos requisitos (PMC, reputação e volume)", () => {
    const state = traderState({}, TEST_TRADER, 0);
    expect(loyaltyLevel(TEST_TRADER, state, 0)).toBe(L1);
    state.reputation = 0.1;
    state.volume = 1000;
    expect(loyaltyLevel(TEST_TRADER, state, 0)).toBe(L1);
    expect(loyaltyLevel(TEST_TRADER, state, xpForLevel(2))).toBe(L2);
    state.volume = 999;
    expect(loyaltyLevel(TEST_TRADER, state, xpForLevel(2))).toBe(L1);
  });

  it("próximo nível", () => {
    expect(nextLevel(TEST_TRADER, L1)).toBe(L2);
    expect(nextLevel(TEST_TRADER, L2)).toBeNull();
  });
});

describe("preços", () => {
  it("basePrice × quantidade × markup, convertido e arredondado para cima", () => {
    expect(offerPrice(TEST_TRADER, offer("bolts"), L1, catalog)).toEqual({
      currency: "money_rub",
      amount: 3750,
    });
    expect(offerPrice(TEST_TRADER, offer("ammo"), L2, catalog)?.amount).toBe(
      45 * 50 * 1.2,
    );
    // 2500 × 1,5 / 122 = 30,7 → 31
    expect(offerPrice(USD_TRADER, offer("bolts"), L1, catalog)).toEqual({
      currency: "money_usd",
      amount: 31,
    });
  });

  it("preço fixo, moeda própria e troca", () => {
    expect(offerPrice(USD_TRADER, offer("usd"), L1, catalog)).toEqual({
      currency: "money_rub",
      amount: 1500,
    });
    expect(
      offerPrice(
        USD_TRADER,
        { ...offer("usd"), currency: undefined },
        L1,
        catalog,
      ),
    ).toEqual({ currency: "money_usd", amount: 1500 });
    expect(offerPrice(TEST_TRADER, offer("gold"), L1, catalog)).toBeNull();
  });

  it("preço mínimo de 1", () => {
    const cheap = { ...offer("bolts"), item: "money_rub" };
    expect(offerPrice(USD_TRADER, cheap, L1, catalog)?.amount).toBe(1);
  });
});

describe("estoque do jogador", () => {
  it("lista e conta itens dentro de contêineres", () => {
    const { player, put } = trader();
    const sack = put("backpack_sack");
    put("money_rub", 100);
    put("money_rub", 50, sack.grids[0]);
    const { stash } = player.inventory;
    expect(stashItems(stash)).toHaveLength(3);
    expect(countInStash(stash, "money_rub")).toBe(150);
    expect(countInStash(stash, "money_usd")).toBe(0);
  });

  it("storeAll: tudo ou nada", () => {
    const { player, factory, put } = trader(2, 1);
    const ammo = put("ammo_9mm", 45);
    const first = factory.create("barter_bolts");
    const second = factory.create("ammo_9mm", 50);
    expect(storeAll([first, second], player.inventory.stash)).toBe(false);
    expect(first.location).toBeNull();
    expect(ammo.count).toBe(45);
    expect(player.inventory.stash.items()).toEqual([ammo]);
    expect(
      storeAll([factory.create("ammo_9mm", 5)], player.inventory.stash),
    ).toBe(true);
    expect(ammo.count).toBe(50);
  });
});

describe("buy", () => {
  it("compra com dinheiro: guarda, paga, conta estoque, volume e reputação", () => {
    const { player, put } = trader();
    put("money_rub", 10_000);
    const result = buy(player, TEST_TRADER, "bolts", 0);
    expect(result).toEqual({ ok: true, amount: 1 });
    const { stash } = player.inventory;
    expect(countInStash(stash, "barter_bolts")).toBe(1);
    expect(countInStash(stash, "money_rub")).toBe(6250);
    const state = player.traders.test;
    expect(state.bought).toEqual({ bolts: 1 });
    expect(state.volume).toBe(3750);
    expect(state.reputation).toBeCloseTo(0.0375 * REPUTATION_PER_100K);
  });

  it("pilhas: completa a pilha que já existe; paga de várias pilhas", () => {
    const { player, put } = trader();
    const ammo = put("ammo_9mm", 10);
    const a = put("money_rub", 2000);
    // segunda pilha separada (o autoPlace juntaria as duas)
    const b = player.factory.create("money_rub", 2000);
    player.inventory.stash.place(b, 5, 5, false);
    expect(buy(player, TEST_TRADER, "bolts", 0).ok).toBe(true);
    expect(a.location).toBeNull();
    expect(b.count).toBe(250);
    put("money_rub", 10_000);
    expect(buy(player, TEST_TRADER, "ammo", 0)).toEqual({
      ok: true,
      amount: 50,
    });
    expect(ammo.count).toBe(50);
    expect(countInStash(player.inventory.stash, "ammo_9mm")).toBe(60);
  });

  it("câmbio: compra dólares pagando rublos", () => {
    const { player, put } = trader();
    put("money_rub", 1500);
    expect(buy(player, USD_TRADER, "usd", 0).ok).toBe(true);
    const { stash } = player.inventory;
    expect(countInStash(stash, "money_usd")).toBe(10);
    expect(countInStash(stash, "money_rub")).toBe(0);
  });

  it("troca: paga com itens do estoque (inclusive de dentro de contêineres)", () => {
    const { player, put } = trader();
    const sack = put("backpack_sack");
    put("barter_bolts");
    put("barter_bolts", 1, sack.grids[0]);
    put("barter_bolts");
    expect(buy(player, TEST_TRADER, "gold", 0).ok).toBe(true);
    const { stash } = player.inventory;
    expect(countInStash(stash, "barter_bolts")).toBe(1);
    expect(countInStash(stash, "barter_goldchain")).toBe(1);
    expect(player.traders.test.volume).toBe(5000);
  });

  it("recusas: oferta, nível, estoque, dinheiro, itens e espaço", () => {
    const { player, put } = trader();
    expect(buy(player, TEST_TRADER, "nada", 0)).toEqual({
      ok: false,
      reason: "Oferta não existe",
    });
    expect(buy(player, TEST_TRADER, "gpu", 0)).toEqual({
      ok: false,
      reason: "Exige lealdade nível 2",
    });
    expect(buy(player, TEST_TRADER, "bolts", 0)).toEqual({
      ok: false,
      reason: "Dinheiro insuficiente",
    });
    expect(buy(player, TEST_TRADER, "gold", 0)).toEqual({
      ok: false,
      reason: "Faltam itens para a troca",
    });
    put("money_rub", 100_000);
    expect(buy(player, TEST_TRADER, "bolts", 0).ok).toBe(true);
    expect(buy(player, TEST_TRADER, "bolts", 0).ok).toBe(true);
    expect(buy(player, TEST_TRADER, "bolts", 0)).toEqual({
      ok: false,
      reason: "Esgotado",
    });
    // a compra repõe o estoque quando passa da hora
    expect(buy(player, TEST_TRADER, "bolts", HOUR).ok).toBe(true);
  });

  it("sem espaço: nada muda", () => {
    const { player, put } = trader(1, 1);
    const money = put("money_rub", 10_000);
    expect(buy(player, TEST_TRADER, "bolts", 0)).toEqual({
      ok: false,
      reason: "Sem espaço no estoque",
    });
    expect(money.count).toBe(10_000);
    expect(player.traders.test.bought).toEqual({});
  });

  it("não paga com contêiner cheio nem com item em uso no carregamento", () => {
    const { player, put } = trader();
    const custom = {
      ...TEST_TRADER,
      offers: [
        {
          id: "x",
          item: "barter_bolts",
          level: 1,
          stock: 5,
          barter: [{ item: "backpack_sack", count: 1 }],
        },
        {
          id: "y",
          item: "barter_bolts",
          level: 1,
          stock: 5,
          barter: [{ item: "ammo_9mm", count: 10 }],
        },
      ],
    };
    const sack = put("backpack_sack");
    put("food_can", 1, sack.grids[0]);
    expect(buy(player, custom, "x", 0).ok).toBe(false);
    const ammo = put("ammo_9mm", 20);
    const mag = put("mag_pk9");
    player.loader.start({ kind: "load", magazine: mag, ammo });
    expect(buy(player, custom, "y", 0)).toEqual({
      ok: false,
      reason: "Faltam itens para a troca",
    });
    player.loader.cancel();
    expect(buy(player, custom, "y", 0).ok).toBe(true);
    expect(ammo.count).toBe(10);
  });
});

describe("sellPrice", () => {
  const { factory, put } = trader();

  it("valor × taxa do nível × categoria, na moeda do vendedor", () => {
    expect(
      sellPrice(TEST_TRADER, factory.create("barter_bolts"), L1, catalog),
    ).toEqual({
      ok: true,
      amount: 1250,
    });
    expect(
      sellPrice(TEST_TRADER, factory.create("barter_bolts"), L2, catalog),
    ).toEqual({
      ok: true,
      amount: 1500,
    });
    expect(
      sellPrice(TEST_TRADER, factory.create("pistol_pk9"), L1, catalog),
    ).toEqual({
      ok: true,
      amount: 1625,
    });
    // 2500 × 0,5 / 122 = 10,2 → 10
    expect(
      sellPrice(USD_TRADER, factory.create("barter_bolts"), L1, catalog),
    ).toEqual({
      ok: true,
      amount: 10,
    });
  });

  it("motivos para não comprar", () => {
    const no = { ok: false, reason: "Não compra este tipo de item" };
    expect(
      sellPrice(TEST_TRADER, factory.create("money_rub", 5), L1, catalog),
    ).toEqual(no);
    expect(
      sellPrice(TEST_TRADER, factory.create("food_can"), L1, catalog),
    ).toEqual(no);
    const sack = { ...TEST_TRADER, buys: { backpack: 1 } };
    const full = put("backpack_sack");
    put("food_can", 1, full.grids[0]);
    expect(sellPrice(sack, full, L1, catalog)).toEqual({
      ok: false,
      reason: "Esvazie antes de vender",
    });
    expect(
      sellPrice(TEST_TRADER, factory.create("secure_pouch"), L1, catalog),
    ).toEqual({
      ok: false,
      reason: "Não vale nada",
    });
  });
});

describe("sell", () => {
  it("vende do estoque: recebe dinheiro, soma volume e reputação", () => {
    const { player, put } = trader();
    const bolts = put("barter_bolts");
    expect(sell(player, TEST_TRADER, bolts, 0)).toEqual({
      ok: true,
      amount: 1250,
    });
    expect(bolts.location).toBeNull();
    const { stash } = player.inventory;
    expect(countInStash(stash, "money_rub")).toBe(1250);
    expect(player.traders.test.volume).toBe(1250);
    expect(player.traders.test.reputation).toBeCloseTo(
      0.0125 * REPUTATION_PER_100K,
    );
  });

  it("em dólar: volume em rublos", () => {
    const { player, put } = trader();
    expect(sell(player, USD_TRADER, put("barter_bolts"), 0)).toEqual({
      ok: true,
      amount: 10,
    });
    expect(player.traders.usd.volume).toBe(1220);
  });

  it("item dentro de contêiner do estoque", () => {
    const { player, put } = trader();
    const sack = put("backpack_sack");
    const bolts = put("barter_bolts", 1, sack.grids[0]);
    expect(sell(player, TEST_TRADER, bolts, 0).ok).toBe(true);
  });

  it("recusas: fora do estoque, em uso, preço", () => {
    const { player, factory, put } = trader();
    const loose = factory.create("barter_bolts");
    expect(sell(player, TEST_TRADER, loose, 0)).toEqual({
      ok: false,
      reason: "O item precisa estar no estoque",
    });
    const ammo = put("ammo_9mm", 20);
    const mag = put("mag_pk9");
    player.loader.start({ kind: "load", magazine: mag, ammo });
    const busy = { ok: false, reason: "Item em uso no carregamento" };
    expect(sell(player, TEST_TRADER, ammo, 0)).toEqual(busy);
    expect(sell(player, TEST_TRADER, mag, 0)).toEqual(busy);
    expect(sell(player, TEST_TRADER, put("food_can"), 0).ok).toBe(false);
  });

  it("dinheiro sem espaço: o item volta para o lugar", () => {
    const { player, put } = trader(3, 3);
    const sack = put("backpack_sack");
    const bolts = put("barter_bolts", 1, sack.grids[0]);
    const spot = { ...bolts.location! };
    expect(sell(player, TEST_TRADER, bolts, 0)).toEqual({
      ok: false,
      reason: "Sem espaço no estoque para o dinheiro",
    });
    expect(bolts.location).toEqual(spot);
    expect(player.traders.test).toMatchObject({ volume: 0 });
  });

  it("quantia acima da pilha máxima vira várias pilhas", () => {
    const { player, put } = trader();
    const rich = {
      ...TEST_TRADER,
      levels: [{ ...L1, sellRate: 10 }],
    };
    expect(sell(player, rich, put("barter_gpu"), 0)).toEqual({
      ok: true,
      amount: 1_200_000,
    });
    const stacks = player.inventory.stash.items().map((i) => i.count);
    expect(stacks.sort((a, b) => a - b)).toEqual([200_000, 500_000, 500_000]);
  });
});
