// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { SAVE_KEY } from "../src/core/save/storage.ts";
import { MAPS } from "../src/data/maps.ts";
import { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import { RaidScene } from "../src/ui/scenes/RaidScene.ts";
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

const savedRaid = (storage: { map: Map<string, string> }) =>
  JSON.parse(storage.map.get(SAVE_KEY)!).raid;

describe("startGame: raid", () => {
  it("inventário → preparação → raid → resumo → inventário", async () => {
    const { scenes, player, storage, tapTitle } = await start();
    tapTitle();
    const inventory = scenes.current as InventoryScene;
    tap(inventory.raidButton!);
    const setup = scenes.current as RaidSetupScene;
    expect(setup).toBeInstanceOf(RaidSetupScene);
    tap(setup.backButton);
    expect(scenes.current).toBeInstanceOf(InventoryScene);
    tap((scenes.current as InventoryScene).raidButton!);
    tap((scenes.current as RaidSetupScene).startButton);
    const raid = scenes.current as RaidScene;
    expect(raid).toBeInstanceOf(RaidScene);
    // salvo na hora, com o resultado já aplicado
    expect(savedRaid(storage).active).not.toBeNull();
    raid.skip();
    tap(raid.doneButton);
    expect(scenes.current).toBeInstanceOf(InventoryScene);
    expect(player.raid.active).toBeNull();
    expect(savedRaid(storage).active).toBeNull();
    expect(savedRaid(storage).stats.raids).toBe(1);
    scenes.clear();
  });

  it("raid em andamento no save: o título leva de volta a ela", async () => {
    const first = await start();
    first.tapTitle();
    tap((first.scenes.current as InventoryScene).raidButton!);
    tap((first.scenes.current as RaidSetupScene).startButton);
    first.scenes.clear();

    const second = await start(first.storage);
    second.tapTitle();
    expect(second.scenes.current).toBeInstanceOf(RaidScene);
    second.scenes.clear();
  });

  it("mapa que saiu do jogo cai no primeiro mapa", async () => {
    const first = await start();
    first.tapTitle();
    tap((first.scenes.current as InventoryScene).raidButton!);
    tap((first.scenes.current as RaidSetupScene).startButton);
    const data = JSON.parse(first.storage.map.get(SAVE_KEY)!);
    data.raid.active.summary.map = "mapa_que_sumiu";
    first.storage.setItem(SAVE_KEY, JSON.stringify(data));
    first.scenes.clear();

    const second = await start(first.storage);
    second.tapTitle();
    const scene = second.scenes.current as RaidScene;
    expect(scene.options.map).toBe(MAPS[0]);
    second.scenes.clear();
  });
});
