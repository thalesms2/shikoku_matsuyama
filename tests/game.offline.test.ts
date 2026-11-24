// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import { OfflineScene } from "../src/ui/scenes/OfflineScene.ts";
import { RaidScene } from "../src/ui/scenes/RaidScene.ts";
import type { RaidSetupScene } from "../src/ui/scenes/RaidSetupScene.ts";
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

async function start(storage = fakeStorage(), now = 1000) {
  const { startGame } = await import("../src/game.ts");
  const result = await startGame(document.body, {
    clock: new ManualClock(now),
    storage,
  });
  const tapTitle = () =>
    (result.scenes.current as TitleScene).view.emit("pointertap", {} as never);
  return { ...result, storage, tapTitle };
}

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

const HOUR = 3_600_000;

describe("startGame: resumo do tempo fora", () => {
  it("jogo novo vai direto ao inventário", async () => {
    const { scenes, tapTitle } = await start();
    tapTitle();
    expect(scenes.current).toBeInstanceOf(InventoryScene);
    scenes.clear();
  });

  it("depois de um tempo fora, mostra o resumo uma vez e segue", async () => {
    const first = await start();
    first.player.pmc.health.thorax = 10;
    first.player.hideout.modules.medstation = 1;
    first.save();
    first.scenes.clear();
    const second = await start(first.storage, 1000 + HOUR);
    second.tapTitle();
    const summary = second.scenes.current as OfflineScene;
    expect(summary).toBeInstanceOf(OfflineScene);
    expect(summary.body.text).toContain("PMC recuperou +60 PV");
    tap(summary.continueButton);
    expect(second.scenes.current).toBeInstanceOf(InventoryScene);
    second.scenes.clear();
  });

  it("com uma raid em andamento, o resumo vem antes da raid", async () => {
    const first = await start();
    first.tapTitle();
    tap((first.scenes.current as InventoryScene).raidButton!);
    tap((first.scenes.current as RaidSetupScene).scavButton);
    first.save();
    first.scenes.clear();
    const second = await start(first.storage, 1000 + HOUR);
    second.tapTitle();
    const summary = second.scenes.current as OfflineScene;
    expect(summary.body.text).toContain("raid Scav está liberada");
    tap(summary.continueButton);
    expect(second.scenes.current).toBeInstanceOf(RaidScene);
    second.scenes.clear();
  });
});
