// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  InventoryScene,
  STASH_X,
} from "../../../src/ui/scenes/InventoryScene.ts";

describe("InventoryScene: botão Quests", () => {
  it("à esquerda de Vendedores e abre as quests", () => {
    const player = createNewPlayer(new ManualClock());
    const onOpenQuests = vi.fn();
    const scene = new InventoryScene(player.inventory, {
      player,
      onOpenTraders: () => {},
      onOpenQuests,
    });
    const button = scene.questsButton!;
    expect(button.text.text).toBe("Quests");
    expect(button.x + button.buttonWidth).toBeLessThan(scene.tradersButton!.x);
    button.emit("pointertap", {} as never);
    expect(onOpenQuests).toHaveBeenCalledOnce();
    scene.destroy();
  });

  it("sem Vendedores, à esquerda do estoque; sem callback, não existe", () => {
    const player = createNewPlayer(new ManualClock());
    const scene = new InventoryScene(player.inventory, {
      onOpenQuests: () => {},
    });
    const button = scene.questsButton!;
    expect(button.x + button.buttonWidth).toBeLessThan(STASH_X);
    expect(new InventoryScene(player.inventory).questsButton).toBeNull();
  });
});
