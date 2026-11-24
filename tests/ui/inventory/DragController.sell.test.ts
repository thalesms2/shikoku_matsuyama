// @vitest-environment jsdom
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { DragController } from "../../../src/ui/inventory/DragController.ts";
import type { DragHooks } from "../../../src/ui/inventory/DragController.ts";
import { GridView } from "../../../src/ui/inventory/GridView.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import { SlotView } from "../../../src/ui/inventory/SlotView.ts";
import { magSetup } from "../../core/inventory/magFixtures.ts";

/** Estoque 4x2 em (0,0) e a área de venda 100x30 em (500, 0) */
function scene(hooks: DragHooks = {}, withSell = true) {
  const { make } = magSetup();
  const stash = new Grid(4, 2);
  const stashView = new GridView(stash);
  const holster = new SlotView(new Equipment(), "holster");
  holster.position.set(300, 0);
  const area = new Container();
  area.position.set(500, 0);
  const overlay = new Container();
  new Container().addChild(stashView, holster, area, overlay);
  const onChange = vi.fn();
  const drag = new DragController(
    overlay,
    () => ({
      grids: [stashView],
      slots: [holster],
      ...(withSell && { sell: { view: area, width: 100, height: 30 } }),
    }),
    onChange,
    hooks,
  );
  const rock = make("rock");
  stash.place(rock, 0, 0);
  stashView.refresh();
  const begin = () =>
    drag.begin(stashView.itemViews.get(rock)!, { x: CELL / 2, y: CELL / 2 });
  return { drag, area, rock, begin, onChange, stash };
}

describe("DragController: soltar sobre a área de venda", () => {
  it("chama onSell com o item, sem mudar o inventário", () => {
    const onSell = vi.fn();
    const { drag, area, rock, begin, onChange, stash } = scene({ onSell });
    begin();
    expect(drag.resolve({ x: 510, y: 10 })).toMatchObject({
      kind: "sell",
      ok: true,
    });
    drag.move({ x: 510, y: 10 });
    expect(area.alpha).toBe(1);
    expect(drag.end({ x: 510, y: 10 })).toBe(false);
    expect(onSell).toHaveBeenCalledWith(rock);
    expect(onChange).not.toHaveBeenCalled();
    expect(stash.has(rock)).toBe(true);
  });

  it("canSell recusa: fica apagada e não chama onSell", () => {
    const onSell = vi.fn();
    const { drag, area, begin } = scene({ onSell, canSell: () => false });
    begin();
    drag.move({ x: 510, y: 10 });
    expect(area.alpha).toBe(0.4);
    // sair da área volta ao normal
    drag.move({ x: CELL / 2, y: CELL / 2 });
    expect(area.alpha).toBe(1);
    expect(drag.end({ x: 510, y: 10 })).toBe(false);
    expect(onSell).not.toHaveBeenCalled();
  });

  it("fora da área, sem o hook ou sem a área, não é venda", () => {
    const onSell = vi.fn();
    const { drag, begin } = scene({ onSell });
    begin();
    expect(drag.resolve({ x: 610, y: 10 })).toBeNull();
    expect(drag.resolve({ x: 510, y: 40 })).toBeNull();
    expect(drag.resolve({ x: 490, y: 10 })).toBeNull();
    expect(drag.resolve({ x: 510, y: -5 })).toBeNull();
    const noHook = scene();
    noHook.begin();
    expect(noHook.drag.resolve({ x: 510, y: 10 })).toBeNull();
    const noArea = scene({ onSell }, false);
    noArea.begin();
    expect(noArea.drag.resolve({ x: 510, y: 10 })).toBeNull();
  });
});
