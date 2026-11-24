// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { SETTINGS_KEY } from "../src/core/settings.ts";
import { TUTORIAL } from "../src/data/tutorial.ts";
import type { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import type { RaidScene } from "../src/ui/scenes/RaidScene.ts";
import type { RaidSetupScene } from "../src/ui/scenes/RaidSetupScene.ts";
import { SettingsScene } from "../src/ui/scenes/SettingsScene.ts";
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

const settingsIn = (storage: ReturnType<typeof fakeStorage>) =>
  JSON.parse(storage.map.get(SETTINGS_KEY)!);

describe("startGame: configurações, tutorial e animações", () => {
  it("título → configurações → muda e guarda → volta ao título", async () => {
    const { scenes, storage } = await start();
    const title = scenes.current as TitleScene;
    tap(title.settingsButton!);
    const settings = scenes.current as SettingsScene;
    expect(settings).toBeInstanceOf(SettingsScene);
    tap(settings.buttons.volume);
    expect(settingsIn(storage).volume).toBe(0.75);
    tap(settings.backButton);
    expect(scenes.current).toBeInstanceOf(TitleScene);
    scenes.clear();
  });

  it("jogo novo mostra o tutorial; o passo fica guardado; concluído some", async () => {
    const { scenes, storage, tapTitle } = await start();
    tapTitle();
    const inventory = scenes.current as InventoryScene;
    expect(inventory.tutorial!.step).toBe(0);
    tap(inventory.tutorial!.nextButton);
    expect(settingsIn(storage).tutorialStep).toBe(1);
    scenes.clear();

    storage.map.set(
      SETTINGS_KEY,
      JSON.stringify({ tutorialStep: TUTORIAL.length }),
    );
    const again = await start(storage);
    again.tapTitle();
    expect((again.scenes.current as InventoryScene).tutorial).toBeNull();
    again.scenes.clear();
  });

  it("fade entre telas, desligável; velocidade da raid das configurações", async () => {
    const { scenes } = await start();
    expect(scenes.current!.view.alpha).toBe(0);
    scenes.update(1000);
    expect(scenes.current!.view.alpha).toBe(1);
    scenes.clear();

    const storage = fakeStorage();
    storage.map.set(
      SETTINGS_KEY,
      JSON.stringify({ animations: false, raidSpeed: 16 }),
    );
    const quiet = await start(storage);
    expect(quiet.scenes.current!.view.alpha).toBe(1);
    quiet.tapTitle();
    tap((quiet.scenes.current as InventoryScene).raidButton!);
    tap((quiet.scenes.current as RaidSetupScene).startButton);
    expect((quiet.scenes.current as RaidScene).speed).toBe(16);
    quiet.scenes.clear();
  });
});
