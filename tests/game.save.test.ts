// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { SAVE_KEY } from "../src/core/save/storage.ts";
import { CharacterScene } from "../src/ui/scenes/CharacterScene.ts";
import { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import type { TitleScene } from "../src/ui/scenes/TitleScene.ts";

const { tickers } = vi.hoisted(() => ({
  tickers: [] as ((t: { deltaMS: number }) => void)[],
}));

// A Application real precisa de WebGL/WebGPU, que o jsdom não tem
vi.mock("@pixi/sound", () => ({}));
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof Pixi>();

  class FakeApplication {
    stage = new pixi.Container();
    screen = { width: 800, height: 600 };
    canvas = document.createElement("canvas");
    renderer = { on: () => {} };
    ticker = {
      add: (fn: (t: { deltaMS: number }) => void) => tickers.push(fn),
    };
    async init() {}
  }

  return {
    ...pixi,
    Application: FakeApplication,
    Assets: { load: async () => {} },
  };
});

/** Storage em memória no formato do localStorage */
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
  tickers.length = 0;
  const { startGame } = await import("../src/game.ts");
  const result = await startGame(document.body, { clock, storage });
  return { ...result, storage, clock };
}

describe("startGame: save", () => {
  it("salva sozinho a cada 5 segundos", async () => {
    const { storage } = await start();
    expect(storage.map.has(SAVE_KEY)).toBe(false);
    for (const tick of tickers) tick({ deltaMS: 5000 });
    expect(JSON.parse(storage.map.get(SAVE_KEY)!).version).toBe(1);
  });

  it("salva ao fechar a página", async () => {
    const { storage } = await start();
    window.dispatchEvent(new Event("beforeunload"));
    expect(storage.map.has(SAVE_KEY)).toBe(true);
  });

  it("carrega o save na próxima vez", async () => {
    const first = await start();
    first.player.pmc.name = "Continuado";
    first.save();
    const second = await start(first.storage);
    expect(second.player.pmc.name).toBe("Continuado");
  });

  it("save quebrado vai para o backup, com aviso", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, "{x");
    const { player } = await start(storage);
    expect(player.pmc.name).toBe("PMC");
    expect(storage.map.get(`${SAVE_KEY}:backup`)).toBe("{x");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Save não carregado"),
    );
  });

  it("avisos do save aparecem no console", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = await start();
    first.save();
    const data = JSON.parse(first.storage.map.get(SAVE_KEY)!);
    data.stash.items[0].def = "item_que_sumiu";
    first.storage.setItem(SAVE_KEY, JSON.stringify(data));
    await start(first.storage);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Save: Item removido"),
    );
  });

  it("navega entre título, inventário e personagem", async () => {
    const { scenes, player } = await start();
    (scenes.current as TitleScene).view.emit("pointertap", {} as never);
    const inventory = scenes.current as InventoryScene;
    expect(inventory).toBeInstanceOf(InventoryScene);
    expect(inventory.player).toBe(player);
    inventory.characterButton!.emit("pointertap", {} as never);
    const character = scenes.current as CharacterScene;
    expect(character).toBeInstanceOf(CharacterScene);
    character.backButton.emit("pointertap", {} as never);
    expect(scenes.current).toBeInstanceOf(InventoryScene);
    scenes.clear();
  });

  it("usa o relógio do sistema e o localStorage por padrão", async () => {
    tickers.length = 0;
    const { startGame } = await import("../src/game.ts");
    const { player } = await startGame(document.body);
    expect(player.loader).toBeDefined();
  });
});
