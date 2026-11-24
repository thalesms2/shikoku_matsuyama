import { describe, expect, it } from "vitest";

import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { catalog } from "../../../src/data/items.ts";

describe("Grid.addRows", () => {
  it("cresce embaixo e mantém os itens no lugar", () => {
    const factory = new ItemFactory(catalog);
    const grid = new Grid(2, 1);
    const gpu = factory.create("barter_gpu");
    grid.place(gpu, 0, 0, false);
    expect(grid.findFreeSpot(factory.create("barter_bolts"))).toBeNull();
    grid.addRows(2);
    expect(grid.height).toBe(3);
    expect(grid.itemAt(0, 0)).toBe(gpu);
    expect(grid.itemAt(1, 2)).toBeNull();
    expect(grid.freeCells()).toBe(4);
    grid.addRows(0);
    expect(grid.height).toBe(3);
  });

  it("recusa valores inválidos", () => {
    const grid = new Grid(1, 1);
    expect(() => grid.addRows(-1)).toThrow(RangeError);
    expect(() => grid.addRows(1.5)).toThrow(RangeError);
  });
});
