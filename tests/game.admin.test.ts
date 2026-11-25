// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { HIDEOUT_TICK_MS } from "../src/game.ts";

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
    admin: true,
  });
  return { ...result, storage, clock };
}

const tick = (ms: number) => {
  for (const fn of ticks) fn({ deltaMS: ms });
};

describe("startGame: janela de admin", () => {
  it("existe com a opção, fecha quando uma raid começa e não reabre durante ela", async () => {
    ticks.length = 0;
    const { admin, player, scenes } = await start();
    expect(admin).not.toBeNull();
    expect(admin!.open()).toBe(true);
    player.raid.active = {
      startedAt: 0,
      events: [],
      summary: {} as never,
    };
    tick(HIDEOUT_TICK_MS);
    expect(admin!.isOpen).toBe(false);
    expect(admin!.open()).toBe(false);
    admin!.destroy();
    scenes.clear();
  });

  it("sem a opção nem desenvolvimento, não existe", async () => {
    const { startGame } = await import("../src/game.ts");
    const result = await startGame(document.body, {
      storage: fakeStorage(),
      admin: false,
    });
    expect(result.admin).toBeNull();
    result.scenes.clear();
  });
});
