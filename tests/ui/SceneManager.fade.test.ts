// @vitest-environment jsdom
import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";

import { SceneManager } from "../../src/ui/SceneManager.ts";

describe("SceneManager: fade", () => {
  it("com fadeMs, a cena entra do transparente ao opaco", () => {
    const manager = new SceneManager(new Container(), 800, 600);
    manager.fadeMs = 200;
    const scene = { view: new Container() };
    manager.change(scene);
    expect(scene.view.alpha).toBe(0);
    manager.update(50);
    expect(scene.view.alpha).toBeCloseTo(0.25);
    manager.update(500);
    expect(scene.view.alpha).toBe(1);
    manager.update(16);
    expect(scene.view.alpha).toBe(1);
  });

  it("sem fadeMs, entra opaca", () => {
    const manager = new SceneManager(new Container(), 800, 600);
    const scene = { view: new Container() };
    manager.change(scene);
    expect(scene.view.alpha).toBe(1);
  });
});
