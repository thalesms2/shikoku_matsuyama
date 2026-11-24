// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { TitleScene } from "../../../src/ui/scenes/TitleScene.ts";

describe("TitleScene: botão Configurações", () => {
  it("abre as configurações sem começar o jogo", () => {
    const onStart = vi.fn();
    const onSettings = vi.fn();
    const scene = new TitleScene(onStart, onSettings);
    const button = scene.settingsButton!;
    expect(button.text.text).toBe("Configurações");
    const stopPropagation = vi.fn();
    button.emit("pointertap", { stopPropagation } as never);
    expect(onSettings).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    button.emit("pointertap", undefined as never);
    expect(onStart).not.toHaveBeenCalled();
    scene.resize(1000, 800);
    expect(button.position.x).toBe(420);
    expect(button.position.y).toBe(736);
  });

  it("sem o retorno, sem botão", () => {
    expect(new TitleScene(() => {}).settingsButton).toBeNull();
  });
});
