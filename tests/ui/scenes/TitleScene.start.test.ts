// @vitest-environment jsdom
import { Rectangle } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { TitleScene } from "../../../src/ui/scenes/TitleScene.ts";

describe("TitleScene com onStart", () => {
  it("convida a clicar e chama onStart ao clicar", () => {
    const onStart = vi.fn();
    const scene = new TitleScene(onStart);
    expect(scene.subtitle.text).toBe("Clique para começar");
    expect(scene.view.eventMode).toBe("static");
    scene.view.emit("pointertap", {} as never);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("sem onStart não é clicável", () => {
    const scene = new TitleScene();
    expect(scene.subtitle.text).toBe("Em desenvolvimento");
    expect(scene.view.eventMode).not.toBe("static");
  });

  it("a área de clique cobre a tela toda", () => {
    const scene = new TitleScene(() => {});
    scene.resize(640, 480);
    expect(scene.view.hitArea).toEqual(new Rectangle(0, 0, 640, 480));
  });
});
