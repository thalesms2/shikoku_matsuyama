import { describe, expect, it } from "vitest";

import { MatrixRaid } from "../../../src/core/matrix/raid.ts";
import { CONTAINERS } from "../../../src/data/containers.ts";
import { ScriptRng, armedPlayer } from "../raid/raidFixtures.ts";
import { smallMap } from "./matrixFixtures.ts";

function setup() {
  const { player } = armedPlayer();
  const raid = new MatrixRaid({
    player,
    map: smallMap(["....."], [{ id: "e", name: "Saída", x: 4, y: 0 }]),
    strategy: "neutral",
    rng: new ScriptRng(),
    containers: CONTAINERS,
  });
  return { raid, player };
}

describe("óculos e cobertura do rosto na percepção", () => {
  it("óculos somam à Percepção; balaclava tira da percepção do inimigo", () => {
    const { raid, player } = setup();
    const see = raid.playerPerception();
    const seen = raid.enemyPerception();
    const eq = player.inventory.equipment;
    eq.equip("eyewear", player.factory.create("eyewear_tactical"));
    eq.equip("face", player.factory.create("face_balaclava"));
    expect(raid.playerPerception()).toBe(see + 3);
    expect(raid.enemyPerception()).toBe(seen - 3);
  });
});
