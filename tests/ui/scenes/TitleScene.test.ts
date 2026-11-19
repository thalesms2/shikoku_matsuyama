// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { TitleScene } from "../../../src/ui/scenes/TitleScene.ts";
import { theme } from "../../../src/ui/theme.ts";

describe("TitleScene", () => {
  it("mostra o nome do jogo e o subtítulo", () => {
    const scene = new TitleScene();
    expect(scene.title.text).toBe("ESCAPE FROM IDLE");
    expect(scene.title.style.fill).toBe(theme.accent);
    expect(scene.view.children).toEqual([scene.title, scene.subtitle]);
  });

  it("centraliza os textos em telas largas sem escalar", () => {
    const scene = new TitleScene();
    scene.resize(1200, 800);
    expect(scene.title.scale.x).toBe(1);
    expect(scene.title.position.x).toBe(600);
    expect(scene.title.position.y).toBe(370);
    expect(scene.subtitle.position.y).toBe(440);
  });

  it("reduz a escala em telas estreitas", () => {
    const scene = new TitleScene();
    scene.resize(400, 800);
    expect(scene.title.scale.x).toBe(0.5);
    expect(scene.subtitle.scale.x).toBe(0.5);
    expect(scene.title.position.x).toBe(200);
    expect(scene.title.position.y).toBe(385);
    expect(scene.subtitle.position.y).toBe(420);
  });

  it("faz o subtítulo pulsar entre 0.2 e 1 de alpha", () => {
    const scene = new TitleScene();
    scene.update(0);
    expect(scene.subtitle.alpha).toBeCloseTo(0.6);
    scene.update(500 * (Math.PI / 2));
    expect(scene.subtitle.alpha).toBeCloseTo(1);
    scene.update(500 * Math.PI);
    expect(scene.subtitle.alpha).toBeCloseTo(0.2);
  });
});
