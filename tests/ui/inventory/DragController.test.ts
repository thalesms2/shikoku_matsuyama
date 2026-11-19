// @vitest-environment jsdom
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import { DragController } from "../../../src/ui/inventory/DragController.ts";
import { GridView } from "../../../src/ui/inventory/GridView.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import { SlotView } from "../../../src/ui/inventory/SlotView.ts";
import { setup } from "../../core/inventory/fixtures.ts";

/**
 * Monta uma cena de teste: estoque 6x4 em (0,0) e slots de capacete e
 * mochila em x = 400, todos num root sem escala (global = local + posição).
 */
function scene() {
  const { make } = setup();
  const root = new Container();
  const stash = new Grid(6, 4);
  const equipment = new Equipment();
  const stashView = new GridView(stash);
  const helmetSlot = new SlotView(equipment, "helmet");
  helmetSlot.position.set(400, 0);
  const backpackSlot = new SlotView(equipment, "backpack");
  backpackSlot.position.set(400, 200);
  const overlay = new Container();
  root.addChild(stashView, helmetSlot, backpackSlot, overlay);
  const onChange = vi.fn(() => {
    stashView.refresh();
    helmetSlot.refresh();
    backpackSlot.refresh();
  });
  const drag = new DragController(
    overlay,
    () => ({ grids: [stashView], slots: [helmetSlot, backpackSlot] }),
    onChange,
  );
  const put = (id: string, x: number, y: number, count?: number) => {
    const item = make(id, count);
    stash.place(item, x, y);
    stashView.refresh();
    return item;
  };
  const viewOf = (item: Item) => stashView.itemViews.get(item)!;
  /** Centro da célula (x, y) do estoque, em coordenadas globais */
  const cell = (x: number, y: number) => ({
    x: x * CELL + CELL / 2,
    y: y * CELL + CELL / 2,
  });
  return {
    make,
    root,
    stash,
    equipment,
    stashView,
    helmetSlot,
    backpackSlot,
    overlay,
    onChange,
    drag,
    put,
    viewOf,
    cell,
  };
}

describe("DragController", () => {
  it("sem arraste, move/end/rotate/cancel/resolve não fazem nada", () => {
    const { drag, onChange } = scene();
    drag.move({ x: 0, y: 0 });
    drag.rotate();
    drag.cancel();
    expect(drag.end({ x: 0, y: 0 })).toBe(false);
    expect(drag.resolve({ x: 0, y: 0 })).toBeNull();
    expect(drag.dragging).toBeNull();
    expect(drag.rotated).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("begin cria o fantasma e esmaece a origem", () => {
    const { drag, put, viewOf, overlay, cell } = scene();
    const item = put("wide", 0, 0);
    const source = viewOf(item);
    drag.begin(source, cell(0, 0));
    expect(drag.dragging).toBe(item);
    expect(source.alpha).toBeLessThan(1);
    expect(overlay.children).toHaveLength(1);
    const ghost = overlay.children[0];
    // agarrado no centro da célula: o fantasma começa no canto do item
    expect(ghost.position.x).toBe(0);
    expect(ghost.position.y).toBe(0);
  });

  it("move o item para outra célula da grade", () => {
    const { drag, put, viewOf, stash, cell, onChange, overlay } = scene();
    const item = put("wide", 0, 0);
    drag.begin(viewOf(item), cell(0, 0));
    drag.move(cell(3, 2));
    expect(overlay.children[0].position.x).toBe(3 * CELL);
    expect(drag.end(cell(3, 2))).toBe(true);
    expect(item.location).toMatchObject({ grid: stash, x: 3, y: 2 });
    expect(onChange).toHaveBeenCalledOnce();
    expect(overlay.children).toHaveLength(0);
    expect(drag.dragging).toBeNull();
  });

  it("mostra prévia verde onde cabe e vermelha onde não cabe", () => {
    const { drag, put, viewOf, stashView, cell } = scene();
    const item = put("wide", 0, 0);
    put("square", 3, 0);
    drag.begin(viewOf(item), cell(0, 0));
    drag.move(cell(0, 2));
    expect(drag.resolve(cell(0, 2))).toMatchObject({ kind: "grid", ok: true });
    expect(stashView.highlight.visible).toBe(true);
    drag.move(cell(2, 0));
    expect(drag.resolve(cell(2, 0))).toMatchObject({
      kind: "grid",
      x: 2,
      y: 0,
      ok: false,
    });
  });

  it("não move quando a posição está ocupada e restaura a origem", () => {
    const { drag, put, viewOf, cell, onChange } = scene();
    const item = put("wide", 0, 0);
    put("square", 3, 0);
    const source = viewOf(item);
    drag.begin(source, cell(0, 0));
    expect(drag.end(cell(2, 0))).toBe(false);
    expect(item.location).toMatchObject({ x: 0, y: 0 });
    expect(source.alpha).toBe(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("soltar fora de qualquer alvo não faz nada", () => {
    const { drag, put, viewOf, cell, stashView } = scene();
    const item = put("small", 0, 0);
    drag.begin(viewOf(item), cell(0, 0));
    drag.move({ x: 2000, y: 2000 });
    expect(stashView.highlight.visible).toBe(false);
    expect(drag.end({ x: 2000, y: 2000 })).toBe(false);
  });

  it("R gira o item durante o arraste", () => {
    const { drag, put, viewOf, cell, stash } = scene();
    const item = put("tall", 0, 0);
    drag.begin(viewOf(item), cell(0, 0));
    drag.rotate(cell(2, 3));
    expect(drag.rotated).toBe(true);
    drag.rotate();
    expect(drag.rotated).toBe(false);
    drag.rotate(cell(2, 3));
    expect(drag.end(cell(2, 3))).toBe(true);
    expect(item.location).toMatchObject({
      grid: stash,
      x: 2,
      y: 3,
      rotated: true,
    });
  });

  it("soltar sobre uma pilha igual soma as quantidades", () => {
    const { drag, put, viewOf, cell, stash } = scene();
    const source = put("ammo", 0, 0, 10);
    const target = put("ammo", 2, 0, 15);
    drag.begin(viewOf(source), cell(0, 0));
    drag.move(cell(2, 0));
    expect(drag.resolve(cell(2, 0))).toMatchObject({
      kind: "item",
      target,
      ok: true,
    });
    expect(drag.end(cell(2, 0))).toBe(true);
    expect(target.count).toBe(25);
    expect(stash.has(source)).toBe(false);
  });

  it("soltar sobre um contêiner guarda o item dentro dele", () => {
    const { drag, put, viewOf, cell } = scene();
    const item = put("small", 0, 0);
    const bag = put("bag", 2, 0);
    drag.begin(viewOf(item), cell(0, 0));
    drag.move(cell(3, 1));
    expect(drag.end(cell(3, 1))).toBe(true);
    expect(item.location).toMatchObject({ grid: bag.grids[0] });
  });

  it("contêiner cheio ou que não aceita o item fica vermelho", () => {
    const { drag, put, viewOf, cell } = scene();
    const item = put("small", 0, 0);
    put("box", 2, 0);
    drag.begin(viewOf(item), cell(0, 0));
    drag.move(cell(2, 0));
    expect(drag.resolve(cell(2, 0))).toMatchObject({ kind: "item", ok: false });
    expect(drag.end(cell(2, 0))).toBe(false);
  });

  it("soltar sobre um item comum ocupado é recusado", () => {
    const { drag, put, viewOf, cell } = scene();
    const item = put("small", 0, 0);
    put("small", 2, 0);
    drag.begin(viewOf(item), cell(0, 0));
    expect(drag.resolve(cell(2, 0))).toMatchObject({ kind: "grid", ok: false });
  });

  it("arrastar sobre o próprio item é um movimento normal na grade", () => {
    const { drag, put, viewOf, cell } = scene();
    const item = put("wide", 0, 0);
    drag.begin(viewOf(item), cell(0, 0));
    expect(drag.resolve(cell(1, 0))).toMatchObject({
      kind: "grid",
      x: 1,
      ok: true,
    });
  });

  it("equipa no slot compatível e recusa slot incompatível", () => {
    const { drag, put, viewOf, cell, equipment, helmetSlot, backpackSlot } =
      scene();
    const helmet = put("helmet", 0, 0);
    drag.begin(viewOf(helmet), cell(0, 0));
    drag.move({ x: 420, y: 220 });
    expect(backpackSlot.highlight.visible).toBe(true);
    expect(drag.resolve({ x: 420, y: 220 })).toMatchObject({
      kind: "slot",
      ok: false,
    });
    drag.move({ x: 420, y: 20 });
    expect(helmetSlot.highlight.visible).toBe(true);
    expect(drag.end({ x: 420, y: 20 })).toBe(true);
    expect(equipment.get("helmet")).toBe(helmet);
  });

  it("soltar no próprio slot não muda nada", () => {
    const { drag, equipment, helmetSlot, make, onChange } = scene();
    const helmet = make("helmet");
    equipment.equip("helmet", helmet);
    helmetSlot.refresh();
    drag.begin(helmetSlot.itemView!, { x: 410, y: 10 });
    expect(drag.resolve({ x: 420, y: 20 })).toMatchObject({
      kind: "slot",
      ok: true,
    });
    expect(drag.end({ x: 420, y: 20 })).toBe(false);
    expect(equipment.get("helmet")).toBe(helmet);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("tira um item do slot para a grade", () => {
    const { drag, equipment, helmetSlot, make, stash, cell } = scene();
    const helmet = make("helmet");
    equipment.equip("helmet", helmet);
    helmetSlot.refresh();
    drag.begin(helmetSlot.itemView!, { x: 400 + CELL / 2, y: CELL / 2 });
    expect(drag.end(cell(4, 2))).toBe(true);
    expect(helmet.location).toMatchObject({ grid: stash, x: 4, y: 2 });
    expect(equipment.get("helmet")).toBeNull();
  });

  it("cancel remove o fantasma, as prévias e restaura a origem", () => {
    const { drag, put, viewOf, cell, overlay, stashView } = scene();
    const item = put("small", 0, 0);
    const source = viewOf(item);
    drag.begin(source, cell(0, 0));
    drag.move(cell(1, 1));
    drag.cancel();
    expect(overlay.children).toHaveLength(0);
    expect(stashView.highlight.visible).toBe(false);
    expect(source.alpha).toBe(1);
    expect(drag.dragging).toBeNull();
  });

  it("cancel não falha se a view de origem já foi destruída", () => {
    const { drag, put, viewOf, cell, stashView } = scene();
    const item = put("small", 0, 0);
    drag.begin(viewOf(item), cell(0, 0));
    stashView.refresh();
    expect(() => drag.cancel()).not.toThrow();
  });

  it("soltar no mesmo lugar (um clique) não conta como mudança", () => {
    const { drag, put, viewOf, cell, onChange } = scene();
    const item = put("wide", 0, 0);
    const source = viewOf(item);
    drag.begin(source, cell(0, 0));
    expect(drag.end(cell(0, 0))).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(source.destroyed).toBe(false);
  });

  it("soltar no mesmo lugar girado é uma mudança", () => {
    const { drag, put, viewOf, cell } = scene();
    const item = put("tall", 0, 0);
    drag.begin(viewOf(item), cell(0, 0));
    drag.rotate();
    expect(drag.end(cell(0, 0))).toBe(true);
    expect(item.location).toMatchObject({ x: 0, y: 0, rotated: true });
  });

  it("mesma posição em outra grade é uma mudança", () => {
    const { drag, make, stashView, cell, root, onChange } = scene();
    const other = new Grid(2, 2);
    const item = make("small");
    other.place(item, 0, 0);
    const otherView = new GridView(other);
    otherView.position.set(0, 300);
    root.addChild(otherView);
    drag.begin(otherView.itemViews.get(item)!, { x: 24, y: 324 });
    expect(drag.end(cell(0, 0))).toBe(true);
    expect(item.location).toMatchObject({ grid: stashView.grid, x: 0, y: 0 });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("begin durante outro arraste cancela o anterior", () => {
    const { drag, put, viewOf, cell, overlay } = scene();
    const a = put("small", 0, 0);
    const b = put("small", 1, 0);
    drag.begin(viewOf(a), cell(0, 0));
    drag.begin(viewOf(b), cell(1, 0));
    expect(drag.dragging).toBe(b);
    expect(overlay.children).toHaveLength(1);
    expect(viewOf(a).alpha).toBe(1);
  });
});
