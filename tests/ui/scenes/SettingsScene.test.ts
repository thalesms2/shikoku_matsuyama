// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { defaultSettings } from "../../../src/core/settings.ts";
import {
  SettingsScene,
  settingLabels,
} from "../../../src/ui/scenes/SettingsScene.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

describe("SettingsScene", () => {
  it("textos de cada configuração", () => {
    expect(settingLabels(defaultSettings())).toEqual({
      volume: "Volume dos efeitos: 50%",
      tooltip: "Atraso do tooltip: 300 ms",
      speed: "Velocidade da raid: x1",
      animations: "Animações: ligadas",
    });
  });

  it("cada botão troca o valor e avisa", () => {
    const settings = { ...defaultSettings(), tutorialStep: 5 };
    const onChange = vi.fn();
    const onBack = vi.fn();
    const scene = new SettingsScene(settings, { onChange, onBack });
    const { buttons } = scene;
    tap(buttons.volume);
    expect(settings.volume).toBe(0.75);
    expect(buttons.volume.text.text).toBe("Volume dos efeitos: 75%");
    tap(buttons.tooltip);
    expect(settings.tooltipDelayMs).toBe(600);
    tap(buttons.speed);
    expect(settings.raidSpeed).toBe(4);
    tap(buttons.animations);
    expect(buttons.animations.text.text).toBe("Animações: desligadas");
    expect(scene.tutorialButton.text.text).toBe("Rever o tutorial");
    tap(scene.tutorialButton);
    expect(settings.tutorialStep).toBe(0);
    expect(scene.messageText.text).toBe(
      "O tutorial aparece de novo no inventário",
    );
    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onChange).toHaveBeenLastCalledWith(settings);
    tap(scene.backButton);
    expect(onBack).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
  });
});
