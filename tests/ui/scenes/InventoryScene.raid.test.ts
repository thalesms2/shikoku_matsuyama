// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { InventoryScene } from "../../../src/ui/scenes/InventoryScene.ts";

describe("InventoryScene: botão Raid", () => {
  it("fica à esquerda do Skills e abre a preparação", () => {
    const player = createNewPlayer(new ManualClock());
    const onOpenRaid = vi.fn();
    const scene = new InventoryScene(player.inventory, {
      player,
      onOpenSkills: () => {},
      onOpenRaid,
    });
    const raid = scene.raidButton!;
    expect(raid.text.text).toBe("Raid");
    expect(raid.x).toBeLessThan(scene.skillsButton!.x);
    raid.emit("pointertap", {} as never);
    expect(onOpenRaid).toHaveBeenCalledOnce();
    scene.destroy();
  });

  it("sem Skills, fica à esquerda do Organizar; sem callback, não existe", () => {
    const player = createNewPlayer(new ManualClock());
    const scene = new InventoryScene(player.inventory, {
      onOpenRaid: () => {},
    });
    expect(scene.raidButton!.x).toBeLessThan(scene.sortButton.x);
    expect(new InventoryScene(player.inventory).raidButton).toBeNull();
    scene.destroy();
  });
});
