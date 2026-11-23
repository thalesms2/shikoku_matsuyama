// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import { loadedRounds } from "../../../src/core/inventory/magazine.ts";
import { MAG_DRILLS_XP_PER_ROUND } from "../../../src/core/pmc/consumables.ts";
import { damage } from "../../../src/core/pmc/pmc.ts";
import { skillXpForLevel } from "../../../src/core/pmc/skills.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { InventoryScene } from "../../../src/ui/scenes/InventoryScene.ts";

const ev = (x: number, y: number, button = 0) =>
  ({ global: { x, y }, button }) as never;

function setup(onOpenCharacter?: () => void) {
  const clock = new ManualClock(0);
  const player = createNewPlayer(clock);
  const scene = new InventoryScene(player.inventory, {
    clock,
    player,
    onOpenCharacter,
  });
  const find = (id: string) =>
    player.inventory.stash.items().find((i) => i.def.id === id)!;
  const viewOf = (item: Item) => scene.stashView.itemViews.get(item)!;
  return { clock, player, scene, find, viewOf };
}

describe("InventoryScene com o estado do jogador", () => {
  it("usa a fábrica e o carregamento do jogador", () => {
    const { scene, player } = setup();
    expect(scene.player).toBe(player);
    expect(scene.factory).toBe(player.factory);
    expect(scene.loader).toBe(player.loader);
    expect(scene.characterButton).toBeNull();
    scene.destroy();
  });

  it("botão Personagem quando há onOpenCharacter", () => {
    const open = vi.fn();
    const { scene } = setup(open);
    expect(scene.characterButton!.text.text).toBe("Personagem");
    scene.characterButton!.emit("pointertap", ev(0, 0));
    expect(open).toHaveBeenCalledOnce();
    scene.destroy();
  });

  it("Usar no menu cura o PMC e consome o item", () => {
    const { scene, player, find, viewOf } = setup();
    damage(player.pmc, "thorax", 50);
    const kit = find("med_kit");
    viewOf(kit).emit("pointerdown", ev(0, 0, 2));
    expect(scene.contextMenu.buttons[0].text.text).toBe("Usar");
    scene.contextMenu.buttons[0].emit("pointertap", ev(0, 0));
    expect(player.pmc.health.thorax).toBe(85);
    expect(player.inventory.stash.has(kit)).toBe(false);
    expect(scene.stashView.itemViews.has(kit)).toBe(false);
    scene.destroy();
  });

  it("useItem sem jogador não faz nada", () => {
    const { player } = setup();
    const scene = new InventoryScene(player.inventory);
    expect(scene.useItem(player.inventory.stash.items()[0])).toBe(false);
    scene.destroy();
  });

  it("useItem devolve false para itens que não são consumíveis", () => {
    const { scene, find } = setup();
    expect(scene.useItem(find("barter_bolts"))).toBe(false);
    expect(scene.useItem(find("food_can"))).toBe(true);
    scene.destroy();
  });

  it("carregar dá XP de Manuseio de carregador e a skill acelera", () => {
    const { scene, player, find, clock } = setup();
    const mag = player.inventory.stash
      .items()
      .find((i) => i.def.id === "mag_vk74")!;
    const ammo = find("ammo_545");
    player.skills.magDrills = skillXpForLevel(20); // 20% mais rápido: 400 ms
    const xpBefore = player.skills.magDrills;
    scene.loader.start({ kind: "load", magazine: mag, ammo });
    clock.advance(1200);
    scene.update(1200);
    expect(scene.loader.msPerRound).toBe(400);
    expect(loadedRounds(mag)).toBe(3);
    expect(player.skills.magDrills).toBe(
      xpBefore + 3 * MAG_DRILLS_XP_PER_ROUND,
    );
    scene.destroy();
  });

  it("sem jogador, o carregamento não dá XP e usa o tempo padrão", () => {
    const { player, clock } = setup();
    const scene = new InventoryScene(player.inventory, { clock });
    const mag = player.inventory.stash
      .items()
      .find((i) => i.def.id === "mag_vk74")!;
    const ammo = player.inventory.stash
      .items()
      .find((i) => i.def.id === "ammo_545")!;
    scene.loader.start({ kind: "load", magazine: mag, ammo });
    clock.advance(1000);
    scene.update(1000);
    expect(loadedRounds(mag)).toBe(2);
    expect(player.skills.magDrills).toBe(0);
    scene.destroy();
  });
});
