// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import { TitleScene } from "../src/ui/scenes/TitleScene.ts";

// A Application real precisa de WebGL/WebGPU, que o jsdom não tem
vi.mock("@pixi/sound", () => ({}));
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof Pixi>();

  class FakeApplication {
    stage = new pixi.Container();
    screen = { width: 800, height: 600 };
    canvas = document.createElement("canvas");
    renderer = { on: () => {} };
    ticker = { add: () => {} };
    async init() {}
  }

  return {
    ...pixi,
    Application: FakeApplication,
    Assets: { load: async () => {} },
  };
});

describe("startGame: fluxo inicial", () => {
  it("clicar na tela inicial abre o inventário com o kit inicial", async () => {
    const { startGame } = await import("../src/game.ts");
    const { scenes } = await startGame(document.body);
    const title = scenes.current as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    title.view.emit("pointertap", {} as never);
    const inventory = scenes.current as InventoryScene;
    expect(inventory).toBeInstanceOf(InventoryScene);
    expect(inventory.state.equipment.get("backpack")).not.toBeNull();
    expect(inventory.state.stash.items().length).toBeGreaterThan(0);
    scenes.clear();
  });
});
