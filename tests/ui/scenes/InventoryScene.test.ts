// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import {
  Equipment,
  SLOT_NAMES,
} from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { detach } from "../../../src/core/inventory/operations.ts";
import { catalog } from "../../../src/data/items.ts";
import { createStarterInventory } from "../../../src/data/starter.ts";
import type { ItemView } from "../../../src/ui/inventory/ItemView.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import {
  DOUBLE_CLICK_MS,
  InventoryScene,
  STASH_X,
} from "../../../src/ui/scenes/InventoryScene.ts";

/** Evento de ponteiro falso com a posição global */
const ev = (x: number, y: number, button = 0) =>
  ({ global: { x, y }, button }) as never;

const key = (k: string) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));

/** Estado pequeno: estoque 6x4 vazio e equipamento vazio */
function smallScene() {
  const factory = new ItemFactory(catalog);
  const state = { stash: new Grid(6, 4), equipment: new Equipment() };
  const clock = new ManualClock(1000);
  const scene = new InventoryScene(state, { clock });
  const put = (id: string, x: number, y: number, count?: number) => {
    const item = factory.create(id, count);
    state.stash.place(item, x, y);
    scene.refresh();
    return item;
  };
  const viewOf = (item: Item): ItemView => scene.stashView.itemViews.get(item)!;
  /** Centro da célula (x, y) do estoque, em coordenadas globais (sem escala) */
  const cell = (x: number, y: number) =>
    [
      STASH_X + x * CELL + CELL / 2,
      scene.stashView.y + y * CELL + CELL / 2,
    ] as const;
  return { factory, state, clock, scene, put, viewOf, cell };
}

describe("InventoryScene", () => {
  it("monta slots, bolsos, contêineres equipados e estoque", () => {
    const state = createStarterInventory(new ItemFactory(catalog));
    const scene = new InventoryScene(state);
    expect([...scene.slotViews.keys()].sort()).toEqual([...SLOT_NAMES].sort());
    expect(scene.pocketViews).toHaveLength(4);
    expect(scene.stashView.grid).toBe(state.stash);
    expect(scene.stashView.x).toBe(STASH_X);
    // colete (4 grades) + mochila (1) + contêiner seguro (1)
    const { grids, slots } = scene.targets();
    expect(grids).toHaveLength(4 + 4 + 1 + 1 + 1);
    expect(grids.at(-1)).toBe(scene.stashView);
    expect(slots).toHaveLength(SLOT_NAMES.length);
    expect(scene.contentWidth).toBe(STASH_X + scene.stashView.pixelWidth);
    scene.destroy();
  });

  it("arrasta um item pelo estoque com eventos de ponteiro", () => {
    const { scene, put, viewOf, cell, state } = smallScene();
    const item = put("food_can", 0, 0);
    viewOf(item).emit("pointerdown", ev(...cell(0, 0)));
    expect(scene.drag.dragging).toBe(item);
    scene.view.emit("globalpointermove", ev(...cell(3, 2)));
    viewOf(item).emit("pointerup", ev(...cell(3, 2)));
    expect(item.location).toMatchObject({ grid: state.stash, x: 3, y: 2 });
    // a view nova do item está ligada aos eventos
    expect(viewOf(item).eventMode).toBe("static");
    scene.destroy();
  });

  it("pointerupoutside também solta o item", () => {
    const { scene, put, viewOf, cell } = smallScene();
    const item = put("food_can", 0, 0);
    viewOf(item).emit("pointerdown", ev(...cell(0, 0)));
    viewOf(item).emit("pointerupoutside", ev(...cell(5, 3)));
    expect(item.location).toMatchObject({ x: 5, y: 3 });
    scene.destroy();
  });

  it("ignora o botão direito", () => {
    const { scene, put, viewOf, cell } = smallScene();
    const item = put("food_can", 0, 0);
    viewOf(item).emit("pointerdown", ev(...cell(0, 0), 2));
    expect(scene.drag.dragging).toBeNull();
    scene.destroy();
  });

  it("R gira o item arrastado, Esc cancela e outras teclas não fazem nada", () => {
    const { scene, put, viewOf, cell } = smallScene();
    const item = put("food_water", 0, 0);
    viewOf(item).emit("pointerdown", ev(...cell(0, 0)));
    scene.view.emit("globalpointermove", ev(...cell(2, 2)));
    key("r");
    expect(scene.drag.rotated).toBe(true);
    key("R");
    expect(scene.drag.rotated).toBe(false);
    key("x");
    expect(scene.drag.dragging).toBe(item);
    key("Escape");
    expect(scene.drag.dragging).toBeNull();
    scene.destroy();
  });

  it("mostra tooltip ao passar o mouse, mas não durante o arraste", () => {
    const { scene, put, viewOf, cell } = smallScene();
    const item = put("food_can", 0, 0);
    const view = viewOf(item);
    view.emit("pointerover", ev(...cell(0, 0)));
    expect(scene.tooltip.visible).toBe(true);
    expect(scene.tooltip.text.text).toContain("Lata de carne");
    view.emit("pointerout", ev(0, 0));
    expect(scene.tooltip.visible).toBe(false);
    view.emit("pointerdown", ev(...cell(0, 0)));
    view.emit("pointerover", ev(...cell(0, 0)));
    expect(scene.tooltip.visible).toBe(false);
    scene.destroy();
  });

  it("duplo clique em um contêiner abre a janela dele", () => {
    const { scene, put, viewOf, clock } = smallScene();
    const box = put("ammo_case", 0, 0);
    viewOf(box).emit("pointertap", ev(0, 0));
    expect(scene.window).toBeNull();
    clock.advance(DOUBLE_CLICK_MS);
    viewOf(box).emit("pointertap", ev(0, 0));
    expect(scene.window?.item).toBe(box);
    expect(scene.targets().grids[0]).toBe(scene.window!.gridViews[0]);
    expect(scene.overlay.children[0]).toBe(scene.window);
    scene.destroy();
  });

  it("duplo clique real (pointerdown + pointerup + pointertap) abre a janela", () => {
    const { scene, put, viewOf, cell, clock } = smallScene();
    const box = put("ammo_case", 0, 0);
    const click = () => {
      const view = viewOf(box);
      view.emit("pointerdown", ev(...cell(0, 0)));
      view.emit("pointerup", ev(...cell(0, 0)));
      // o Pixi não entrega eventos a views destruídas
      if (!view.destroyed) view.emit("pointertap", ev(...cell(0, 0)));
    };
    click();
    clock.advance(100);
    click();
    expect(scene.window?.item).toBe(box);
    scene.destroy();
  });

  it("cliques lentos, em itens diferentes ou em itens comuns não abrem janela", () => {
    const { scene, put, viewOf, clock } = smallScene();
    const box = put("ammo_case", 0, 0);
    const can = put("food_can", 4, 0);
    viewOf(box).emit("pointertap", ev(0, 0));
    clock.advance(DOUBLE_CLICK_MS + 1);
    viewOf(box).emit("pointertap", ev(0, 0));
    expect(scene.window).toBeNull();
    viewOf(can).emit("pointertap", ev(0, 0));
    expect(scene.window).toBeNull();
    viewOf(can).emit("pointertap", ev(0, 0));
    expect(scene.window).toBeNull();
    scene.destroy();
  });

  it("dá para arrastar itens para dentro da janela aberta", () => {
    const { scene, put, viewOf, cell, factory } = smallScene();
    const box = put("ammo_case", 0, 0);
    const ammo = factory.create("ammo_9mm", 10);
    scene.state.stash.place(ammo, 4, 0);
    scene.refresh();
    scene.openWindow(box);
    const win = scene.window!;
    const target = win.gridViews[0];
    const gx = win.x + target.x + CELL / 2;
    const gy = win.y + target.y + CELL / 2;
    viewOf(ammo).emit("pointerdown", ev(...cell(4, 0)));
    viewOf(ammo).emit("pointerup", ev(gx, gy));
    expect(ammo.location).toMatchObject({ grid: box.grids[0], x: 0, y: 0 });
    expect(scene.window!.gridViews[0].itemViews.has(ammo)).toBe(true);
    scene.destroy();
  });

  it("fecha a janela pelo botão ou quando o contêiner some", () => {
    const { scene, put } = smallScene();
    const box = put("ammo_case", 0, 0);
    scene.openWindow(box);
    scene.window!.closeButton.emit("pointertap", ev(0, 0));
    expect(scene.window).toBeNull();
    scene.openWindow(box);
    scene.openWindow(box);
    expect(
      scene.overlay.children.filter((c) => c.label.startsWith("window")),
    ).toHaveLength(1);
    detach(box);
    scene.refresh();
    expect(scene.window).toBeNull();
    scene.destroy();
  });

  it("o painel de contêineres acompanha o equipamento", () => {
    const { scene, factory, state } = smallScene();
    expect(scene.targets().grids).toHaveLength(4 + 1);
    state.equipment.equip("backpack", factory.create("backpack_sack"));
    scene.refresh();
    expect(scene.targets().grids).toHaveLength(4 + 1 + 1);
    state.equipment.equip("rig", factory.create("rig_cargo"));
    scene.refresh();
    expect(scene.targets().grids).toHaveLength(4 + 4 + 1 + 1);
    expect(scene.containerPanel.children.length).toBeGreaterThan(0);
    scene.destroy();
  });

  it("equipa arrastando para um slot", () => {
    const { scene, put, viewOf, cell, state } = smallScene();
    const helmet = put("helmet_tk1", 0, 0);
    const slot = scene.slotViews.get("helmet")!;
    viewOf(helmet).emit("pointerdown", ev(...cell(0, 0)));
    viewOf(helmet).emit("pointerup", ev(slot.x + 10, slot.y + 10));
    expect(state.equipment.get("helmet")).toBe(helmet);
    expect(slot.itemView?.eventMode).toBe("static");
    scene.destroy();
  });

  it("o botão Organizar ordena o estoque", () => {
    const { scene, put } = smallScene();
    const can = put("food_can", 0, 0);
    const kit = put("med_kit", 3, 2);
    scene.sortButton.emit("pointertap", ev(0, 0));
    expect(kit.location).toMatchObject({ x: 0, y: 0 });
    expect(can.location).toMatchObject({ x: 2, y: 0 });
    expect(scene.sortStash()).toBe(true);
    scene.destroy();
  });

  it("resize escala e centraliza o conteúdo", () => {
    const { scene } = smallScene();
    const height = 40 + scene.stashView.pixelHeight;
    scene.resize(10000, 10000);
    expect(scene.content.scale.x).toBe(1.5);
    scene.resize(500, 5000);
    const scale = scene.content.scale.x;
    expect(scale).toBeCloseTo(500 / (scene.contentWidth + 64));
    expect(scene.content.position.x).toBeCloseTo(
      (500 - scene.contentWidth * scale) / 2,
    );
    expect(height).toBeGreaterThan(0);
    scene.destroy();
  });

  it("destroy cancela o arraste e para de ouvir o teclado", () => {
    const { scene, put, viewOf, cell } = smallScene();
    const item = put("food_water", 0, 0);
    viewOf(item).emit("pointerdown", ev(...cell(0, 0)));
    const rotate = vi.spyOn(scene.drag, "rotate");
    scene.destroy();
    expect(scene.drag.dragging).toBeNull();
    key("r");
    expect(rotate).not.toHaveBeenCalled();
  });
});
