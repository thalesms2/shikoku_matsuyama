// @vitest-environment jsdom
import { Application } from "pixi.js";
import type { Container } from "pixi.js";
import type * as Pixi from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assets } from "../src/assets.ts";
import {
  gameReady,
  initPlatform,
  setLoadingProgress,
} from "../src/platform.ts";
import { TitleScene } from "../src/ui/scenes/TitleScene.ts";
import { theme } from "../src/ui/theme.ts";

// A Application real precisa de WebGL/WebGPU, que o jsdom não tem
type FakeApp = {
  stage: Container;
  canvas: HTMLCanvasElement;
  init: ReturnType<typeof vi.fn>;
  resizeListeners: ((w: number, h: number) => void)[];
  tickers: ((t: { deltaMS: number }) => void)[];
};

const { created, load } = vi.hoisted(() => ({
  created: [] as FakeApp[],
  load: vi.fn(async () => {}),
}));

vi.mock("@pixi/sound", () => ({}));
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof Pixi>();

  class FakeApplication {
    stage = new pixi.Container();
    screen = { width: 800, height: 600 };
    canvas = document.createElement("canvas");
    init = vi.fn(async () => {});
    resizeListeners: ((w: number, h: number) => void)[] = [];
    tickers: ((t: { deltaMS: number }) => void)[] = [];
    renderer = {
      on: (_event: string, fn: (w: number, h: number) => void) => {
        this.resizeListeners.push(fn);
      },
    };
    ticker = {
      add: (fn: (t: { deltaMS: number }) => void) => {
        this.tickers.push(fn);
      },
    };
    constructor() {
      created.push(this);
    }
  }

  return { ...pixi, Application: FakeApplication, Assets: { load } };
});

describe("startGame", () => {
  beforeEach(() => {
    created.length = 0;
    document.body.innerHTML = '<div id="pixi-container"></div>';
  });

  it("inicia o PixiJS, carrega os assets e mostra a tela inicial", async () => {
    const { startGame } = await import("../src/game.ts");
    const container = document.getElementById("pixi-container")!;
    const { app, scenes } = await startGame(container);
    const fake = app as unknown as FakeApp;

    expect(fake.init).toHaveBeenCalledWith(
      expect.objectContaining({
        background: theme.background,
        resizeTo: window,
      }),
    );
    expect(container.contains(fake.canvas)).toBe(true);
    expect(load).toHaveBeenCalledWith(assets, setLoadingProgress);
    expect(scenes.current).toBeInstanceOf(TitleScene);
    expect(fake.stage.children).toContain(scenes.current!.view);
  });

  it("repassa resize e ticker para a cena atual", async () => {
    const { startGame } = await import("../src/game.ts");
    const { app, scenes } = await startGame(document.body);
    const fake = app as unknown as FakeApp;
    const resize = vi.spyOn(scenes, "resize");
    const update = vi.spyOn(scenes, "update");

    fake.resizeListeners.forEach((fn) => fn(1024, 768));
    fake.tickers.forEach((fn) => fn({ deltaMS: 16 }));

    expect(resize).toHaveBeenCalledWith(1024, 768);
    expect(update).toHaveBeenCalledWith(16);
  });

  it("main.ts inicia o jogo no #pixi-container", async () => {
    await import("../src/main.ts");
    const container = document.getElementById("pixi-container")!;
    expect(created).toHaveLength(1);
    expect(container.contains(created[0].canvas)).toBe(true);
  });
});

describe("platform (web)", () => {
  it("os hooks da web não fazem nada", async () => {
    await expect(initPlatform()).resolves.toBeUndefined();
    expect(setLoadingProgress(0.5)).toBeUndefined();
    expect(gameReady(new Application())).toBeUndefined();
  });
});
