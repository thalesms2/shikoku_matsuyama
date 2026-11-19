// @vitest-environment jsdom
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { SceneManager } from "../../src/ui/SceneManager.ts";
import type { Scene } from "../../src/ui/SceneManager.ts";

function fullScene() {
  return {
    view: new Container(),
    resize: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
  } satisfies Scene;
}

describe("SceneManager", () => {
  it("começa sem cena", () => {
    const manager = new SceneManager(new Container(), 800, 600);
    expect(manager.current).toBeNull();
    // Sem cena ativa, nada disso falha
    manager.resize(10, 10);
    manager.update(16);
    manager.clear();
  });

  it("adiciona a cena ao stage e chama resize com o tamanho atual", () => {
    const stage = new Container();
    const manager = new SceneManager(stage, 800, 600);
    const scene = fullScene();
    manager.change(scene);
    expect(manager.current).toBe(scene);
    expect(stage.children).toContain(scene.view);
    expect(scene.resize).toHaveBeenCalledWith(800, 600);
  });

  it("repassa resize e update para a cena ativa", () => {
    const manager = new SceneManager(new Container(), 800, 600);
    const scene = fullScene();
    manager.change(scene);
    manager.resize(1024, 768);
    manager.update(16);
    expect(scene.resize).toHaveBeenLastCalledWith(1024, 768);
    expect(scene.update).toHaveBeenCalledWith(16);
  });

  it("usa o último tamanho ao trocar de cena", () => {
    const manager = new SceneManager(new Container(), 800, 600);
    manager.resize(320, 480);
    const scene = fullScene();
    manager.change(scene);
    expect(scene.resize).toHaveBeenCalledWith(320, 480);
  });

  it("destrói a cena anterior ao trocar", () => {
    const stage = new Container();
    const manager = new SceneManager(stage, 800, 600);
    const first = fullScene();
    const second = fullScene();
    manager.change(first);
    manager.change(second);
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(first.view.destroyed).toBe(true);
    expect(stage.children).toEqual([second.view]);
  });

  it("aceita cenas sem os métodos opcionais", () => {
    const stage = new Container();
    const manager = new SceneManager(stage, 800, 600);
    const scene: Scene = { view: new Container() };
    manager.change(scene);
    manager.resize(1, 1);
    manager.update(1);
    manager.clear();
    expect(manager.current).toBeNull();
    expect(stage.children).toHaveLength(0);
    expect(scene.view.destroyed).toBe(true);
  });
});
