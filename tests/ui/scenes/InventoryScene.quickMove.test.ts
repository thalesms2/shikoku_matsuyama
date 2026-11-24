// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { catalog } from "../../../src/data/items.ts";
import { InventoryScene } from "../../../src/ui/scenes/InventoryScene.ts";

const press = (keys: { ctrlKey?: boolean; metaKey?: boolean }) =>
  ({ global: { x: 0, y: 0 }, button: 0, ...keys }) as never;

describe("InventoryScene: Ctrl+clique", () => {
  it("Ctrl+clique equipa do estoque e ⌘+clique devolve ao estoque, sem arrastar", () => {
    const factory = new ItemFactory(catalog);
    const state = { stash: new Grid(6, 6), equipment: new Equipment() };
    const helmet = factory.create("helmet_tk1");
    state.stash.place(helmet, 0, 0);
    const scene = new InventoryScene(state, { clock: new ManualClock(0) });
    scene.stashView.itemViews
      .get(helmet)!
      .emit("pointerdown", press({ ctrlKey: true }));
    expect(scene.drag.dragging).toBeNull();
    expect(state.equipment.get("helmet")).toBe(helmet);
    expect(scene.slotViews.get("helmet")!.itemView?.item).toBe(helmet);

    scene.slotViews
      .get("helmet")!
      .itemView!.emit("pointerdown", press({ metaKey: true }));
    expect(state.stash.has(helmet)).toBe(true);
    expect(scene.stashView.itemViews.has(helmet)).toBe(true);
    scene.destroy();
  });

  it("sem espaço, nada muda e nada é redesenhado", () => {
    const factory = new ItemFactory(catalog);
    const state = { stash: new Grid(1, 1), equipment: new Equipment() };
    state.stash.place(factory.create("barter_bolts"), 0, 0);
    const can = factory.create("food_can");
    state.equipment.pockets[0].place(can, 0, 0);
    const scene = new InventoryScene(state, { clock: new ManualClock(0) });
    const view = scene.pocketViews[0].itemViews.get(can)!;
    view.emit("pointerdown", press({ ctrlKey: true }));
    expect(state.equipment.pockets[0].has(can)).toBe(true);
    expect(scene.pocketViews[0].itemViews.get(can)).toBe(view);
    scene.destroy();
  });
});
