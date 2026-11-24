import { describe, expect, it } from "vitest";

import { ManualClock } from "../../src/core/clock.ts";
import { createPlayerState, storageFor } from "../../src/core/state.ts";
import { createNewPlayer } from "../../src/data/newGame.ts";

describe("createPlayerState", () => {
  it("sem as partes opcionais, começa os perfis a partir do relógio", () => {
    const state = createNewPlayer(new ManualClock());
    const again = createPlayerState(
      {
        inventory: state.inventory,
        pmc: state.pmc,
        skills: state.skills,
        factory: state.factory,
      },
      new ManualClock(5),
    );
    expect(again.inventory).toBe(state.inventory);
    expect(again.hideout.lastTick).toBe(5);
    expect(again.loadouts).toEqual([]);
  });
});

describe("storageFor", () => {
  it("grade do item primeiro, depois equipamento e estoque, sem repetir", () => {
    const { inventory } = createNewPlayer(new ManualClock());
    const carry = inventory.equipment.carryGrids();
    const stashItem = inventory.stash.items()[0];
    expect(storageFor(inventory, stashItem)).toEqual([
      inventory.stash,
      ...carry,
    ]);
    const pocketItem = inventory.equipment.pockets[0].items()[0];
    expect(storageFor(inventory, pocketItem)).toEqual([
      ...carry,
      inventory.stash,
    ]);
  });

  it("itens fora de grade usam equipamento e estoque", () => {
    const { inventory } = createNewPlayer(new ManualClock());
    const pistol = inventory.equipment.get("holster")!;
    expect(storageFor(inventory, pistol)).toEqual([
      ...inventory.equipment.carryGrids(),
      inventory.stash,
    ]);
  });
});
