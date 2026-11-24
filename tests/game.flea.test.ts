// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { listItem, listingValue } from "../src/core/flea/flea.ts";
import { xpForLevel } from "../src/core/pmc/pmc.ts";
import { SAVE_KEY } from "../src/core/save/storage.ts";
import { FLEA } from "../src/data/flea.ts";
import { HIDEOUT_TICK_MS } from "../src/game.ts";
import { FleaScene } from "../src/ui/scenes/FleaScene.ts";
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

describe("startGame: mercado", () => {
  it("inventário → mercado → volta salvando; o ticker calcula as vendas", async () => {
    ticks.length = 0;
    const { scenes, player, storage, tapTitle, clock } = await start();
    tapTitle();
    tap((scenes.current as InventoryScene).fleaButton!);
    const flea = scenes.current as FleaScene;
    expect(flea).toBeInstanceOf(FleaScene);
    expect(flea.options.config).toBe(FLEA);
    tap(flea.backButton);
    expect(JSON.parse(storage.map.get(SAVE_KEY)!).flea).toBeDefined();

    clock.advance(5 * 60_000);
    tick(HIDEOUT_TICK_MS - 1);
    expect(player.flea.lastCheck).toBe(1000);
    tick(1);
    expect(player.flea.lastCheck).toBe(clock.now());
    scenes.clear();
  });

  it("anúncio que vence com o jogo fechado volta como resultado ao abrir", async () => {
    ticks.length = 0;
    const first = await start();
    const { player } = first;
    player.pmc.xp = xpForLevel(FLEA.minPmcLevel);
    const item = player.inventory.stash
      .items()
      .find((i) => i.def.category === "food")!;
    // preço no máximo (2× o valor): nunca vende
    const value = listingValue(player, FLEA, item, 1000);
    const price = (value.ok ? value.amount : 0) * FLEA.maxRatio;
    expect(listItem(player, FLEA, item, price, 1000)).toMatchObject({
      ok: true,
    });
    first.save();
    first.scenes.clear();
    const second = await start(
      first.storage,
      new ManualClock(1000 + FLEA.listingMs + 1),
    );
    expect(second.player.flea.listings).toEqual([]);
    expect(second.player.flea.results[0].kind).toBe("expired");
    second.scenes.clear();
  });
});
