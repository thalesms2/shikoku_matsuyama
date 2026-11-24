// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { xpForLevel } from "../../../src/core/pmc/pmc.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { EndingScene, endingText } from "../../../src/ui/scenes/EndingScene.ts";

describe("EndingScene", () => {
  it("texto com nível e estatísticas", () => {
    const player = createNewPlayer(new ManualClock());
    player.pmc.xp = xpForLevel(9);
    player.raid.stats.raids = 30;
    player.raid.stats.kills.pmc = 4;
    player.scav.stats.raids = 6;
    const text = endingText(player);
    expect(text).toContain("Você saiu.");
    expect(text).toContain("PMC nível 9");
    expect(text).toContain("Raids: 30 · Extrações: 0");
    expect(text).toContain("Abates: 0 Scav, 4 PMC · Raids Scav: 6");
  });

  it("título, continuar e redimensionar", () => {
    const player = createNewPlayer(new ManualClock());
    const onContinue = vi.fn();
    const scene = new EndingScene(player, onContinue);
    expect((scene.content.children[0] as Text).text).toBe("VOCÊ ESCAPOU");
    scene.continueButton.emit("pointertap", {} as never);
    expect(onContinue).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
    scene.resize(352, 100000);
    expect(scene.content.scale.x).toBeCloseTo(0.5);
  });
});
