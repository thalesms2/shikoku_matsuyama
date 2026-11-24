// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { SAVE_KEY } from "../src/core/save/storage.ts";
import { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import type { TitleScene } from "../src/ui/scenes/TitleScene.ts";
import { TradersScene } from "../src/ui/scenes/TradersScene.ts";

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

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage & { map: Map<string, string> };
}

async function start(storage = fakeStorage()) {
  const { startGame } = await import("../src/game.ts");
  const result = await startGame(document.body, {
    clock: new ManualClock(1000),
    storage,
  });
  const tapTitle = () =>
    (result.scenes.current as TitleScene).view.emit("pointertap", {} as never);
  return { ...result, storage, tapTitle };
}

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

describe("startGame: vendedores", () => {
  it("inventário → vendedores → compra → volta salvando", async () => {
    const { scenes, player, storage, tapTitle } = await start();
    tapTitle();
    tap((scenes.current as InventoryScene).tradersButton!);
    const traders = scenes.current as TradersScene;
    expect(traders).toBeInstanceOf(TradersScene);
    tap(traders.rowButtons[0]);
    expect(traders.messageText.text).toContain("Comprou");
    tap(traders.backButton);
    expect(scenes.current).toBeInstanceOf(InventoryScene);
    const saved = JSON.parse(storage.map.get(SAVE_KEY)!);
    expect(saved.traders.colonel.bought).toEqual({ pistol: 1 });
    expect(player.traders.colonel.volume).toBeGreaterThan(0);
    scenes.clear();
  });
});
