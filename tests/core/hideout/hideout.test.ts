import { describe, expect, it } from "vitest";

import {
  collectIncome,
  collectProduction,
  createHideoutState,
  currentLevel,
  effect,
  hideoutTick,
  incomeAvailable,
  moduleLevel,
  nextModuleLevel,
  productionBlockers,
  recipeDuration,
  startProduction,
  startUpgrade,
  upgradeBlockers,
} from "../../../src/core/hideout/hideout.ts";
import { totalHealth, xpForLevel } from "../../../src/core/pmc/pmc.ts";
import { countInStash } from "../../../src/core/trade/trade.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import { trader } from "../trade/tradeFixtures.ts";
import { HOUR, MIN, TEST_HIDEOUT } from "./hideoutFixtures.ts";

const D = TEST_HIDEOUT;
const mod = (id: string) => D.modules.find((m) => m.id === id)!;
const recipe = (id: string) => D.recipes.find((r) => r.id === id)!;

describe("níveis e efeitos", () => {
  it("estado novo, níveis atual e próximo", () => {
    const state = createHideoutState(500);
    expect(state).toEqual({
      modules: {},
      construction: null,
      productions: {},
      incomeSince: 500,
      lastTick: 500,
    });
    expect(moduleLevel(state, "store")).toBe(0);
    expect(currentLevel(state, mod("store"))).toBeNull();
    expect(nextModuleLevel(state, mod("store"))?.level).toBe(1);
    state.modules.store = 2;
    expect(currentLevel(state, mod("store"))?.level).toBe(2);
    expect(nextModuleLevel(state, mod("store"))).toBeNull();
  });

  it("soma dos efeitos dos níveis atuais", () => {
    const state = createHideoutState(0);
    expect(effect(state, D, "healPerMinute")).toBe(0);
    state.modules = { store: 1, radio: 1 };
    expect(effect(state, D, "healPerMinute")).toBe(1);
    expect(effect(state, D, "scavCooldown")).toBe(0.2);
    state.modules.radio = 2;
    expect(effect(state, D, "scavCooldown")).toBe(0);
  });
});

describe("obras", () => {
  it("requisitos que faltam e nível máximo", () => {
    const { player } = trader();
    player.hideout.modules.store = 1;
    expect(upgradeBlockers(player, D, TRADERS, mod("store"), 0)).toEqual([
      "Energia nível 1",
      "Lealdade nível 2 com Doutora Iara",
      "PMC nível 3",
    ]);
    player.hideout.modules.power = 1;
    player.pmc.xp = xpForLevel(5);
    player.traders.doctor = {
      reputation: 1,
      volume: 1e7,
      bought: {},
      restockAt: 0,
    };
    expect(upgradeBlockers(player, D, TRADERS, mod("store"), 0)).toEqual([]);
    player.hideout.modules.store = 2;
    expect(upgradeBlockers(player, D, TRADERS, mod("store"), 0)).toEqual([
      "Nível máximo",
    ]);
  });

  it("começa: paga e marca o fim", () => {
    const { player, put } = trader();
    expect(upgradeBlockers(player, D, TRADERS, mod("power"), 0)).toEqual([
      "Faltam: Rublos-velhos (0/1000)",
    ]);
    expect(startUpgrade(player, D, TRADERS, "power", 0)).toEqual({
      ok: false,
      reason: "Faltam: Rublos-velhos (0/1000)",
    });
    put("money_rub", 1500);
    expect(startUpgrade(player, D, TRADERS, "power", 100)).toEqual({
      ok: true,
      amount: 1,
    });
    expect(countInStash(player.inventory.stash, "money_rub")).toBe(500);
    expect(player.hideout.construction).toEqual({
      module: "power",
      level: 1,
      endsAt: 100 + 10 * MIN,
    });
    expect(startUpgrade(player, D, TRADERS, "nada", 0)).toEqual({
      ok: false,
      reason: "Módulo não existe",
    });
  });

  it("termina no tick: aplica o nível e aumenta o estoque", () => {
    const { player, put } = trader(4, 4);
    put("barter_bolts");
    put("barter_bolts");
    startUpgrade(player, D, TRADERS, "store", 0);
    hideoutTick(player, D, HOUR - 1);
    expect(moduleLevel(player.hideout, "store")).toBe(0);
    expect(player.inventory.stash.height).toBe(4);
    hideoutTick(player, D, HOUR);
    expect(moduleLevel(player.hideout, "store")).toBe(1);
    expect(player.hideout.construction).toBeNull();
    expect(player.inventory.stash.height).toBe(6);
    // nível 2: cresce só a diferença
    player.hideout.construction = { module: "store", level: 2, endsAt: HOUR };
    hideoutTick(player, D, HOUR);
    expect(player.inventory.stash.height).toBe(9);
  });
});

describe("cura e comida entre raids", () => {
  it("por minuto, com a obra mudando a taxa no meio", () => {
    const { player } = trader();
    const { pmc } = player;
    pmc.health.thorax = 20;
    pmc.energy = 50;
    pmc.hydration = 50;
    player.hideout.modules.store = 1;
    expect(hideoutTick(player, D, 10 * MIN)).toBe(10);
    expect(pmc.health.thorax).toBe(30);
    expect(pmc.energy).toBe(50);
    // obra do nível 2 termina na metade dos próximos 20 min
    player.hideout.construction = {
      module: "store",
      level: 2,
      endsAt: 20 * MIN,
    };
    hideoutTick(player, D, 30 * MIN);
    // 10 min × 1 + 10 min × 2
    expect(pmc.health.thorax).toBe(60);
    expect(pmc.energy).toBe(60);
    expect(pmc.hydration).toBe(60);
    expect(player.hideout.lastTick).toBe(30 * MIN);
  });

  it("sem tempo, sem módulos ou morto: nada muda", () => {
    const { player } = trader();
    player.pmc.health.thorax = 20;
    expect(hideoutTick(player, D, 0)).toBe(0);
    hideoutTick(player, D, HOUR);
    expect(player.pmc.health.thorax).toBe(20);
    player.hideout.modules.store = 1;
    player.pmc.health.head = 0;
    const before = totalHealth(player.pmc);
    hideoutTick(player, D, 2 * HOUR);
    expect(totalHealth(player.pmc)).toBe(before);
    // relógio voltando não tira tempo
    expect(hideoutTick(player, D, HOUR)).toBe(0);
    expect(player.hideout.lastTick).toBe(2 * HOUR);
  });

  it("obra que terminou antes do último cálculo não repete a cura", () => {
    const { player } = trader();
    player.hideout.lastTick = HOUR;
    player.hideout.construction = { module: "store", level: 1, endsAt: 0 };
    player.pmc.health.thorax = 20;
    hideoutTick(player, D, HOUR + MIN);
    expect(player.pmc.health.thorax).toBe(21);
  });
});

describe("produção", () => {
  it("duração com o desconto (limitado a 90%)", () => {
    const state = createHideoutState(0);
    expect(recipeDuration(state, D, recipe("water"))).toBe(HOUR);
    state.modules.power = 1;
    expect(recipeDuration(state, D, recipe("water"))).toBe(HOUR / 2);
    const fast = {
      ...D,
      modules: D.modules.map((m) =>
        m.id === "power"
          ? {
              ...m,
              levels: [{ ...m.levels[0], effects: { productionSpeed: 2 } }],
            }
          : m,
      ),
    };
    expect(recipeDuration(state, fast, recipe("water"))).toBe(HOUR / 10);
  });

  it("bloqueios: nível, produção em andamento e ingredientes", () => {
    const { player, put } = trader();
    expect(productionBlockers(player, D, recipe("ammo"))).toEqual([
      "Energia nível 1",
      "Faltam: Parafusos (0/1)",
    ]);
    player.hideout.modules.power = 1;
    put("barter_bolts");
    expect(productionBlockers(player, D, recipe("ammo"))).toEqual([]);
    expect(startProduction(player, D, "nada", 0)).toEqual({
      ok: false,
      reason: "Receita não existe",
    });
    expect(startProduction(player, D, "ammo", 0)).toEqual({
      ok: true,
      amount: 0,
    });
    expect(countInStash(player.inventory.stash, "barter_bolts")).toBe(0);
    expect(player.hideout.productions.power).toEqual({
      recipe: "ammo",
      endsAt: HOUR,
    });
    expect(startProduction(player, D, "water", 0)).toEqual({
      ok: false,
      reason: "Produção em andamento",
    });
  });

  it("retirar: só pronto, precisa caber, em pilhas", () => {
    const { player, put } = trader(1, 1);
    player.hideout.modules.power = 1;
    expect(collectProduction(player, D, "power", 0)).toEqual({
      ok: false,
      reason: "Nada sendo produzido",
    });
    put("barter_bolts");
    expect(startProduction(player, D, "ammo", 0).ok).toBe(true);
    expect(collectProduction(player, D, "power", HOUR - 1)).toEqual({
      ok: false,
      reason: "Ainda não terminou",
    });
    const blocker = put("barter_bolts");
    expect(collectProduction(player, D, "power", HOUR)).toEqual({
      ok: false,
      reason: "Sem espaço no estoque",
    });
    player.inventory.stash.remove(blocker);
    player.inventory.stash.addRows(2);
    expect(collectProduction(player, D, "power", HOUR)).toEqual({
      ok: true,
      amount: 120,
    });
    expect(player.inventory.stash.items().map((i) => i.count)).toEqual([
      50, 50, 20,
    ]);
    expect(player.hideout.productions.power).toBeUndefined();
  });

  it("receita que saiu do jogo é descartada", () => {
    const { player } = trader();
    player.hideout.productions.power = { recipe: "sumiu", endsAt: 0 };
    expect(collectProduction(player, D, "power", 0)).toEqual({
      ok: true,
      amount: 0,
    });
    expect(player.hideout.productions).toEqual({});
  });
});

describe("renda passiva", () => {
  it("acumula por hora até o máximo e coleta", () => {
    const { player } = trader();
    const state = player.hideout;
    expect(incomeAvailable(state, D, 10 * HOUR)).toBe(0);
    expect(collectIncome(player, D, 10 * HOUR)).toEqual({
      ok: false,
      reason: "Nada para coletar",
    });
    state.modules.radio = 1;
    expect(incomeAvailable(state, D, 1.5 * HOUR)).toBe(1500);
    expect(incomeAvailable(state, D, 10 * HOUR)).toBe(3000);
    expect(incomeAvailable(state, D, -HOUR)).toBe(0);
    expect(collectIncome(player, D, 2 * HOUR)).toEqual({
      ok: true,
      amount: 2000,
    });
    expect(state.incomeSince).toBe(2 * HOUR);
    expect(countInStash(player.inventory.stash, "money_rub")).toBe(2000);
  });

  it("a primeira estação começa a contar quando fica pronta", () => {
    const { player } = trader();
    player.hideout.construction = { module: "radio", level: 1, endsAt: HOUR };
    hideoutTick(player, D, 3 * HOUR);
    expect(player.hideout.incomeSince).toBe(HOUR);
    // melhorar a estação não zera a renda acumulada
    player.hideout.construction = {
      module: "radio",
      level: 2,
      endsAt: 3 * HOUR,
    };
    hideoutTick(player, D, 3 * HOUR);
    expect(player.hideout.incomeSince).toBe(HOUR);
  });

  it("sem espaço para o dinheiro: não coleta", () => {
    const { player, put } = trader(1, 1);
    put("barter_bolts");
    player.hideout.modules.radio = 1;
    expect(collectIncome(player, D, HOUR)).toEqual({
      ok: false,
      reason: "Sem espaço no estoque",
    });
    expect(player.hideout.incomeSince).toBe(0);
  });
});
