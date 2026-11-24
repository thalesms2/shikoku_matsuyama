import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import {
  attachMagazine,
  loadRounds,
} from "../../../src/core/inventory/magazine.ts";
import {
  autoPlace,
  moveToSlot,
} from "../../../src/core/inventory/operations.ts";
import { simulateRaid } from "../../../src/core/raid/simulate.ts";
import type { RaidOutcome, StrategyId } from "../../../src/core/raid/types.ts";
import { Rng } from "../../../src/core/rng.ts";
import type { PlayerState } from "../../../src/core/state.ts";
import { ENEMIES, mapById } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const RUNS = 150;

/** Kit inicial com fuzil carregado, colete, capacete e kit médico equipados */
function geared(): PlayerState {
  const player = createNewPlayer(new ManualClock());
  const { stash, equipment } = player.inventory;
  const find = (id: string) => stash.items().find((i) => i.def.id === id)!;
  moveToSlot(find("armor_civil"), equipment, "armor");
  moveToSlot(find("helmet_tk1"), equipment, "helmet");
  const [mag, spare] = stash.items().filter((i) => i.def.id === "mag_vk74");
  loadRounds(mag, find("ammo_545"));
  loadRounds(spare, find("ammo_545"));
  const rifle = find("rifle_vk74");
  attachMagazine(rifle, mag);
  moveToSlot(rifle, equipment, "primary");
  autoPlace(spare, equipment.carryGrids());
  autoPlace(find("med_kit"), equipment.carryGrids());
  return player;
}

function rates(map: string, strategy: StrategyId, kit: () => PlayerState) {
  const count: Record<RaidOutcome, number> = {
    extracted: 0,
    killed: 0,
    mia: 0,
  };
  let loot = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const { summary } = simulateRaid({
      player: kit(),
      map: mapById(map)!,
      strategy,
      enemies: ENEMIES,
      rng: new Rng(seed * 7919),
      lootRule: "valuePerCell",
    });
    count[summary.outcome]++;
    loot += summary.lootValue;
  }
  return {
    extracted: count.extracted / RUNS,
    mia: count.mia / RUNS,
    loot: loot / RUNS,
  };
}

const starter = () => createNewPlayer(new ManualClock());

// Faixas de balanceamento (seeds fixas, então o resultado é sempre o mesmo)
describe("balanceamento (Monte Carlo com seed fixa)", () => {
  it("Periferia com kit bom e estratégia equilibrada: quase sempre extrai", () => {
    const r = rates("outskirts", "balanced", geared);
    expect(r.extracted).toBeGreaterThan(0.85);
    expect(r.extracted).toBeLessThan(0.99);
  });

  it("equipamento melhor sobrevive mais", () => {
    expect(rates("harbor", "balanced", geared).extracted).toBeGreaterThan(
      rates("harbor", "balanced", starter).extracted + 0.05,
    );
  });

  it("agressivo morre mais que furtivo, mas traz mais loot por raid no Porto", () => {
    const stealth = rates("harbor", "stealth", geared);
    const aggressive = rates("harbor", "aggressive", geared);
    expect(aggressive.extracted).toBeLessThan(stealth.extracted - 0.2);
    expect(aggressive.loot).toBeGreaterThan(stealth.loot);
  });

  it("MIA é raro em qualquer estratégia", () => {
    for (const s of ["stealth", "balanced", "aggressive"] as const) {
      expect(rates("cement", s, geared).mia).toBeLessThan(0.05);
    }
  });
});
