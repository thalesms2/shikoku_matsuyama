import { afterEach, describe, expect, it } from "vitest";

import {
  CORE_DEFAULTS,
  resetCoreBalance,
  setCoreBalance,
} from "../../../src/core/balance.ts";
import {
  addFuel,
  fuelBlocker,
  hasPower,
  hideoutTick,
  incomeAvailable,
} from "../../../src/core/hideout/hideout.ts";
import { countInStash } from "../../../src/core/trade/trade.ts";
import { trader } from "../trade/tradeFixtures.ts";
import { FUEL_HIDEOUT } from "./fuelFixtures.ts";
import { HOUR, MIN, TEST_HIDEOUT } from "./hideoutFixtures.ts";

const D = FUEL_HIDEOUT;

afterEach(() => {
  resetCoreBalance();
});

describe("combustível do gerador", () => {
  it("energia: sem combustível no jogo, sem gerador ou com combustível", () => {
    const { player } = trader();
    const state = player.hideout;
    expect(hasPower(state, TEST_HIDEOUT)).toBe(true);
    expect(hasPower(state, D)).toBe(true);
    state.modules.power = 1;
    expect(hasPower(state, D)).toBe(false);
    state.fuel = 1;
    expect(hasPower(state, D)).toBe(true);
  });

  it("abastecer: gerador, galão no estoque e tanque cheio", () => {
    const { player, put } = trader();
    expect(fuelBlocker(player, TEST_HIDEOUT)).toBe("Sem gerador");
    expect(addFuel(player, D)).toEqual({
      ok: false,
      reason: "Energia nível 1",
    });
    player.hideout.modules.power = 1;
    expect(fuelBlocker(player, D)).toBe("Faltam: Galão de combustível (0/1)");
    put("barter_fuel");
    put("barter_fuel");
    expect(addFuel(player, D)).toEqual({ ok: true, amount: 10 });
    expect(player.hideout.fuel).toBe(10);
    expect(countInStash(player.inventory.stash, "barter_fuel")).toBe(1);
    player.hideout.fuel = 25;
    expect(fuelBlocker(player, D)).toBe("Tanque cheio");
    player.hideout.fuel = 20;
    expect(addFuel(player, D).ok).toBe(true);
    expect(player.hideout.fuel).toBe(30);
  });

  it("queima por hora; acabando, o tanque fica vazio", () => {
    const { player } = trader();
    const state = player.hideout;
    state.fuel = 10;
    hideoutTick(player, D, 5 * HOUR);
    expect(state.fuel).toBe(10);
    state.modules.power = 1;
    hideoutTick(player, D, 10 * HOUR);
    expect(state.fuel).toBe(5);
    hideoutTick(player, D, 15 * HOUR);
    expect(state.fuel).toBeUndefined();
    // morto também gasta
    state.fuel = 2;
    player.pmc.health.head = 0;
    hideoutTick(player, D, 16 * HOUR);
    expect(state.fuel).toBe(1);
    // sem tempo, não gasta
    hideoutTick(player, D, 16 * HOUR);
    expect(state.fuel).toBe(1);
  });

  it("sem combustível, produções e renda param", () => {
    const { player } = trader();
    const state = player.hideout;
    state.modules = { power: 1, radio: 1 };
    state.fuel = 1;
    state.productions = {
      power: { recipe: "ammo", endsAt: 3 * HOUR },
      store: { recipe: "late", endsAt: 30 * MIN },
    };
    hideoutTick(player, D, 2 * HOUR);
    expect(state.fuel).toBeUndefined();
    expect(state.productions.power.endsAt).toBe(4 * HOUR);
    expect(state.productions.store.endsAt).toBe(30 * MIN);
    expect(state.incomeSince).toBe(HOUR);
    expect(incomeAvailable(state, D, 2 * HOUR)).toBe(1000);
    hideoutTick(player, D, 3 * HOUR);
    expect(state.productions.power.endsAt).toBe(5 * HOUR);
    expect(state.incomeSince).toBe(2 * HOUR);
  });

  it("renda coletada depois do corte não volta no tempo", () => {
    const { player } = trader();
    const state = player.hideout;
    state.modules = { power: 1, radio: 1 };
    state.incomeSince = 30 * MIN;
    hideoutTick(player, D, HOUR);
    expect(state.incomeSince).toBe(HOUR);
    state.incomeSince = 3 * HOUR;
    hideoutTick(player, D, 2 * HOUR);
    expect(state.incomeSince).toBe(3 * HOUR);
  });

  it("sem gasto por hora, nunca acaba", () => {
    setCoreBalance({
      ...CORE_DEFAULTS,
      fuel: { ...CORE_DEFAULTS.fuel, perHour: 0 },
    });
    const { player } = trader();
    player.hideout.modules.power = 1;
    hideoutTick(player, D, HOUR);
    expect(player.hideout.fuel).toBeUndefined();
    player.hideout.fuel = 3;
    hideoutTick(player, D, 10 * HOUR);
    expect(player.hideout.fuel).toBe(3);
  });
});
