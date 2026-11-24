// @vitest-environment jsdom
import type * as Pixi from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../src/core/clock.ts";
import { SAVE_KEY } from "../src/core/save/storage.ts";
import { EndingScene } from "../src/ui/scenes/EndingScene.ts";
import { InventoryScene } from "../src/ui/scenes/InventoryScene.ts";
import { QuestsScene } from "../src/ui/scenes/QuestsScene.ts";
import type { RaidScene } from "../src/ui/scenes/RaidScene.ts";
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

describe("startGame: quests", () => {
  it("aceitar, avançar com a raid do PMC (não com a Scav) e voltar salvando", async () => {
    const { scenes, player, storage, tapTitle } = await start();
    tapTitle();
    tap((scenes.current as InventoryScene).questsButton!);
    const quests = scenes.current as QuestsScene;
    expect(quests).toBeInstanceOf(QuestsScene);
    quests.select(quests.options.ctx.quests.find((q) => q.id === "recon")!);
    tap(quests.actionButton);
    tap(quests.backButton);
    const saved = JSON.parse(storage.map.get(SAVE_KEY)!);
    expect(saved.quests.recon.status).toBe("active");

    // raid Scav: não conta
    tap((scenes.current as InventoryScene).raidButton!);
    tap((scenes.current as RaidSetupScene).scavButton);
    expect(player.quests.recon.progress).toEqual([0]);
    const scavRaid = scenes.current as RaidScene;
    scavRaid.skip();
    tap(scavRaid.doneButton);

    // raid do PMC na Periferia: conta, e o progresso já vai salvo
    tap((scenes.current as InventoryScene).raidButton!);
    tap((scenes.current as RaidSetupScene).startButton);
    const { summary } = player.raid.active!;
    expect(summary.map).toBe("outskirts");
    const expected = summary.outcome === "extracted" ? 1 : 0;
    expect(player.quests.recon.progress).toEqual([expected]);
    const after = JSON.parse(storage.map.get(SAVE_KEY)!);
    expect(after.quests.recon.progress).toEqual([expected]);
    scenes.clear();
  });

  it("concluir a quest final leva ao final; continuar volta ao inventário", async () => {
    const { scenes, player, tapTitle } = await start();
    tapTitle();
    player.quests["last-crossing"] = { status: "active", progress: [1] };
    tap((scenes.current as InventoryScene).questsButton!);
    const quests = scenes.current as QuestsScene;
    quests.select(
      quests.options.ctx.quests.find((q) => q.id === "last-crossing")!,
    );
    tap(quests.actionButton);
    const ending = scenes.current as EndingScene;
    expect(ending).toBeInstanceOf(EndingScene);
    tap(ending.continueButton);
    expect(scenes.current).toBeInstanceOf(InventoryScene);
    scenes.clear();
  });
});
