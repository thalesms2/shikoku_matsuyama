// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { startRaid } from "../../../src/core/raid/profile.ts";
import { RaidScene, SPEEDS } from "../../../src/ui/scenes/RaidScene.ts";
import {
  TEST_ENEMIES,
  TEST_MAP,
  armedPlayer,
} from "../../core/raid/raidFixtures.ts";

describe("RaidScene: velocidade inicial", () => {
  it("usa a das configurações; sem ela, x1", () => {
    const { player } = armedPlayer();
    const clock = new ManualClock(0);
    startRaid(player, TEST_MAP, "balanced", TEST_ENEMIES, clock);
    const options = { clock, map: TEST_MAP, onDone: () => {} };
    expect(new RaidScene(player, { ...options, speed: 16 }).speed).toBe(16);
    expect(new RaidScene(player, options).speed).toBe(SPEEDS[0]);
  });
});
