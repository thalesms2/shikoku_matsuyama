// @vitest-environment jsdom
import { Rectangle } from "pixi.js";
import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { catalog } from "../../../src/data/items.ts";
import { GridView } from "../../../src/ui/inventory/GridView.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import {
  AUTOSCROLL_MS,
  InventoryScene,
  STASH_VISIBLE_ROWS,
  STASH_X,
  WHEEL_ROWS,
} from "../../../src/ui/scenes/InventoryScene.ts";

const ROW_TOP = 40;

const ev = (x: number, y: number, button = 0) =>
  ({ global: { x, y }, button }) as never;
const wheel = (deltaY: number) => ({ deltaY }) as never;

/** Inventário com estoque 10 x `rows` vazio */
function scene(rows = 24) {
  const factory = new ItemFactory(catalog);
  const state = { stash: new Grid(10, rows), equipment: new Equipment() };
  const inv = new InventoryScene(state, { clock: new ManualClock(1000) });
  return { factory, state, inv };
}

describe("GridView.clip", () => {
  it("só a faixa visível conta para soltar itens", () => {
    const view = new GridView(new Grid(2, 6));
    expect(view.containsLocal(10, 5 * CELL + 1)).toBe(true);
    view.clip = { top: CELL, bottom: 3 * CELL };
    expect(view.containsLocal(10, 10)).toBe(false);
    expect(view.containsLocal(10, CELL)).toBe(true);
    expect(view.containsLocal(10, 3 * CELL)).toBe(false);
    view.clip = { top: 0, bottom: 99 * CELL };
    expect(view.containsLocal(10, 6 * CELL)).toBe(false);
  });
});

describe("InventoryScene: rolagem do estoque", () => {
  it("estoque pequeno não rola e não mostra a barra", () => {
    const { inv } = scene(14);
    expect(inv.maxStashScroll).toBe(0);
    expect(inv.stashVisibleRows).toBe(14);
    expect(inv.scrollBar.visible).toBe(false);
    inv.stashView.emit("wheel", wheel(100));
    expect(inv.stashScroll).toBe(0);
    expect(inv.stashView.clip).toEqual({ top: 0, bottom: 14 * CELL });
    expect(scene(4).inv.stashVisibleRows).toBe(4);
    inv.destroy();
  });

  it("a roda do mouse rola o estoque grande dentro dos limites", () => {
    const { inv } = scene(24);
    expect(inv.stashVisibleRows).toBe(STASH_VISIBLE_ROWS);
    expect(inv.maxStashScroll).toBe(10);
    expect(inv.scrollBar.visible).toBe(true);
    inv.stashView.emit("wheel", wheel(120));
    expect(inv.stashScroll).toBe(WHEEL_ROWS);
    expect(inv.stashView.y).toBe(ROW_TOP - WHEEL_ROWS * CELL);
    expect(inv.stashView.clip).toEqual({
      top: WHEEL_ROWS * CELL,
      bottom: (WHEEL_ROWS + STASH_VISIBLE_ROWS) * CELL,
    });
    expect(inv.stashView.hitArea).toEqual(
      new Rectangle(0, WHEEL_ROWS * CELL, 10 * CELL, STASH_VISIBLE_ROWS * CELL),
    );
    inv.stashView.emit("wheel", wheel(0));
    expect(inv.stashScroll).toBe(WHEEL_ROWS);
    inv.stashView.emit("wheel", wheel(-3));
    expect(inv.stashScroll).toBe(0);
    expect(inv.scrollStash(-1)).toBe(false);
    expect(inv.scrollStash(99)).toBe(true);
    expect(inv.stashScroll).toBe(10);
    expect(inv.scrollStash(1)).toBe(false);
    inv.destroy();
  });

  it("a escala usa só as linhas visíveis", () => {
    const small = scene(14).inv;
    const big = scene(24).inv;
    small.resize(1200, 800);
    big.resize(1200, 800);
    expect(big.content.scale.x).toBe(small.content.scale.x);
    small.destroy();
    big.destroy();
  });

  it("refresh mantém a rolagem dentro do limite", () => {
    const { inv } = scene(24);
    inv.stashScroll = 50;
    inv.refresh();
    expect(inv.stashScroll).toBe(10);
    inv.destroy();
  });

  it("linhas escondidas não recebem o item arrastado", () => {
    const { inv, state, factory } = scene(24);
    const item = factory.create("food_can");
    state.stash.place(item, 0, 0);
    inv.refresh();
    inv.stashView.itemViews
      .get(item)!
      .emit("pointerdown", ev(STASH_X + 5, ROW_TOP + 5));
    // a linha 20 fica abaixo da janela (14 linhas)
    const hidden = { x: STASH_X + 5, y: ROW_TOP + 20 * CELL + 5 };
    expect(inv.drag.resolve(hidden)).toBeNull();
    inv.scrollStash(10);
    expect(
      inv.drag.resolve({ x: hidden.x, y: hidden.y - 10 * CELL }),
    ).toMatchObject({
      kind: "grid",
      y: 20,
      ok: true,
    });
    inv.drag.cancel();
    inv.destroy();
  });

  it("arrastando perto das bordas, rola uma linha por intervalo", () => {
    const { inv, state, factory } = scene(24);
    const item = factory.create("food_can");
    state.stash.place(item, 0, 0);
    inv.refresh();
    const move = (x: number, y: number) =>
      inv.view.emit("globalpointermove", ev(x, y));
    const bottom = ROW_TOP + STASH_VISIBLE_ROWS * CELL;

    // sem arrastar, nada rola
    move(STASH_X + 5, bottom - 5);
    inv.update(AUTOSCROLL_MS);
    expect(inv.stashScroll).toBe(0);

    inv.stashView.itemViews
      .get(item)!
      .emit("pointerdown", ev(STASH_X + 5, ROW_TOP + 5));
    move(STASH_X + 5, bottom - 5);
    inv.update(AUTOSCROLL_MS - 1);
    expect(inv.stashScroll).toBe(0);
    inv.update(1);
    expect(inv.stashScroll).toBe(1);
    // a prévia acompanha a rolagem
    expect(inv.stashView.highlight.visible).toBe(true);
    inv.update(AUTOSCROLL_MS);
    expect(inv.stashScroll).toBe(2);

    // no meio do estoque o tempo zera
    move(STASH_X + 5, ROW_TOP + 5 * CELL);
    inv.update(AUTOSCROLL_MS);
    expect(inv.stashScroll).toBe(2);
    // fora da largura do estoque também não rola
    move(STASH_X - 10, bottom - 5);
    inv.update(AUTOSCROLL_MS);
    move(STASH_X + 10 * CELL + 1, bottom - 5);
    inv.update(AUTOSCROLL_MS);
    expect(inv.stashScroll).toBe(2);

    // perto do topo, sobe
    move(STASH_X + 5, ROW_TOP - 5);
    inv.update(AUTOSCROLL_MS);
    expect(inv.stashScroll).toBe(1);
    inv.drag.cancel();
    inv.destroy();
  });
});
