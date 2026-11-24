// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import {
  SCAV_COOLDOWN_MS,
  scavCooldownMs,
} from "../../../src/core/raid/scav.ts";
import { HIDEOUT } from "../../../src/data/hideout.ts";
import { ENEMIES, MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { RaidSetupScene } from "../../../src/ui/scenes/RaidSetupScene.ts";
import { TEST_HIDEOUT } from "../../core/hideout/hideoutFixtures.ts";

function scavWith(levels: Record<string, number>, custom = false) {
  const clock = new ManualClock(1000);
  const player = createNewPlayer(clock);
  player.hideout.modules = levels;
  const scene = new RaidSetupScene(player, {
    maps: MAPS,
    enemies: ENEMIES,
    clock,
    onStart: vi.fn(),
    onBack: vi.fn(),
    ...(custom && { hideout: TEST_HIDEOUT }),
  });
  scene.startScav();
  return player.scav.readyAt - 1000;
}

describe("RaidSetupScene: Posto de vigia corta o cooldown da raid Scav", () => {
  it("sem o módulo, cooldown cheio; com ele, menor", () => {
    expect(scavWith({})).toBe(SCAV_COOLDOWN_MS);
    const cut = HIDEOUT.modules.find((m) => m.id === "watchtower")!.levels[0]
      .effects.scavCooldown!;
    expect(scavWith({ watchtower: 1 })).toBe(scavCooldownMs(0, cut));
    expect(scavWith({ watchtower: 1 })).toBeLessThan(SCAV_COOLDOWN_MS);
  });

  it("aceita outros dados de esconderijo", () => {
    expect(scavWith({ radio: 1 }, true)).toBe(scavCooldownMs(0, 0.2));
  });
});
