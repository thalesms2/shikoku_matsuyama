// @vitest-environment jsdom
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import { loadedRounds } from "../../../src/core/inventory/magazine.ts";
import { DragController } from "../../../src/ui/inventory/DragController.ts";
import type { DragHooks } from "../../../src/ui/inventory/DragController.ts";
import { GridView } from "../../../src/ui/inventory/GridView.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import { SlotView } from "../../../src/ui/inventory/SlotView.ts";
import { magSetup } from "../../core/inventory/magFixtures.ts";

/** Estoque 8x4 em (0,0) e o coldre em x = 600 */
function scene(hooks?: DragHooks) {
  const { make } = magSetup();
  const root = new Container();
  const stash = new Grid(8, 4);
  const equipment = new Equipment();
  const stashView = new GridView(stash);
  const holster = new SlotView(equipment, "holster");
  holster.position.set(600, 0);
  const overlay = new Container();
  root.addChild(stashView, holster, overlay);
  const onChange = vi.fn(() => {
    stashView.refresh();
    holster.refresh();
  });
  const drag = new DragController(
    overlay,
    () => ({ grids: [stashView], slots: [holster] }),
    onChange,
    hooks,
  );
  const put = (id: string, x: number, y: number, count?: number) => {
    const item = make(id, count);
    stash.place(item, x, y);
    stashView.refresh();
    return item;
  };
  const viewOf = (item: Item) => stashView.itemViews.get(item)!;
  const cell = (x: number, y: number) => ({
    x: x * CELL + CELL / 2,
    y: y * CELL + CELL / 2,
  });
  return {
    make,
    stash,
    equipment,
    stashView,
    holster,
    drag,
    onChange,
    put,
    viewOf,
    cell,
  };
}

describe("DragController com carregadores", () => {
  it("munição sobre carregador compatível carrega na hora sem hook", () => {
    const { drag, put, viewOf, cell, stashView } = scene();
    const ammo = put("fmj", 0, 0, 40);
    const mag = put("mag", 3, 0);
    drag.begin(viewOf(ammo), cell(0, 0));
    drag.move(cell(3, 1));
    expect(drag.resolve(cell(3, 1))).toMatchObject({
      kind: "load",
      target: mag,
      ok: true,
    });
    expect(stashView.highlight.visible).toBe(true);
    expect(drag.end(cell(3, 1))).toBe(true);
    expect(loadedRounds(mag)).toBe(30);
    expect(ammo.count).toBe(10);
  });

  it("com o hook onLoad, entrega o carregamento para quem chamou", () => {
    const onLoad = vi.fn();
    const { drag, put, viewOf, cell, onChange } = scene({ onLoad });
    const ammo = put("fmj", 0, 0, 40);
    const mag = put("mag", 3, 0);
    drag.begin(viewOf(ammo), cell(0, 0));
    expect(drag.end(cell(3, 0))).toBe(true);
    expect(onLoad).toHaveBeenCalledWith(mag, ammo);
    expect(loadedRounds(mag)).toBe(0);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("calibre errado ou carregador cheio fica vermelho", () => {
    const { drag, put, viewOf, cell } = scene();
    const nine = put("nine", 0, 0, 10);
    put("mag", 3, 0);
    drag.begin(viewOf(nine), cell(0, 0));
    expect(drag.resolve(cell(3, 0))).toMatchObject({ kind: "load", ok: false });
    expect(drag.end(cell(3, 0))).toBe(false);
  });

  it("carregador sobre arma compatível na grade encaixa", () => {
    const { drag, put, viewOf, cell, stash } = scene();
    const mag = put("mag", 0, 0);
    const rifle = put("rifle", 2, 0);
    drag.begin(viewOf(mag), cell(0, 0));
    drag.move(cell(3, 1));
    expect(drag.resolve(cell(3, 1))).toMatchObject({
      kind: "attach",
      target: rifle,
      ok: true,
    });
    expect(drag.end(cell(3, 1))).toBe(true);
    expect(rifle.magazine).toBe(mag);
    expect(stash.has(mag)).toBe(false);
  });

  it("carregador de outro calibre sobre a arma é recusado", () => {
    const { drag, put, viewOf, cell } = scene();
    const mag9 = put("mag9", 0, 0);
    put("rifle", 2, 0);
    drag.begin(viewOf(mag9), cell(0, 0));
    expect(drag.resolve(cell(2, 0))).toMatchObject({
      kind: "attach",
      ok: false,
    });
  });

  it("carregador sobre a arma equipada no slot encaixa nela", () => {
    const { drag, put, viewOf, cell, equipment, holster, make } = scene();
    const pistol = make("pistol");
    equipment.equip("holster", pistol);
    holster.refresh();
    const mag9 = put("mag9", 0, 0);
    drag.begin(viewOf(mag9), cell(0, 0));
    drag.move({ x: 620, y: 20 });
    expect(holster.highlight.visible).toBe(true);
    expect(drag.resolve({ x: 620, y: 20 })).toMatchObject({
      kind: "attach",
      view: holster,
      target: pistol,
      ok: true,
    });
    expect(drag.end({ x: 620, y: 20 })).toBe(true);
    expect(pistol.magazine).toBe(mag9);
  });

  it("outros itens sobre a arma equipada continuam sendo recusados pelo slot", () => {
    const { drag, put, viewOf, cell, equipment, holster, make } = scene();
    equipment.equip("holster", make("pistol"));
    holster.refresh();
    const rock = put("rock", 0, 0);
    drag.begin(viewOf(rock), cell(0, 0));
    expect(drag.resolve({ x: 620, y: 20 })).toMatchObject({
      kind: "slot",
      ok: false,
    });
  });

  it("munição sobre item comum continua sendo um movimento na grade", () => {
    const { drag, put, viewOf, cell } = scene();
    const ammo = put("fmj", 0, 0, 5);
    put("rock", 2, 0);
    drag.begin(viewOf(ammo), cell(0, 0));
    expect(drag.resolve(cell(2, 0))).toMatchObject({ kind: "grid", ok: false });
  });
});
