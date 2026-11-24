// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  InventoryScene,
  STASH_X,
} from "../../../src/ui/scenes/InventoryScene.ts";

describe("InventoryScene: botão Vendedores", () => {
  it("fica à esquerda do título do estoque e abre os vendedores", () => {
    const player = createNewPlayer(new ManualClock());
    const onOpenTraders = vi.fn();
    const scene = new InventoryScene(player.inventory, {
      player,
      onOpenTraders,
    });
    const button = scene.tradersButton!;
    expect(button.text.text).toBe("Vendedores");
    expect(button.x + button.buttonWidth).toBeLessThan(STASH_X);
    button.emit("pointertap", {} as never);
    expect(onOpenTraders).toHaveBeenCalledOnce();
    expect(new InventoryScene(player.inventory).tradersButton).toBeNull();
    scene.destroy();
  });
});
