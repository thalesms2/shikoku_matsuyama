import { describe, expect, it } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import {
  autoPlace,
  canStack,
  detach,
  dropOnItem,
  mergeStack,
  moveToGrid,
  moveToSlot,
  sortGrid,
  splitStack,
} from "../../../src/core/inventory/operations.ts";
import { setup } from "./fixtures.ts";

function gridLoc(item: Item) {
  const loc = item.location;
  if (loc?.kind !== "grid") throw new Error("item fora de grade");
  return loc;
}

describe("detach", () => {
  it("tira o item de uma grade", () => {
    const { make } = setup();
    const grid = new Grid(2, 2);
    const item = make("small");
    grid.place(item, 0, 0);
    detach(item);
    expect(item.location).toBeNull();
    expect(grid.isEmpty).toBe(true);
  });

  it("tira o item de um slot", () => {
    const { make } = setup();
    const equipment = new Equipment();
    const helmet = make("helmet");
    equipment.equip("helmet", helmet);
    detach(helmet);
    expect(helmet.location).toBeNull();
    expect(equipment.get("helmet")).toBeNull();
  });

  it("não faz nada com item solto", () => {
    const { make } = setup();
    const item = make("small");
    detach(item);
    expect(item.location).toBeNull();
  });
});

describe("moveToGrid", () => {
  it("move dentro da mesma grade, inclusive sobrepondo o próprio espaço", () => {
    const { make } = setup();
    const grid = new Grid(3, 1);
    const wide = make("wide");
    grid.place(wide, 0, 0);
    expect(moveToGrid(wide, grid, 1, 0)).toBe(true);
    expect(gridLoc(wide).x).toBe(1);
    expect(grid.itemAt(0, 0)).toBeNull();
    expect(grid.itemAt(2, 0)).toBe(wide);
  });

  it("move entre grades e de um slot para uma grade", () => {
    const { make } = setup();
    const a = new Grid(3, 3);
    const b = new Grid(3, 3);
    const item = make("square");
    a.place(item, 0, 0);
    expect(moveToGrid(item, b, 1, 1)).toBe(true);
    expect(a.isEmpty).toBe(true);
    expect(gridLoc(item).grid).toBe(b);

    const equipment = new Equipment();
    const helmet = make("helmet");
    equipment.equip("helmet", helmet);
    expect(moveToGrid(helmet, a, 0, 0)).toBe(true);
    expect(equipment.get("helmet")).toBeNull();
  });

  it("gira o item", () => {
    const { make } = setup();
    const grid = new Grid(3, 3);
    const tall = make("tall");
    grid.place(tall, 0, 0);
    expect(moveToGrid(tall, grid, 0, 0, true)).toBe(true);
    expect(gridLoc(tall).rotated).toBe(true);
    expect(grid.itemAt(2, 0)).toBe(tall);
  });

  it("não move quando não cabe, deixando o item onde estava", () => {
    const { make } = setup();
    const grid = new Grid(2, 2);
    const item = make("small");
    grid.place(item, 0, 0);
    expect(moveToGrid(item, new Grid(1, 1, { allow: ["ammo"] }), 0, 0)).toBe(
      false,
    );
    expect(gridLoc(item).grid).toBe(grid);
  });

  it("não deixa um contêiner entrar nele mesmo", () => {
    const { make } = setup();
    const stash = new Grid(5, 5);
    const bag = make("bag");
    stash.place(bag, 0, 0);
    expect(moveToGrid(bag, bag.grids[0], 0, 0)).toBe(false);
    expect(gridLoc(bag).grid).toBe(stash);
  });
});

describe("moveToSlot", () => {
  it("equipa um item que estava em uma grade", () => {
    const { make } = setup();
    const grid = new Grid(4, 4);
    const equipment = new Equipment();
    const rifle = make("rifle");
    grid.place(rifle, 0, 0);
    expect(moveToSlot(rifle, equipment, "primary")).toBe(true);
    expect(grid.isEmpty).toBe(true);
    expect(equipment.get("primary")).toBe(rifle);
  });

  it("troca um item de slot", () => {
    const { make } = setup();
    const equipment = new Equipment();
    const rifle = make("rifle");
    equipment.equip("primary", rifle);
    expect(moveToSlot(rifle, equipment, "secondary")).toBe(true);
    expect(equipment.get("primary")).toBeNull();
    expect(equipment.get("secondary")).toBe(rifle);
  });

  it("não equipa em slot incompatível", () => {
    const { make } = setup();
    const grid = new Grid(2, 2);
    const item = make("small");
    grid.place(item, 0, 0);
    expect(moveToSlot(item, new Equipment(), "helmet")).toBe(false);
    expect(gridLoc(item).grid).toBe(grid);
  });
});

describe("pilhas", () => {
  it("canStack exige mesmo tipo, empilhável, itens diferentes e espaço na pilha", () => {
    const { make } = setup();
    const a = make("ammo", 10);
    expect(canStack(make("ammo", 5), a)).toBe(true);
    expect(canStack(a, a)).toBe(false);
    expect(canStack(make("small"), make("small"))).toBe(false);
    expect(canStack(make("box"), a)).toBe(false);
    expect(canStack(make("ammo"), make("ammo", 30))).toBe(false);
  });

  it("mergeStack move o que couber e devolve a quantidade movida", () => {
    const { make } = setup();
    const target = make("ammo", 25);
    const source = make("ammo", 10);
    const grid = new Grid(2, 1);
    grid.place(source, 0, 0);
    expect(mergeStack(source, target)).toBe(5);
    expect(target.count).toBe(30);
    expect(source.count).toBe(5);
    expect(grid.has(source)).toBe(true);
  });

  it("mergeStack remove a origem quando ela esvazia", () => {
    const { make } = setup();
    const target = make("ammo", 10);
    const source = make("ammo", 10);
    const grid = new Grid(2, 1);
    grid.place(source, 0, 0);
    expect(mergeStack(source, target)).toBe(10);
    expect(target.count).toBe(20);
    expect(source.count).toBe(0);
    expect(source.location).toBeNull();
    expect(grid.isEmpty).toBe(true);
  });

  it("mergeStack não faz nada com itens incompatíveis", () => {
    const { make } = setup();
    expect(mergeStack(make("small"), make("small"))).toBe(0);
  });

  it("splitStack separa uma parte em um novo item solto", () => {
    const { factory, make } = setup();
    const stack = make("ammo", 20);
    const part = splitStack(stack, 8, factory);
    expect(stack.count).toBe(12);
    expect(part.count).toBe(8);
    expect(part.def).toBe(stack.def);
    expect(part.uid).not.toBe(stack.uid);
    expect(part.location).toBeNull();
  });

  it.each([0, 20, 25, 1.5])("splitStack rejeita quantidade %s", (amount) => {
    const { factory, make } = setup();
    expect(() => splitStack(make("ammo", 20), amount, factory)).toThrow(
      RangeError,
    );
  });
});

describe("autoPlace", () => {
  it("guarda na primeira grade com espaço", () => {
    const { make } = setup();
    const full = new Grid(1, 1);
    full.place(make("small"), 0, 0);
    const free = new Grid(2, 2);
    const item = make("wide");
    expect(autoPlace(item, [full, free])).toBe(true);
    expect(gridLoc(item).grid).toBe(free);
  });

  it("completa pilhas antes de ocupar espaço novo", () => {
    const { make } = setup();
    const a = new Grid(1, 1);
    const b = new Grid(2, 1);
    const stackA = make("ammo", 28);
    const stackB = make("ammo", 25);
    a.place(stackA, 0, 0);
    b.place(stackB, 0, 0);
    const loose = make("ammo", 10);
    expect(autoPlace(loose, [a, b])).toBe(true);
    expect(stackA.count).toBe(30);
    expect(stackB.count).toBe(30);
    expect(loose.count).toBe(3);
    expect(gridLoc(loose).grid).toBe(b);
  });

  it("devolve true quando as pilhas absorvem tudo", () => {
    const { make } = setup();
    const grid = new Grid(1, 1);
    const stack = make("ammo", 5);
    grid.place(stack, 0, 0);
    const loose = make("ammo", 5);
    expect(autoPlace(loose, [grid])).toBe(true);
    expect(stack.count).toBe(10);
    expect(loose.count).toBe(0);
  });

  it("devolve false se não couber, mantendo o resto no item", () => {
    const { make } = setup();
    const grid = new Grid(1, 1);
    const stack = make("ammo", 25);
    grid.place(stack, 0, 0);
    const loose = make("ammo", 10);
    expect(autoPlace(loose, [grid])).toBe(false);
    expect(stack.count).toBe(30);
    expect(loose.count).toBe(5);
    expect(loose.location).toBeNull();
    expect(autoPlace(make("square"), [])).toBe(false);
  });
});

describe("dropOnItem", () => {
  it("soma pilhas iguais", () => {
    const { make } = setup();
    const target = make("ammo", 10);
    const source = make("ammo", 5);
    expect(dropOnItem(source, target)).toBe(true);
    expect(target.count).toBe(15);
  });

  it("guarda dentro de contêineres", () => {
    const { make } = setup();
    const bag = make("bag");
    const item = make("small");
    expect(dropOnItem(item, bag)).toBe(true);
    expect(gridLoc(item).grid).toBe(bag.grids[0]);
  });

  it("recusa quando não é pilha nem contêiner, ou é o próprio item", () => {
    const { make } = setup();
    expect(dropOnItem(make("small"), make("square"))).toBe(false);
    const bag = make("bag");
    expect(dropOnItem(bag, bag)).toBe(false);
    expect(dropOnItem(make("small"), make("box"))).toBe(false);
  });
});

describe("sortGrid", () => {
  it("organiza maiores primeiro, agrupando por categoria e nome", () => {
    const { make } = setup();
    const grid = new Grid(4, 3);
    const small = make("small");
    const ammoFew = make("ammo", 3);
    const ammoMany = make("ammo", 20);
    const square = make("square");
    const wide = make("wide");
    grid.place(small, 0, 0);
    grid.place(ammoFew, 1, 0);
    grid.place(ammoMany, 3, 0);
    grid.place(wide, 0, 2);
    grid.place(square, 2, 1);
    expect(sortGrid(grid)).toBe(true);
    const at = (item: Item) => [gridLoc(item).x, gridLoc(item).y];
    expect(at(square)).toEqual([0, 0]);
    expect(at(wide)).toEqual([2, 0]);
    // munição (ammo) vem antes de barter; pilha maior primeiro
    expect(at(ammoMany)).toEqual([2, 1]);
    expect(at(ammoFew)).toEqual([3, 1]);
    expect(at(small)).toEqual([0, 2]);
    expect(grid.items()).toHaveLength(5);
  });

  it("itens idênticos são todos recolocados", () => {
    const { make } = setup();
    const grid = new Grid(1, 2);
    const a = make("small");
    const b = make("small");
    grid.place(a, 0, 1);
    grid.place(b, 0, 0);
    expect(sortGrid(grid)).toBe(true);
    expect(grid.items()).toHaveLength(2);
    expect(grid.freeCells()).toBe(0);
  });

  it("volta ao layout original quando a nova organização não cabe", () => {
    const { make } = setup();
    const grid = new Grid(5, 4);
    const layout: [string, number, number, boolean][] = [
      ["wide", 3, 2, false],
      ["square", 0, 0, false],
      ["wide", 3, 3, false],
      ["tall", 2, 1, true],
      ["tall", 2, 0, true],
      ["square", 1, 2, true],
      ["wide", 0, 2, true],
    ];
    const items = layout.map(([id, x, y, r]) => {
      const item = make(id);
      grid.place(item, x, y, r);
      return { item, x, y, r };
    });
    expect(sortGrid(grid)).toBe(false);
    for (const { item, x, y, r } of items) {
      expect(gridLoc(item)).toMatchObject({ grid, x, y, rotated: r });
    }
    expect(grid.items()).toHaveLength(7);
  });

  it("aceita grade vazia", () => {
    expect(sortGrid(new Grid(2, 2))).toBe(true);
  });
});
