import { describe, expect, it } from "vitest";

import { finishRaid, startRaid } from "../../../src/core/raid/profile.ts";
import { TEST_ENEMIES, TEST_MAP, armedPlayer } from "./raidFixtures.ts";

describe("finishRaid com a raid da tela", () => {
  it("só fecha se ela ainda for a raid em andamento", () => {
    const { player } = armedPlayer();
    const clock = { now: () => 0 };
    const old = startRaid(player, TEST_MAP, "balanced", TEST_ENEMIES, clock);
    const newer = startRaid(player, TEST_MAP, "balanced", TEST_ENEMIES, clock);
    finishRaid(player, old);
    expect(player.raid.active).toBe(newer);
    finishRaid(player, newer);
    expect(player.raid.active).toBeNull();
  });
});
