// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { ENEMIES, MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { RaidSetupScene } from "../../../src/ui/scenes/RaidSetupScene.ts";

function scene(extra: {
  onOpenAuto?: () => void;
  onOpenLoadouts?: () => void;
}) {
  const clock = new ManualClock(1000);
  return new RaidSetupScene(createNewPlayer(clock), {
    maps: MAPS,
    enemies: ENEMIES,
    clock,
    onStart: vi.fn(),
    onBack: vi.fn(),
    ...extra,
  });
}

describe("RaidSetupScene: botão Automático", () => {
  it("à esquerda de Loadouts e abre as raids automáticas", () => {
    const open = vi.fn();
    const s = scene({ onOpenAuto: open, onOpenLoadouts: () => {} });
    const button = s.autoButton!;
    expect(button.text.text).toBe("Automático");
    expect(button.x + button.buttonWidth).toBeLessThan(s.loadoutsButton!.x);
    button.emit("pointertap", {} as never);
    expect(open).toHaveBeenCalledOnce();
  });

  it("sem Loadouts, encosta em Voltar; sem callback, sem botão", () => {
    const s = scene({ onOpenAuto: () => {} });
    expect(s.autoButton!.x + s.autoButton!.buttonWidth).toBeLessThan(
      s.backButton.x,
    );
    expect(scene({}).autoButton).toBeNull();
  });
});
