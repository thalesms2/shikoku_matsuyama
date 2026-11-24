// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { HIDEOUT_TICK_MS } from "../src/game.ts";
import { AutoRaidScene } from "../src/ui/scenes/AutoRaidScene.ts";
import type { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import { OfflineScene } from "../src/ui/scenes/OfflineScene.ts";
import { RaidScene } from "../src/ui/scenes/RaidScene.ts";
import { RaidSetupScene } from "../src/ui/scenes/RaidSetupScene.ts";
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

const DAY = 24 * 3_600_000;

describe("startGame: raids automáticas", () => {
  it("preparação → automático → começar; ver raid volta para o automático", async () => {
    ticks.length = 0;
    const { scenes, player, tapTitle, clock } = await start();
    tapTitle();
    tap((scenes.current as InventoryScene).raidButton!);
    tap((scenes.current as RaidSetupScene).autoButton!);
    const auto = scenes.current as AutoRaidScene;
    expect(auto).toBeInstanceOf(AutoRaidScene);
    player.auto.rules.minHealth = 0;
    player.auto.rules.stopOnDeath = false;
    tap(auto.runButton);
    expect(player.raid.active).not.toBeNull();
    tap(auto.viewButton);
    const raid = scenes.current as RaidScene;
    expect(raid).toBeInstanceOf(RaidScene);
    raid.skip();
    tap(raid.doneButton);
    expect(scenes.current).toBeInstanceOf(AutoRaidScene);

    // o ticker do jogo segue a sequência
    const done = player.auto.done;
    clock.advance(DAY);
    tick(HIDEOUT_TICK_MS);
    expect(player.auto.done).toBeGreaterThan(done);

    tap((scenes.current as AutoRaidScene).backButton);
    expect(scenes.current).toBeInstanceOf(RaidSetupScene);
    scenes.clear();
  });

  it("rodando: o título leva ao automático; raids com o jogo fechado entram no resumo", async () => {
    ticks.length = 0;
    const first = await start();
    first.player.auto.rules.minHealth = 0;
    first.player.auto.rules.maxRaids = 50;
    first.player.auto.rules.stopOnDeath = false;
    first.player.auto.running = true;
    first.player.auto.nextAt = 1000;
    first.save();
    first.scenes.clear();

    const second = await start(first.storage, new ManualClock(1000 + 60_000));
    expect(second.player.auto.done).toBeGreaterThan(0);
    second.tapTitle();
    const summary = second.scenes.current as OfflineScene;
    expect(summary).toBeInstanceOf(OfflineScene);
    expect(summary.body.text).toContain("Raids automáticas: ");
    tap(summary.continueButton);
    expect(second.player.auto.running).toBe(true);
    expect(second.scenes.current).toBeInstanceOf(AutoRaidScene);
    second.scenes.clear();
  });
});
