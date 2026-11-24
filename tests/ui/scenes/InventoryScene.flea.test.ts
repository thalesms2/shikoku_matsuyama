// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  InventoryScene,
  STASH_X,
} from "../../../src/ui/scenes/InventoryScene.ts";

const noop = () => {};
const rightEdge = (b: { x: number; buttonWidth: number }) =>
  b.x + b.buttonWidth;

describe("InventoryScene: botão Mercado", () => {
  it("à esquerda do Esconderijo e abre o mercado", () => {
    const player = createNewPlayer(new ManualClock());
    const onOpenFlea = vi.fn();
    const scene = new InventoryScene(player.inventory, {
      player,
      onOpenTraders: noop,
      onOpenQuests: noop,
      onOpenHideout: noop,
      onOpenFlea,
    });
    const button = scene.fleaButton!;
    expect(button.text.text).toBe("Mercado");
    expect(rightEdge(button)).toBeLessThan(scene.hideoutButton!.x);
    // não cobre o título "Equipamento"
    expect(button.x).toBeGreaterThan(140);
    button.emit("pointertap", {} as never);
    expect(onOpenFlea).toHaveBeenCalledOnce();
    scene.destroy();
  });

  it("sem os outros botões, encosta no que existir", () => {
    const { inventory } = createNewPlayer(new ManualClock());
    const quests = new InventoryScene(inventory, {
      onOpenQuests: noop,
      onOpenFlea: noop,
    });
    expect(rightEdge(quests.fleaButton!)).toBeLessThan(quests.questsButton!.x);
    const traders = new InventoryScene(inventory, {
      onOpenTraders: noop,
      onOpenFlea: noop,
    });
    expect(rightEdge(traders.fleaButton!)).toBeLessThan(
      traders.tradersButton!.x,
    );
    const alone = new InventoryScene(inventory, { onOpenFlea: noop });
    expect(rightEdge(alone.fleaButton!)).toBeLessThan(STASH_X);
    expect(new InventoryScene(inventory).fleaButton).toBeNull();
  });
});
