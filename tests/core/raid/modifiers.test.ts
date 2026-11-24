import { describe, expect, it, vi } from "vitest";

import { NO_MODIFIERS } from "../../../src/core/raid/types.ts";
import type { LootEntry, RaidModifiers } from "../../../src/core/raid/types.ts";
import { TEST_MAP, armedPlayer, emptyPlayer, makeSim } from "./raidFixtures.ts";

const mods = (extra: Partial<RaidModifiers>): RaidModifiers => ({
  ...NO_MODIFIERS,
  ...extra,
});

describe("modificadores da raid (Scav)", () => {
  it("sem modificadores, nada muda", () => {
    const { sim } = makeSim(emptyPlayer());
    expect(sim.mods).toBe(NO_MODIFIERS);
    expect(NO_MODIFIERS).toEqual({
      friendlyScav: 0,
      extractRisk: 1,
      lootWeight: 1,
      lootQuality: 0,
    });
  });

  it("Scav amigável não briga", () => {
    const { player } = armedPlayer();
    const { sim, rng } = makeSim(player, {
      modifiers: mods({ friendlyScav: 0.5 }),
    });
    const chance = vi.spyOn(rng, "chance");
    rng.chances = [true];
    sim.fight("scav");
    expect(chance).toHaveBeenCalledWith(0.5);
    expect(sim.events).toEqual([
      {
        t: 0,
        kind: "avoid",
        text: "Cruzou com Scav de teste, que reconheceu você e seguiu em frente",
      },
    ]);
    expect(sim.karma).toBe(0);
    expect(player.skills.stealth).toBe(0);
  });

  it("Scav hostil (sorteio falhou) e PMC brigam normalmente", () => {
    const { player } = armedPlayer();
    const { sim, rng } = makeSim(player, {
      modifiers: mods({ friendlyScav: 1 }),
    });
    rng.chances = [false];
    sim.fight("scav");
    expect(sim.events[0].kind).toBe("encounter");
    const other = makeSim(armedPlayer().player, {
      modifiers: mods({ friendlyScav: 1 }),
    });
    other.sim.fight("pmc");
    expect(other.sim.events[0].kind).toBe("encounter");
  });

  it("sem chance de Scav amigável, o sorteio não acontece", () => {
    const { sim, rng } = makeSim(armedPlayer().player);
    rng.chances = [true];
    sim.fight("scav");
    // o `true` foi usado para evitar a briga
    expect(sim.events.map((e) => e.kind)).toEqual(["encounter", "avoid"]);
  });

  it("peso do loot multiplicado", () => {
    const { sim, rng } = makeSim(emptyPlayer(), {
      modifiers: mods({ lootWeight: 1.3 }),
    });
    const weighted = vi.spyOn(rng, "weighted");
    rng.weights = ["quiet"];
    sim.event();
    const entries = weighted.mock.calls[0][0] as readonly { weight: number }[];
    expect(entries[0].weight).toBeCloseTo(4 * 1.3);
  });

  it("tocaia na extração multiplicada", () => {
    const map = {
      ...TEST_MAP,
      extracts: [{ id: "exit", name: "Saída", risk: 0.25 }],
    };
    const { sim, rng } = makeSim(emptyPlayer(), {
      map,
      modifiers: mods({ extractRisk: 2 }),
    });
    const chance = vi.spyOn(rng, "chance");
    expect(sim.tryExtract()).toBe("extracted");
    expect(chance).toHaveBeenCalledWith(0.5);
  });

  describe("qualidade do loot", () => {
    const bolts: LootEntry = { item: "barter_bolts", weight: 1 };
    const gold: LootEntry = { item: "barter_goldchain", weight: 1 };
    const map = { ...TEST_MAP, loot: [bolts, gold] };

    const roll = (quality: number, order: LootEntry[], second: boolean) => {
      const { sim, rng } = makeSim(emptyPlayer(), {
        map,
        modifiers: mods({ lootQuality: quality }),
      });
      const chance = vi.spyOn(rng, "chance");
      rng.weights = [...order];
      rng.chances = [second];
      const item = sim.rollLoot();
      return { id: item.def.id, chance, rng };
    };

    it("positiva: fica com o mais valioso", () => {
      const r = roll(0.5, [bolts, gold], true);
      expect(r.id).toBe("barter_goldchain");
      expect(r.chance).toHaveBeenCalledWith(0.5);
      expect(roll(0.5, [gold, bolts], true).id).toBe("barter_goldchain");
    });

    it("negativa: fica com o menos valioso", () => {
      const r = roll(-0.4, [gold, bolts], true);
      expect(r.id).toBe("barter_bolts");
      expect(r.chance).toHaveBeenCalledWith(0.4);
      expect(roll(-0.4, [bolts, gold], true).id).toBe("barter_bolts");
    });

    it("sem a segunda chance, fica o primeiro", () => {
      expect(roll(0.5, [bolts, gold], false).id).toBe("barter_bolts");
    });

    it("qualidade 0 não sorteia de novo", () => {
      const r = roll(0, [gold, bolts], true);
      expect(r.id).toBe("barter_goldchain");
      expect(r.chance).not.toHaveBeenCalled();
      expect(r.rng.weights).toHaveLength(1);
    });
  });
});
