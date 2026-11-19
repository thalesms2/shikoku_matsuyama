import { describe, expect, it } from "vitest";

import { Grid } from "../../../src/core/inventory/grid.ts";
import {
  Catalog,
  ItemFactory,
  totalValue,
} from "../../../src/core/inventory/item.ts";
import type { ItemDef } from "../../../src/core/inventory/item.ts";
import { footprint, maxStack } from "../../../src/core/inventory/size.ts";
import { TEST_DEFS, setup } from "./fixtures.ts";

const base: ItemDef = {
  id: "x",
  name: "X",
  shortName: "X",
  category: "barter",
  width: 1,
  height: 1,
  basePrice: 1,
};

describe("size", () => {
  it("maxStack é 1 por padrão", () => {
    expect(maxStack(base)).toBe(1);
    expect(maxStack({ ...base, maxStack: 30 })).toBe(30);
  });

  it("footprint troca largura e altura quando rotacionado", () => {
    const def = { ...base, width: 3, height: 1 };
    expect(footprint(def, false)).toEqual({ w: 3, h: 1 });
    expect(footprint(def, true)).toEqual({ w: 1, h: 3 });
  });
});

describe("Catalog", () => {
  it("indexa definições por id", () => {
    const catalog = new Catalog(TEST_DEFS);
    expect(catalog.get("small").name).toBe("Pequeno");
    expect(catalog.has("small")).toBe(true);
    expect(catalog.has("nada")).toBe(false);
    expect(catalog.all()).toHaveLength(TEST_DEFS.length);
  });

  it("falha com id desconhecido", () => {
    expect(() => new Catalog([]).get("nada")).toThrow("Item desconhecido");
  });

  it("rejeita ids duplicados", () => {
    expect(() => new Catalog([base, base])).toThrow("duplicado");
  });

  it.each([
    ["largura zero", { ...base, width: 0 }, "Tamanho"],
    ["altura fracionária", { ...base, height: 1.5 }, "Tamanho"],
    ["maxStack zero", { ...base, maxStack: 0 }, "maxStack"],
    ["grade inválida", { ...base, grids: [{ width: 2, height: 0 }] }, "Grade"],
  ])("rejeita definição inválida (%s)", (_label, def, message) => {
    expect(() => new Catalog([def])).toThrow(message);
  });
});

describe("ItemFactory", () => {
  it("cria itens soltos com uids sequenciais", () => {
    const { factory } = setup();
    const a = factory.create("small");
    const b = factory.create("ammo", 10);
    expect(a.uid).toBe("i1");
    expect(b.uid).toBe("i2");
    expect(a.count).toBe(1);
    expect(b.count).toBe(10);
    expect(a.location).toBeNull();
    expect(a.grids).toEqual([]);
    expect(factory.nextId).toBe(3);
  });

  it("pode continuar a partir de um id salvo", () => {
    const { factory } = setup(42);
    expect(factory.create("small").uid).toBe("i42");
  });

  it("cria as grades internas de contêineres, com o item como dono", () => {
    const { factory } = setup();
    const rig = factory.create("rig");
    expect(rig.grids).toHaveLength(2);
    expect(rig.grids[0]).toBeInstanceOf(Grid);
    expect(rig.grids[1].width).toBe(1);
    expect(rig.grids[1].height).toBe(2);
    expect(rig.grids.every((g) => g.owner === rig)).toBe(true);
  });

  it("passa os filtros da definição para a grade", () => {
    const { factory } = setup();
    expect(factory.create("box").grids[0].filter.allow).toEqual(["ammo"]);
  });

  it.each([0, -1, 1.5, 31])("rejeita quantidade %s", (count) => {
    const { factory } = setup();
    expect(() => factory.create("ammo", count)).toThrow(RangeError);
  });

  it("não empilha itens com maxStack 1", () => {
    const { factory } = setup();
    expect(() => factory.create("small", 2)).toThrow(RangeError);
  });

  it("propaga erro de id desconhecido", () => {
    expect(() => new ItemFactory(new Catalog([])).create("x")).toThrow(
      "desconhecido",
    );
  });
});

describe("totalValue", () => {
  it("soma a pilha e o conteúdo dos contêineres, recursivamente", () => {
    const { make } = setup();
    const bag = make("bag");
    const box = make("box");
    bag.grids[0].place(box, 0, 0);
    box.grids[0].place(make("ammo", 10), 0, 0);
    bag.grids[0].place(make("small"), 1, 0);
    // bag 70 + box 5 + 10 munições x 2 + small 10
    expect(totalValue(bag)).toBe(105);
    expect(totalValue(make("ammo", 3))).toBe(6);
  });
});
