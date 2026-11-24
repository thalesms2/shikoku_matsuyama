// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { SAVE_KEY } from "../src/core/save/storage.ts";
import type { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import { LoadoutScene } from "../src/ui/scenes/LoadoutScene.ts";
import { RaidSetupScene } from "../src/ui/scenes/RaidSetupScene.ts";
import type { TitleScene } from "../src/ui/scenes/TitleScene.ts";

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

describe("startGame: loadouts", () => {
  it("preparação → loadouts → salvar → volta salvando", async () => {
    const { scenes, storage, tapTitle } = await start();
    tapTitle();
    tap((scenes.current as InventoryScene).raidButton!);
    tap((scenes.current as RaidSetupScene).loadoutsButton!);
    const loadouts = scenes.current as LoadoutScene;
    expect(loadouts).toBeInstanceOf(LoadoutScene);
    expect(loadouts.options.shop.traders.length).toBeGreaterThan(0);
    tap(loadouts.saveButton);
    tap(loadouts.backButton);
    expect(scenes.current).toBeInstanceOf(RaidSetupScene);
    const saved = JSON.parse(storage.map.get(SAVE_KEY)!);
    expect(saved.loadouts.map((l: { name: string }) => l.name)).toEqual([
      "Loadout 1",
    ]);
    scenes.clear();
  });
});
