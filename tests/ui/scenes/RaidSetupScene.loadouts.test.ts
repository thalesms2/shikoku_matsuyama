// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { ENEMIES, MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { RaidSetupScene } from "../../../src/ui/scenes/RaidSetupScene.ts";

function scene(onOpenLoadouts?: () => void) {
  const clock = new ManualClock(1000);
  return new RaidSetupScene(createNewPlayer(clock), {
    maps: MAPS,
    enemies: ENEMIES,
    clock,
    onStart: vi.fn(),
    onBack: vi.fn(),
    onOpenLoadouts,
  });
}

describe("RaidSetupScene: botão Loadouts", () => {
  it("à esquerda de Voltar e abre os loadouts", () => {
    const open = vi.fn();
    const s = scene(open);
    const button = s.loadoutsButton!;
    expect(button.text.text).toBe("Loadouts");
    expect(button.x + button.buttonWidth).toBeLessThan(s.backButton.x);
    button.emit("pointertap", {} as never);
    expect(open).toHaveBeenCalledOnce();
  });

  it("sem o callback, sem botão", () => {
    expect(scene().loadoutsButton).toBeNull();
  });
});
