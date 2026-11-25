import { describe, expect, it } from "vitest";

import {
  constructionOf,
  constructions,
  hideoutTick,
  moduleLevel,
  startUpgrade,
  upgradeBlockers,
} from "../../../src/core/hideout/hideout.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import { trader } from "../trade/tradeFixtures.ts";
import { HOUR, MIN, TEST_HIDEOUT } from "./hideoutFixtures.ts";

const D = TEST_HIDEOUT;
const mod = (id: string) => D.modules.find((m) => m.id === id)!;

describe("várias obras ao mesmo tempo", () => {
  it("começa obras em módulos diferentes; o mesmo módulo fica bloqueado", () => {
    const { player, put } = trader();
    put("money_rub", 1000);
    put("barter_bolts");
    put("barter_bolts");
    expect(startUpgrade(player, D, TRADERS, "power", 0).ok).toBe(true);
    expect(startUpgrade(player, D, TRADERS, "radio", 0).ok).toBe(true);
    expect(startUpgrade(player, D, TRADERS, "store", 0).ok).toBe(true);
    const state = player.hideout;
    expect(state.construction?.module).toBe("power");
    expect(state.extraConstructions?.map((c) => c.module)).toEqual([
      "radio",
      "store",
    ]);
    expect(constructions(state).map((c) => c.module)).toEqual([
      "power",
      "radio",
      "store",
    ]);
    expect(constructionOf(state, "radio")?.endsAt).toBe(HOUR);
    expect(upgradeBlockers(player, D, TRADERS, mod("radio"), 0)).toEqual([
      "Obra em andamento",
    ]);
    expect(startUpgrade(player, D, TRADERS, "radio", 0)).toEqual({
      ok: false,
      reason: "Obra em andamento",
    });
    expect(startUpgrade(player, D, TRADERS, "nada", 0)).toEqual({
      ok: false,
      reason: "Módulo não existe",
    });
  });

  it("o tick conclui todas na ordem do fim, mudando a cura no meio", () => {
    const { player } = trader();
    const state = player.hideout;
    player.pmc.health.thorax = 20;
    state.construction = { module: "radio", level: 1, endsAt: 2 * HOUR };
    state.extraConstructions = [
      { module: "store", level: 1, endsAt: HOUR },
      { module: "power", level: 1, endsAt: 30 * MIN },
    ];
    // só a do Energia terminou: a lista de outras obras continua
    hideoutTick(player, D, 40 * MIN);
    expect(moduleLevel(state, "power")).toBe(1);
    expect(state.extraConstructions).toEqual([
      { module: "store", level: 1, endsAt: HOUR },
    ]);
    expect(player.pmc.health.thorax).toBe(20);
    // Depósito em 1h (cura 1/min depois), rádio em 2h
    hideoutTick(player, D, HOUR + 10 * MIN);
    expect(player.pmc.health.thorax).toBe(30);
    hideoutTick(player, D, 3 * HOUR);
    expect(moduleLevel(state, "store")).toBe(1);
    expect(moduleLevel(state, "radio")).toBe(1);
    expect(state.construction).toBeNull();
    expect(state.extraConstructions).toBeUndefined();
    expect(state.incomeSince).toBe(2 * HOUR);
    expect(player.inventory.stash.height).toBe(12);
  });

  it("a primeira obra termina e as outras continuam", () => {
    const { player } = trader();
    const state = player.hideout;
    state.construction = { module: "power", level: 1, endsAt: MIN };
    state.extraConstructions = [{ module: "radio", level: 1, endsAt: HOUR }];
    hideoutTick(player, D, 2 * MIN);
    expect(state.construction).toBeNull();
    expect(constructionOf(state, "radio")).not.toBeNull();
    expect(constructionOf(state, "power")).toBeNull();
  });
});
