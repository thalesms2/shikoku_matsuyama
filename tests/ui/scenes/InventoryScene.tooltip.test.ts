// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { catalog } from "../../../src/data/items.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import {
  InventoryScene,
  STASH_X,
} from "../../../src/ui/scenes/InventoryScene.ts";

const ev = (x: number, y: number, button = 0) =>
  ({ global: { x, y }, button }) as never;

function setup(tooltipDelayMs?: number) {
  const factory = new ItemFactory(catalog);
  const state = { stash: new Grid(6, 4), equipment: new Equipment() };
  const scene = new InventoryScene(state, { tooltipDelayMs });
  const can = factory.create("food_can");
  state.stash.place(can, 0, 0);
  scene.refresh();
  const view = () => scene.stashView.itemViews.get(can)!;
  const point = ev(STASH_X + CELL / 2, scene.stashView.y + CELL / 2);
  return { scene, view, point };
}

describe("InventoryScene: tooltip", () => {
  it("sem atraso por padrão", () => {
    const { scene } = setup();
    expect(scene.tooltipDelayMs).toBe(0);
    scene.update(16);
    scene.destroy();
  });

  it("com atraso, só aparece depois do tempo parado sobre o item", () => {
    const { scene, view, point } = setup(300);
    view().emit("pointerover", point);
    expect(scene.tooltip.visible).toBe(false);
    scene.update(200);
    expect(scene.tooltip.visible).toBe(false);
    scene.update(100);
    expect(scene.tooltip.visible).toBe(true);
    expect(scene.tooltip.text.text).toContain("Lata de carne");
    scene.destroy();
  });

  it("sair do item ou começar a arrastar cancela o tooltip pendente", () => {
    const { scene, view, point } = setup(300);
    view().emit("pointerover", point);
    view().emit("pointerout", point);
    scene.update(500);
    expect(scene.tooltip.visible).toBe(false);
    view().emit("pointerover", point);
    view().emit("pointerdown", point);
    scene.update(500);
    expect(scene.tooltip.visible).toBe(false);
    scene.destroy();
  });

  it("mostra a descrição do item", () => {
    const { scene, view, point } = setup();
    view().emit("pointerover", point);
    expect(scene.tooltip.descriptionText.text).toContain("conserva");
    scene.destroy();
  });

  it("visibleBounds converte a tela para coordenadas do conteúdo", () => {
    const { scene } = setup();
    expect(scene.visibleBounds()).toBeUndefined();
    scene.resize(800, 600);
    const scale = scene.content.scale.x;
    const b = scene.visibleBounds()!;
    expect(b.width).toBeCloseTo(800 / scale);
    expect(b.height).toBeCloseTo(600 / scale);
    expect(b.x).toBeCloseTo(-scene.content.x / scale);
    expect(b.y).toBeCloseTo(-scene.content.y / scale);
    scene.destroy();
  });

  it("perto da borda direita o tooltip abre para a esquerda", () => {
    const { scene, view } = setup();
    scene.resize(1000, 700);
    const b = scene.visibleBounds()!;
    const scale = scene.content.scale.x;
    // ponteiro no canto direito da tela
    const gx = 995;
    view().emit("pointerover", ev(gx, 100));
    const localX = (gx - scene.content.x) / scale;
    expect(scene.tooltip.x).toBeLessThan(localX);
    expect(scene.tooltip.x + scene.tooltip.boxWidth).toBeLessThanOrEqual(
      b.x + b.width,
    );
    scene.destroy();
  });
});
