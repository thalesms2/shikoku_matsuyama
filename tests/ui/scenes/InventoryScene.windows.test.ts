// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { detach } from "../../../src/core/inventory/operations.ts";
import { catalog } from "../../../src/data/items.ts";
import { WINDOW_HEADER } from "../../../src/ui/inventory/ContainerWindow.ts";
import {
  InventoryScene,
  WINDOW_CASCADE,
} from "../../../src/ui/scenes/InventoryScene.ts";

const ev = (x: number, y: number, target?: unknown) =>
  ({ global: { x, y }, button: 0, target }) as never;

function setup() {
  const factory = new ItemFactory(catalog);
  const state = { stash: new Grid(10, 10), equipment: new Equipment() };
  const box = factory.create("ammo_case");
  const sack = factory.create("backpack_sack");
  state.stash.place(box, 0, 0);
  state.stash.place(sack, 4, 0);
  const scene = new InventoryScene(state, { clock: new ManualClock(0) });
  return { factory, state, scene, box, sack };
}

describe("InventoryScene: várias janelas de contêiner", () => {
  it("abre várias, deslocadas; a da frente vem primeiro nos alvos", () => {
    const { scene, box, sack } = setup();
    scene.openWindow(box);
    scene.openWindow(sack);
    expect(scene.windows.map((w) => w.item)).toEqual([box, sack]);
    expect(scene.window?.item).toBe(sack);
    const [first, second] = scene.windows;
    expect(second.x - first.x).toBe(WINDOW_CASCADE);
    expect(second.y - first.y).toBe(WINDOW_CASCADE);
    expect(scene.targets().grids[0]).toBe(second.gridViews[0]);
    // as janelas ficam abaixo do tooltip e do menu
    expect(scene.overlay.getChildIndex(second)).toBe(1);
    expect(scene.overlay.getChildIndex(scene.tooltip)).toBeGreaterThan(1);
    scene.destroy();
  });

  it("reabrir ou clicar numa janela traz ela para frente", () => {
    const { scene, box, sack } = setup();
    scene.openWindow(box);
    scene.openWindow(sack);
    const [boxWin, sackWin] = scene.windows;
    scene.openWindow(box);
    expect(scene.window).toBe(boxWin);
    expect(scene.overlay.getChildIndex(boxWin)).toBe(1);
    sackWin.emit("pointerdown", ev(sackWin.x + 50, sackWin.y + 60));
    expect(scene.window).toBe(sackWin);
    // a da frente clicada de novo continua na frente
    sackWin.emit("pointerdown", ev(sackWin.x + 50, sackWin.y + 60));
    expect(scene.window).toBe(sackWin);
    expect(scene.windows).toHaveLength(2);
    scene.destroy();
  });

  it("fecha cada uma pelo X e as que o contêiner sumiu", () => {
    const { scene, box, sack } = setup();
    scene.openWindow(box);
    scene.openWindow(sack);
    const [boxWin] = scene.windows;
    boxWin.closeButton.emit("pointertap", ev(0, 0));
    expect(scene.windows.map((w) => w.item)).toEqual([sack]);
    detach(sack);
    scene.refresh();
    expect(scene.windows).toEqual([]);
    expect(scene.window).toBeNull();
    // fechar sem janela não faz nada
    scene.closeWindow();
    scene.closeWindow(boxWin);
    scene.destroy();
  });
});

describe("ContainerWindow: arrastar pela barra de título", () => {
  it("arrasta pela barra e para ao soltar; fora da barra ou no X não arrasta", () => {
    const { scene, box } = setup();
    scene.openWindow(box);
    const win = scene.window!;
    const { x, y } = win;
    win.emit("pointerdown", ev(x + 20, y + 10));
    expect(win.dragging).toBe(true);
    win.emit("globalpointermove", ev(x + 120, y + 60));
    expect(win.x).toBe(x + 100);
    expect(win.y).toBe(y + 50);
    win.emit("pointerup", ev(0, 0));
    expect(win.dragging).toBe(false);
    win.emit("globalpointermove", ev(0, 0));
    expect(win.x).toBe(x + 100);

    win.emit("pointerdown", ev(win.x + 20, win.y + WINDOW_HEADER + 5));
    expect(win.dragging).toBe(false);
    win.emit("pointerdown", ev(win.x + 20, win.y + 10, win.closeButton));
    expect(win.dragging).toBe(false);
    win.emit("pointerdown", ev(win.x + 20, win.y + 10));
    win.emit("pointerupoutside", ev(0, 0));
    expect(win.dragging).toBe(false);
    scene.destroy();
  });

  it("sem pai, não move", async () => {
    const { ContainerWindow } =
      await import("../../../src/ui/inventory/ContainerWindow.ts");
    const { box } = setup();
    const win = new ContainerWindow(box, () => {});
    win.emit("pointerdown", ev(10, 10));
    win.dragTo({ x: 100, y: 100 });
    expect(win.x).toBe(0);
  });
});
