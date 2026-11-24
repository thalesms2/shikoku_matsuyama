// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { SAVE_KEY } from "../src/core/save/storage.ts";
import { HIDEOUT_TICK_MS } from "../src/game.ts";
import { HideoutScene } from "../src/ui/scenes/HideoutScene.ts";
import type { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import type { TitleScene } from "../src/ui/scenes/TitleScene.ts";

// A Application real precisa de WebGL/WebGPU, que o jsdom não tem
vi.mock("@pixi/sound", () => ({}));
const ticks = vi.hoisted(() => [] as ((t: { deltaMS: number }) => void)[]);

vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof Pixi>();

  class FakeApplication {
    stage = new pixi.Container();
    screen = { width: 800, height: 600 };
    canvas = document.createElement("canvas");
    renderer = { on: () => {} };
    // guarda os callbacks para o teste avançar o tempo
    ticker = { add: (fn: (t: { deltaMS: number }) => void) => ticks.push(fn) };
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

async function start(storage = fakeStorage(), clock = new ManualClock(1000)) {
  const { startGame } = await import("../src/game.ts");
  const result = await startGame(document.body, {
    clock,
    storage,
  });
  const tapTitle = () =>
    (result.scenes.current as TitleScene).view.emit("pointertap", {} as never);
  return { ...result, storage, tapTitle, clock };
}

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

const tick = (ms: number) => {
  for (const fn of ticks) fn({ deltaMS: ms });
};

describe("startGame: esconderijo", () => {
  it("inventário → esconderijo → obra → volta salvando", async () => {
    ticks.length = 0;
    const { scenes, player, storage, tapTitle, clock } = await start();
    tapTitle();
    tap((scenes.current as InventoryScene).hideoutButton!);
    const hideout = scenes.current as HideoutScene;
    expect(hideout).toBeInstanceOf(HideoutScene);
    hideout.select(hideout.options.data.modules.find((m) => m.id === "stash")!);
    tap(hideout.upgradeButton);
    expect(player.hideout.construction?.module).toBe("stash");
    tap(hideout.backButton);
    const saved = JSON.parse(storage.map.get(SAVE_KEY)!);
    expect(saved.hideout.construction.module).toBe("stash");

    // o ticker do jogo conclui a obra quando passa da hora
    const height = player.inventory.stash.height;
    clock.advance(30 * 60 * 1000);
    tick(HIDEOUT_TICK_MS - 1);
    expect(player.hideout.construction).not.toBeNull();
    tick(1);
    expect(player.hideout.construction).toBeNull();
    expect(player.inventory.stash.height).toBe(height + 3);
    scenes.clear();
  });

  it("o tempo com o jogo fechado conta ao abrir", async () => {
    ticks.length = 0;
    const first = await start();
    first.player.hideout.modules.medstation = 1;
    first.player.pmc.health.thorax = 10;
    first.save();
    first.scenes.clear();
    const second = await start(
      first.storage,
      new ManualClock(1000 + 20 * 60_000),
    );
    expect(second.player.pmc.health.thorax).toBe(30);
    second.scenes.clear();
  });
});
