import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { startScavRaid } from "../../../src/core/raid/scav.ts";
import type { StrategyId } from "../../../src/core/raid/types.ts";
import { ENEMIES, mapById } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { SCAV_LOADOUT } from "../../../src/data/scav.ts";

const RUNS = 150;

function rates(map: string, strategy: StrategyId, karma: number) {
  let extracted = 0;
  let loot = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const clock = new ManualClock();
    const player = createNewPlayer(clock);
    // Estoque grande: a conta é do loot, não do espaço
    player.inventory.stash = new Grid(20, 40);
    player.raid.seed = seed * 7919;
    player.raid.karma = karma;
    const { summary } = startScavRaid(
      player,
      mapById(map)!,
      strategy,
      ENEMIES,
      SCAV_LOADOUT,
      clock,
    );
    if (summary.outcome === "extracted") extracted++;
    loot += summary.lootValue;
  }
  return { extracted: extracted / RUNS, loot: loot / RUNS };
}

// Faixas de balanceamento (seeds fixas, então o resultado é sempre o mesmo)
describe("balanceamento da raid Scav (Monte Carlo com seed fixa)", () => {
  it("Periferia, equilibrado, karma 0: extrai na maioria das vezes", () => {
    const r = rates("outskirts", "balanced", 0);
    expect(r.extracted).toBeGreaterThan(0.75);
    expect(r.extracted).toBeLessThan(0.97);
  });

  it("karma alto extrai mais e traz mais loot que karma baixo", () => {
    const good = rates("harbor", "balanced", 10);
    const bad = rates("harbor", "balanced", -10);
    expect(good.extracted).toBeGreaterThan(bad.extracted + 0.08);
    expect(good.loot).toBeGreaterThan(bad.loot * 1.8);
  });

  it("Porto agressivo é arriscado para o Scav", () => {
    expect(rates("harbor", "aggressive", 0).extracted).toBeLessThan(0.6);
  });
});
