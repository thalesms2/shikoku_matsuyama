// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import type { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
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

describe("startGame: vender arrastando", () => {
  it("soltar um item do estoque sobre Vendedores abre a venda com ele", async () => {
    const { scenes, player, tapTitle } = await start();
    tapTitle();
    const inventory = scenes.current as InventoryScene;
    const rifle = player.inventory.stash
      .items()
      .find((i) => i.def.id === "rifle_vk74")!;
    const view = inventory.stashView.itemViews.get(rifle)!;
    inventory.drag.begin(view, view.toGlobal({ x: 5, y: 5 }));
    inventory.drag.end(inventory.tradersButton!.toGlobal({ x: 5, y: 5 }));
    const traders = scenes.current as TradersScene;
    expect(traders).toBeInstanceOf(TradersScene);
    expect(traders.tab).toBe("sell");
    expect(traders.focus).toBe(rifle);
    expect(traders.trader.id).toBe("colonel");
    scenes.clear();
  });
});
