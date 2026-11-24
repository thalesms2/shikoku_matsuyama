// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import {
  autoPlace,
  canStack,
  splitStack,
} from "../../../src/core/inventory/operations.ts";
import { catalog } from "../../../src/data/items.ts";
import { describeItem } from "../../../src/ui/inventory/Tooltip.ts";

describe('"encontrado na raid" (fir)', () => {
  const factory = new ItemFactory(catalog);

  it("não se mistura com pilhas comuns", () => {
    const fir = factory.create("ammo_9mm", 10);
    fir.fir = true;
    const plain = factory.create("ammo_9mm", 10);
    expect(canStack(fir, plain)).toBe(false);
    const other = factory.create("ammo_9mm", 5);
    other.fir = true;
    expect(canStack(other, fir)).toBe(true);
    const grid = new Grid(2, 1);
    autoPlace(plain, [grid]);
    autoPlace(fir, [grid]);
    expect(grid.items()).toHaveLength(2);
  });

  it("separar a pilha mantém a marca", () => {
    const stack = factory.create("ammo_9mm", 10);
    stack.fir = true;
    expect(splitStack(stack, 4, factory).fir).toBe(true);
    expect(splitStack(factory.create("ammo_9mm", 10), 4, factory).fir).toBe(
      undefined,
    );
  });

  it("aparece no tooltip", () => {
    const item = factory.create("barter_bolts");
    expect(describeItem(item)).not.toContain("Encontrado na raid ✓");
    item.fir = true;
    expect(describeItem(item)).toContain("Encontrado na raid ✓");
  });
});
