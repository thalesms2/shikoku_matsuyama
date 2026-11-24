import { afterEach, describe, expect, it } from "vitest";

import {
  CORE_DEFAULTS,
  coreBalance,
  readCoreBalance,
  resetCoreBalance,
  setCoreBalance,
} from "../../src/core/balance.ts";
import {
  buildDuration,
  createHideoutState,
  incomeAvailable,
  recipeDuration,
} from "../../src/core/hideout/hideout.ts";
import { durabilityValueFactor } from "../../src/core/inventory/durability.ts";
import { Catalog, ItemFactory } from "../../src/core/inventory/item.ts";
import {
  CONSUMABLE_SKILL_XP,
  magDrillsXpPerRound,
  useConsumable,
} from "../../src/core/pmc/consumables.ts";
import { createPmc, damage } from "../../src/core/pmc/pmc.ts";
import { createSkills } from "../../src/core/pmc/skills.ts";
import { armorWear } from "../../src/core/raid/combat.ts";
import { scavCooldownMs, scavModifiers } from "../../src/core/raid/scav.ts";
import { buy } from "../../src/core/trade/trade.ts";
import { catalog } from "../../src/data/items.ts";
import { HOUR, TEST_HIDEOUT } from "./hideout/hideoutFixtures.ts";
import { TEST_TRADER, trader } from "./trade/tradeFixtures.ts";

const changed = (edit: (b: typeof CORE_DEFAULTS) => void) => {
  const values = structuredClone(CORE_DEFAULTS);
  edit(values);
  setCoreBalance(values);
};

afterEach(() => {
  resetCoreBalance();
});

describe("coreBalance", () => {
  it("começa nos padrões; set guarda uma cópia; reset volta", () => {
    expect(coreBalance()).toEqual(CORE_DEFAULTS);
    expect(coreBalance()).not.toBe(CORE_DEFAULTS);
    const values = structuredClone(CORE_DEFAULTS);
    values.xp.consumableSkill = 9;
    setCoreBalance(values);
    values.xp.consumableSkill = 1;
    expect(coreBalance().xp.consumableSkill).toBe(9);
    resetCoreBalance();
    expect(coreBalance()).toEqual(CORE_DEFAULTS);
  });

  it("readCoreBalance aceita só números finitos ≥ 0 e completa com o padrão", () => {
    expect(readCoreBalance(null)).toEqual(CORE_DEFAULTS);
    expect(readCoreBalance("x")).toEqual(CORE_DEFAULTS);
    const read = readCoreBalance({
      xp: { consumableSkill: 7, magDrillsPerRound: -1 },
      scav: { cooldownMs: Number.NaN, friendlyBase: 0.5 },
      trade: null,
      durability: { armorWear: "1" },
      unknown: { a: 1 },
    });
    expect(read.xp).toEqual({ consumableSkill: 7, magDrillsPerRound: 0.5 });
    expect(read.scav.cooldownMs).toBe(CORE_DEFAULTS.scav.cooldownMs);
    expect(read.scav.friendlyBase).toBe(0.5);
    expect(read.trade).toEqual(CORE_DEFAULTS.trade);
    expect(read.durability).toEqual(CORE_DEFAULTS.durability);
    expect("unknown" in read).toBe(false);
  });
});

describe("o core lê o valor atual", () => {
  it("valor do item quebrado e desgaste da armadura", () => {
    const armor = new ItemFactory(catalog).create("armor_civil");
    armor.durability = 0;
    expect(durabilityValueFactor(armor)).toBeCloseTo(0.3);
    const wear = armorWear(40, 20, 2);
    changed((b) => {
      b.durability.brokenValue = 0.5;
      b.durability.armorWear = 0.1;
    });
    expect(durabilityValueFactor(armor)).toBeCloseTo(0.5);
    expect(armorWear(40, 20, 2)).toBeCloseTo(wear * 2);
  });

  it("XP dos consumíveis e do manuseio de carregador", () => {
    changed((b) => {
      b.xp.consumableSkill = 2;
      b.xp.magDrillsPerRound = 1.5;
    });
    expect(magDrillsXpPerRound()).toBe(1.5);
    const kit = new ItemFactory(catalog).create("med_kit");
    const pmc = createPmc();
    damage(pmc, "thorax", 10);
    const skills = createSkills();
    useConsumable(kit, pmc, skills);
    expect(skills.health).toBe(2);
    expect(CONSUMABLE_SKILL_XP).toBe(5);
  });

  it("reputação por 100 mil negociados", () => {
    changed((b) => {
      b.trade.reputationPer100k = 1;
    });
    const { player, put } = trader();
    put("money_rub", 100_000);
    expect(buy(player, TEST_TRADER, "usd", 0).ok).toBe(true);
    expect(player.traders.test.reputation).toBeCloseTo(1500 / 100_000);
  });

  it("cooldown e karma da raid Scav", () => {
    changed((b) => {
      b.scav.cooldownMs = 1000;
      b.scav.friendlyBase = 0.1;
      b.scav.friendlyPerKarma = 0;
      b.scav.cooldownPerKarma = 0;
    });
    expect(scavCooldownMs(5)).toBe(1000);
    expect(scavModifiers(10).friendlyScav).toBeCloseTo(0.1);
  });

  it("tempos e renda do esconderijo", () => {
    const store = TEST_HIDEOUT.modules.find((m) => m.id === "store")!;
    const water = TEST_HIDEOUT.recipes.find((r) => r.id === "water")!;
    const state = createHideoutState(0);
    state.modules.radio = 1;
    expect(buildDuration(store.levels[0])).toBe(HOUR);
    changed((b) => {
      b.hideout = { buildTime: 0.5, productionTime: 2, income: 3 };
    });
    expect(buildDuration(store.levels[0])).toBe(HOUR / 2);
    expect(recipeDuration(state, TEST_HIDEOUT, water)).toBe(2 * HOUR);
    expect(incomeAvailable(state, TEST_HIDEOUT, HOUR)).toBe(3000);
    expect(incomeAvailable(state, TEST_HIDEOUT, 10 * HOUR)).toBe(9000);
  });
});

describe("Catalog.applyOverrides", () => {
  it("muda preço e dados na mesma definição e volta ao original sem ajuste", () => {
    const local = new Catalog([
      {
        id: "gun",
        name: "Arma",
        shortName: "A",
        category: "weapon",
        width: 2,
        height: 1,
        basePrice: 100,
        stats: { caliber: "C9", damage: 10 },
      },
      {
        id: "rock",
        name: "Pedra",
        shortName: "P",
        category: "barter",
        width: 1,
        height: 1,
        basePrice: 1,
      },
    ]);
    const gun = new ItemFactory(local).create("gun");
    local.applyOverrides({
      gun: { basePrice: 250, stats: { damage: 30 } },
      rock: { stats: { heal: 5 } },
      ghost: { basePrice: 9 },
    });
    expect(gun.def.basePrice).toBe(250);
    expect(gun.def.stats).toEqual({ caliber: "C9", damage: 30 });
    expect(local.get("rock").stats).toEqual({ heal: 5 });
    local.applyOverrides({});
    expect(gun.def.basePrice).toBe(100);
    expect(gun.def.stats).toEqual({ caliber: "C9", damage: 10 });
    expect(local.get("rock").stats).toBeUndefined();
  });
});
