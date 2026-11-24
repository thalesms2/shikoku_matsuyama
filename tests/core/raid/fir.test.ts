import { describe, expect, it } from "vitest";

import { autoPlace } from "../../../src/core/inventory/operations.ts";
import { armedPlayer, makeSim } from "./raidFixtures.ts";

function withLoot() {
  const { player } = armedPlayer();
  player.inventory.equipment.equip(
    "secure",
    player.factory.create("secure_pouch"),
  );
  const { sim } = makeSim(player);
  const kept = player.factory.create("barter_bolts");
  autoPlace(kept, player.inventory.equipment.get("secure")!.grids);
  const dropped = player.factory.create("barter_goldchain");
  sim.found.add(kept).add(dropped);
  return { sim, kept, dropped };
}

describe('loot "encontrado na raid"', () => {
  it("extraiu: o loot que saiu com o PMC fica marcado", () => {
    const { sim, kept, dropped } = withLoot();
    sim.finish("extracted");
    expect(kept.fir).toBe(true);
    expect(dropped.fir).toBeUndefined();
  });

  it("morreu: nem o contêiner seguro conta", () => {
    const { sim, kept } = withLoot();
    sim.finish("killed");
    expect(kept.fir).toBeUndefined();
  });
});
