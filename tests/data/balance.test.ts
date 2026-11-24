import { afterEach, describe, expect, it } from "vitest";

import { CORE_DEFAULTS, coreBalance } from "../../src/core/balance.ts";
import {
  DEFAULT_BALANCE,
  applyBalance,
  currentBalance,
  readBalance,
  resetBalance,
} from "../../src/data/balance.ts";
import { FLEA } from "../../src/data/flea.ts";
import { catalog } from "../../src/data/items.ts";

afterEach(() => {
  resetBalance();
});

describe("balanceamento do jogo", () => {
  it("o padrão é o dos dados, sem ajustes", () => {
    expect(DEFAULT_BALANCE.core).toEqual(CORE_DEFAULTS);
    expect(DEFAULT_BALANCE.items).toEqual({});
    expect(DEFAULT_BALANCE.flea.checkMs).toBe(60_000);
    expect(currentBalance()).toEqual(DEFAULT_BALANCE);
  });

  it("aplicar muda o core, os itens do catálogo e o mercado; reset volta", () => {
    const doc = structuredClone(DEFAULT_BALANCE);
    doc.core.xp.consumableSkill = 8;
    doc.items.pistol_pk9 = { basePrice: 1, stats: { damage: 99 } };
    doc.flea.feeRate = 0.5;
    applyBalance(doc);
    expect(coreBalance().xp.consumableSkill).toBe(8);
    expect(catalog.get("pistol_pk9").basePrice).toBe(1);
    expect(catalog.get("pistol_pk9").stats?.damage).toBe(99);
    expect(FLEA.feeRate).toBe(0.5);
    expect(currentBalance()).toEqual(doc);
    resetBalance();
    expect(catalog.get("pistol_pk9").basePrice).toBe(6500);
    expect(FLEA.feeRate).toBe(0.04);
    expect(currentBalance()).toEqual(DEFAULT_BALANCE);
  });

  it("readBalance valida tudo e completa com o padrão", () => {
    expect(readBalance(null)).toEqual(DEFAULT_BALANCE);
    const read = readBalance({
      core: { xp: { consumableSkill: 3 } },
      flea: {
        feeRate: 0.1,
        checkMs: 0,
        trendMs: -5,
        maxRatio: 1,
        slots: 4,
        currency: "money_usd",
      },
      items: {
        pistol_pk9: {
          basePrice: 10,
          stats: { damage: 5, caliber: "x", heal: -1 },
        },
        rifle_vk74: { basePrice: "caro", stats: { damage: "alto" } },
        med_kit: { stats: null },
        ghost: { basePrice: 1 },
        ammo_9mm: "nada",
      },
    });
    expect(read.core.xp.consumableSkill).toBe(3);
    expect(read.flea.feeRate).toBe(0.1);
    expect(read.flea.slots).toBe(4);
    expect(read.flea.checkMs).toBe(60_000);
    expect(read.flea.trendMs).toBe(DEFAULT_BALANCE.flea.trendMs);
    expect(read.flea.maxRatio).toBe(2);
    expect("currency" in read.flea).toBe(false);
    expect(read.items).toEqual({
      pistol_pk9: { basePrice: 10, stats: { damage: 5 } },
    });
    expect(
      readBalance({ flea: { maxRatio: 3 }, items: null }).flea.maxRatio,
    ).toBe(3);
  });
});
