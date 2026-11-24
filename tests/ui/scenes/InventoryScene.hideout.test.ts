// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  InventoryScene,
  STASH_X,
} from "../../../src/ui/scenes/InventoryScene.ts";

describe("InventoryScene: botão Esconderijo", () => {
  it("à esquerda de Quests e abre o esconderijo", () => {
    const player = createNewPlayer(new ManualClock());
    const onOpenHideout = vi.fn();
    const scene = new InventoryScene(player.inventory, {
      player,
      onOpenTraders: () => {},
      onOpenQuests: () => {},
      onOpenHideout,
    });
    const button = scene.hideoutButton!;
    expect(button.text.text).toBe("Esconderijo");
    expect(button.x + button.buttonWidth).toBeLessThan(scene.questsButton!.x);
    expect(button.x).toBeGreaterThan(150);
    button.emit("pointertap", {} as never);
    expect(onOpenHideout).toHaveBeenCalledOnce();
    scene.destroy();
  });

  it("sem Quests, à esquerda de Vendedores; sem os dois, do estoque", () => {
    const player = createNewPlayer(new ManualClock());
    const withTraders = new InventoryScene(player.inventory, {
      onOpenTraders: () => {},
      onOpenHideout: () => {},
    });
    expect(
      withTraders.hideoutButton!.x + withTraders.hideoutButton!.buttonWidth,
    ).toBeLessThan(withTraders.tradersButton!.x);
    const alone = new InventoryScene(player.inventory, {
      onOpenHideout: () => {},
    });
    expect(
      alone.hideoutButton!.x + alone.hideoutButton!.buttonWidth,
    ).toBeLessThan(STASH_X);
    expect(new InventoryScene(player.inventory).hideoutButton).toBeNull();
  });
});
