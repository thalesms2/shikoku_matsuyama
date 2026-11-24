import { describe, expect, it } from "vitest";

import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import {
  rollLoot,
  stashLoot,
  valuePerCell,
} from "../../../src/core/raid/loot.ts";
import { Rng } from "../../../src/core/rng.ts";
import { catalog } from "../../../src/data/items.ts";
import { ScriptRng } from "./raidFixtures.ts";

const factory = () => new ItemFactory(catalog);

describe("rollLoot", () => {
  it("sorteia pelo peso e a quantidade entre min e max", () => {
    const rng = new ScriptRng();
    rng.ints = [7];
    const item = rollLoot(
      [
        { item: "barter_bolts", weight: 0 },
        { item: "ammo_9mm", weight: 1, min: 5, max: 20 },
      ],
      rng,
      factory(),
    );
    expect(item.def.id).toBe("ammo_9mm");
    expect(item.count).toBe(7);
  });

  it("sem min/max vem 1; max nunca passa da pilha máxima", () => {
    const f = factory();
    const rng = new Rng(3);
    expect(rollLoot([{ item: "barter_bolts", weight: 1 }], rng, f).count).toBe(
      1,
    );
    for (let i = 0; i < 20; i++) {
      const ammo = rollLoot(
        [{ item: "ammo_12g", weight: 1, min: 15, max: 999 }],
        rng,
        f,
      );
      expect(ammo.count).toBeGreaterThanOrEqual(15);
      expect(ammo.count).toBeLessThanOrEqual(20);
    }
  });

  it("min maior que a pilha máxima vira a pilha máxima", () => {
    const item = rollLoot(
      [{ item: "barter_bolts", weight: 1, min: 5, max: 9 }],
      new Rng(1),
      factory(),
    );
    expect(item.count).toBe(1);
  });
});

describe("valuePerCell", () => {
  it("valor total dividido pelas células", () => {
    const f = factory();
    expect(valuePerCell(f.create("barter_gpu"))).toBe(60000);
    expect(valuePerCell(f.create("money_rub", 100))).toBe(100);
  });
});

describe("stashLoot", () => {
  it("guarda direto quando cabe", () => {
    const f = factory();
    const grid = new Grid(2, 2);
    const found = new Set<Item>();
    const result = stashLoot(
      f.create("barter_bolts"),
      [grid],
      found,
      "valuePerCell",
    );
    expect(result).toEqual({ stored: 1, dropped: [] });
  });

  it("valuePerCell larga o loot mais barato por célula até caber", () => {
    const f = factory();
    const grid = new Grid(2, 1);
    const cheap = f.create("barter_bolts");
    const cheaper = f.create("money_rub", 10);
    grid.place(cheap, 0, 0, false);
    grid.place(cheaper, 1, 0, false);
    const found = new Set([cheap, cheaper]);
    const gold = f.create("barter_goldchain");
    const result = stashLoot(gold, [grid], found, "valuePerCell");
    expect(result.stored).toBe(1);
    expect(result.dropped).toEqual([cheaper]);
    expect(grid.has(gold)).toBe(true);
    expect(grid.has(cheap)).toBe(true);
    expect(found.has(cheaper)).toBe(false);
  });

  it("o que foi tirado sem necessidade volta para o lugar", () => {
    const f = factory();
    const a = new Grid(1, 1);
    const b = new Grid(2, 1);
    const tiny = f.create("money_rub", 1); // 1 por célula, em a
    const bolts = f.create("barter_bolts"); // 2500, em b
    const bolts2 = f.create("barter_bolts");
    a.place(tiny, 0, 0, false);
    b.place(bolts, 0, 0, false);
    b.place(bolts2, 1, 0, false);
    const found = new Set([tiny, bolts, bolts2]);
    // GPU 2x1 só cabe em b: larga tiny (não ajuda), bolts e bolts2
    const gpu = f.create("barter_gpu");
    const result = stashLoot(gpu, [a, b], found, "valuePerCell");
    expect(result.stored).toBe(1);
    expect(b.has(gpu)).toBe(true);
    expect(a.has(tiny)).toBe(true);
    expect(found.has(tiny)).toBe(true);
    expect(result.dropped).toEqual([bolts, bolts2]);
  });

  it("se nem largando cabe, tudo volta como estava", () => {
    const f = factory();
    const grid = new Grid(1, 1);
    const bolts = f.create("barter_bolts");
    grid.place(bolts, 0, 0, false);
    const found = new Set([bolts]);
    const gpu = f.create("barter_gpu");
    const result = stashLoot(gpu, [grid], found, "valuePerCell");
    expect(result).toEqual({ stored: 0, dropped: [] });
    expect(grid.has(bolts)).toBe(true);
    expect(bolts.location).toMatchObject({ x: 0, y: 0 });
  });

  it("não larga equipamento que não é loot nem loot mais valioso", () => {
    const f = factory();
    const grid = new Grid(1, 1);
    const own = f.create("barter_gpu");
    const gridWide = new Grid(2, 1);
    gridWide.place(own, 0, 0, false);
    const found = new Set<Item>();
    expect(
      stashLoot(f.create("barter_goldchain"), [gridWide], found, "valuePerCell")
        .stored,
    ).toBe(0);
    const rich = f.create("barter_goldchain");
    grid.place(rich, 0, 0, false);
    found.add(rich);
    expect(
      stashLoot(f.create("barter_bolts"), [grid], found, "valuePerCell").stored,
    ).toBe(0);
    expect(grid.has(rich)).toBe(true);
  });

  it("keepFirst nunca larga nada; pilhas parciais contam o que entrou", () => {
    const f = factory();
    const grid = new Grid(1, 1);
    const ammo = f.create("ammo_9mm", 45);
    grid.place(ammo, 0, 0, false);
    const found = new Set([ammo]);
    const more = f.create("ammo_9mm", 10);
    const result = stashLoot(more, [grid], found, "keepFirst");
    expect(result).toEqual({ stored: 5, dropped: [] });
    expect(more.count).toBe(5);
  });
});
