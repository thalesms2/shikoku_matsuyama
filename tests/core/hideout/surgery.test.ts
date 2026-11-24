import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { hideoutTick } from "../../../src/core/hideout/hideout.ts";
import type { HideoutData } from "../../../src/core/hideout/types.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const MIN = 60_000;

/** Enfermaria que só opera (sem cura), para conferir os PV exatos */
const DATA: HideoutData = {
  modules: [
    {
      id: "med",
      name: "Enfermaria",
      description: "",
      levels: [
        {
          level: 1,
          cost: [],
          requires: {},
          buildMs: 1,
          effects: { surgeryMinutes: 30 },
        },
      ],
    },
  ],
  recipes: [],
};

function setup() {
  const player = createNewPlayer(new ManualClock(0));
  player.hideout.modules.med = 1;
  return player;
}

describe("cirurgia da enfermaria", () => {
  it("uma parte a cada intervalo, guardando o progresso entre cálculos", () => {
    const player = setup();
    player.pmc.health.leftArm = 0;
    player.pmc.health.rightLeg = 0;
    hideoutTick(player, DATA, 20 * MIN);
    expect(player.hideout.surgeryProgress).toBe(20);
    expect(player.pmc.health.leftArm).toBe(0);
    hideoutTick(player, DATA, 35 * MIN);
    expect(player.pmc.health.leftArm).toBe(1);
    expect(player.pmc.health.rightLeg).toBe(0);
    expect(player.hideout.surgeryProgress).toBe(5);
    // de uma vez (jogo fechado): a última parte e o progresso some
    hideoutTick(player, DATA, 5 * 60 * MIN);
    expect(player.pmc.health.rightLeg).toBe(1);
    expect(player.hideout.surgeryProgress).toBeUndefined();
  });

  it("sem parte destruída, não guarda progresso; sem o efeito, não opera", () => {
    const player = setup();
    hideoutTick(player, DATA, 40 * MIN);
    expect(player.hideout.surgeryProgress).toBeUndefined();
    player.hideout.modules = {};
    player.pmc.health.leftArm = 0;
    hideoutTick(player, DATA, 400 * MIN);
    expect(player.pmc.health.leftArm).toBe(0);
  });
});
