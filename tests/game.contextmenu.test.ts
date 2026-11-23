// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

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

describe("startGame: botão direito", () => {
  it("bloqueia o menu do navegador no canvas", async () => {
    const { startGame } = await import("../src/game.ts");
    const { app } = await startGame(document.body);
    const event = new MouseEvent("contextmenu", { cancelable: true });
    app.canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
