import { describe, expect, it } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { Rng } from "../../../src/core/rng.ts";
import { setup } from "./fixtures.ts";

describe("Grid", () => {
  describe("construção", () => {
    it("começa vazia", () => {
      const grid = new Grid(4, 3);
      expect(grid.width).toBe(4);
      expect(grid.height).toBe(3);
      expect(grid.isEmpty).toBe(true);
      expect(grid.items()).toEqual([]);
      expect(grid.freeCells()).toBe(12);
      expect(grid.owner).toBeNull();
      expect(grid.filter).toEqual({});
    });

    it.each([
      [0, 1],
      [1, 0],
      [1.5, 2],
      [2, 2.5],
    ])("rejeita tamanho %sx%s", (w, h) => {
      expect(() => new Grid(w, h)).toThrow(RangeError);
    });
  });

  describe("place / remove", () => {
    it("ocupa as células do item e registra a posição", () => {
      const { make } = setup();
      const grid = new Grid(4, 4);
      const tall = make("tall");
      grid.place(tall, 1, 0);
      expect(tall.location).toEqual({
        kind: "grid",
        grid,
        x: 1,
        y: 0,
        rotated: false,
      });
      expect(grid.itemAt(1, 0)).toBe(tall);
      expect(grid.itemAt(1, 2)).toBe(tall);
      expect(grid.itemAt(1, 3)).toBeNull();
      expect(grid.itemAt(0, 0)).toBeNull();
      expect(grid.has(tall)).toBe(true);
      expect(grid.isEmpty).toBe(false);
      expect(grid.freeCells()).toBe(13);
    });

    it("rotação troca a área ocupada", () => {
      const { make } = setup();
      const grid = new Grid(4, 4);
      const tall = make("tall");
      grid.place(tall, 0, 3, true);
      expect(grid.itemAt(2, 3)).toBe(tall);
      expect(grid.itemAt(0, 2)).toBeNull();
    });

    it("itemAt fora da grade é null", () => {
      const grid = new Grid(2, 2);
      expect(grid.itemAt(-1, 0)).toBeNull();
      expect(grid.itemAt(2, 0)).toBeNull();
      expect(grid.itemAt(0, 5)).toBeNull();
    });

    it("não coloca fora dos limites nem sobre outro item", () => {
      const { make } = setup();
      const grid = new Grid(3, 3);
      const square = make("square");
      grid.place(square, 0, 0);
      expect(grid.canPlace(make("small"), 1, 1)).toBe(false);
      expect(grid.canPlace(make("wide"), 2, 0)).toBe(false);
      expect(grid.canPlace(make("small"), -1, 0)).toBe(false);
      expect(grid.canPlace(make("tall"), 2, 1)).toBe(false);
      expect(grid.canPlace(make("tall"), 2, 0)).toBe(true);
      expect(() => grid.place(make("small"), 1, 1)).toThrow("não cabe");
    });

    it("exige que o item esteja solto", () => {
      const { make } = setup();
      const a = new Grid(3, 3);
      const b = new Grid(3, 3);
      const item = make("small");
      a.place(item, 0, 0);
      expect(() => b.place(item, 0, 0)).toThrow("removido antes");
    });

    it("remove libera as células e solta o item", () => {
      const { make } = setup();
      const grid = new Grid(3, 3);
      const square = make("square");
      grid.place(square, 1, 1);
      expect(grid.remove(square)).toBe(true);
      expect(square.location).toBeNull();
      expect(grid.itemAt(1, 1)).toBeNull();
      expect(grid.isEmpty).toBe(true);
      expect(grid.freeCells()).toBe(9);
    });

    it("remove ignora itens que não estão nesta grade", () => {
      const { make } = setup();
      const a = new Grid(2, 2);
      const b = new Grid(2, 2);
      const item = make("small");
      expect(a.remove(item)).toBe(false);
      b.place(item, 0, 0);
      expect(a.remove(item)).toBe(false);
      expect(item.location).not.toBeNull();
      const equipment = new Equipment();
      const helmet = make("helmet");
      equipment.equip("helmet", helmet);
      expect(a.remove(helmet)).toBe(false);
    });

    it("canPlace ignora o espaço do próprio item quando ele já está na grade", () => {
      const { make } = setup();
      const grid = new Grid(3, 1);
      const wide = make("wide");
      grid.place(wide, 0, 0);
      expect(grid.canPlace(wide, 1, 0)).toBe(true);
      expect(grid.canPlace(make("wide"), 1, 0)).toBe(false);
    });

    it("isAreaFree considera o item ignorado como livre", () => {
      const { make } = setup();
      const grid = new Grid(2, 2);
      const item = make("small");
      grid.place(item, 0, 0);
      expect(grid.isAreaFree(0, 0, 2, 2)).toBe(false);
      expect(grid.isAreaFree(0, 0, 2, 2, item)).toBe(true);
      expect(grid.isAreaFree(1, 1, 2, 1)).toBe(false);
    });
  });

  describe("filtros", () => {
    it("allow aceita só as categorias listadas", () => {
      const { make } = setup();
      const grid = new Grid(2, 2, { allow: ["ammo"] });
      expect(grid.accepts(make("ammo"))).toBe(true);
      expect(grid.accepts(make("small"))).toBe(false);
      expect(grid.canPlace(make("small"), 0, 0)).toBe(false);
    });

    it("deny recusa as categorias listadas", () => {
      const { make } = setup();
      const grid = new Grid(3, 3, { deny: ["backpack"] });
      expect(grid.accepts(make("bag"))).toBe(false);
      expect(grid.accepts(make("small"))).toBe(true);
    });
  });

  describe("contêineres aninhados", () => {
    it("um contêiner não entra nele mesmo", () => {
      const { make } = setup();
      const bag = make("bag");
      expect(bag.grids[0].accepts(bag)).toBe(false);
    });

    it("um contêiner não entra em outro que está dentro dele", () => {
      const { make } = setup();
      const pouch = make("pouch");
      const bag = make("bag");
      // bag dentro do pouch é recusado pelo filtro; usamos dois rigs/bags
      const outer = make("bag");
      outer.grids[0].place(make("rig"), 0, 0);
      const rig = outer.grids[0].items()[0];
      expect(rig.grids[0].accepts(outer)).toBe(false);
      expect(rig.grids[1].accepts(bag)).toBe(true);
      expect(pouch.grids[0].accepts(bag)).toBe(true);
    });

    it("a checagem para quando o dono está equipado", () => {
      const { make } = setup();
      const equipment = new Equipment();
      const bag = make("bag");
      equipment.equip("backpack", bag);
      expect(bag.grids[0].accepts(make("small"))).toBe(true);
    });
  });

  describe("findFreeSpot", () => {
    it("acha a primeira posição livre linha a linha", () => {
      const { make } = setup();
      const grid = new Grid(3, 2);
      grid.place(make("small"), 0, 0);
      expect(grid.findFreeSpot(make("small"))).toEqual({
        x: 1,
        y: 0,
        rotated: false,
      });
      expect(grid.findFreeSpot(make("wide"))).toEqual({
        x: 1,
        y: 0,
        rotated: false,
      });
    });

    it("tenta rotacionado quando não cabe em pé", () => {
      const { make } = setup();
      const grid = new Grid(3, 1);
      expect(grid.findFreeSpot(make("tall"))).toEqual({
        x: 0,
        y: 0,
        rotated: true,
      });
    });

    it("devolve null quando não há espaço ou a grade não aceita", () => {
      const { make } = setup();
      const grid = new Grid(1, 1);
      expect(grid.findFreeSpot(make("square"))).toBeNull();
      expect(
        new Grid(2, 2, { allow: ["ammo"] }).findFreeSpot(make("small")),
      ).toBeNull();
    });
  });

  it("propriedade: nenhuma célula é ocupada duas vezes e tudo fica dentro dos limites", () => {
    const { make } = setup();
    const rng = new Rng(7);
    const ids = ["small", "wide", "tall", "square", "rifle", "helmet"];
    const grid = new Grid(8, 6);
    for (let i = 0; i < 300; i++) {
      const items = grid.items();
      if (items.length > 0 && rng.chance(0.3)) {
        grid.remove(rng.pick(items));
        continue;
      }
      const item = make(rng.pick(ids));
      const x = rng.int(-1, 8);
      const y = rng.int(-1, 6);
      const rotated = rng.chance(0.5);
      if (grid.canPlace(item, x, y, rotated)) grid.place(item, x, y, rotated);
    }
    let occupied = 0;
    for (const item of grid.items()) {
      const loc = item.location!;
      if (loc.kind !== "grid") throw new Error("local inesperado");
      const w = loc.rotated ? item.def.height : item.def.width;
      const h = loc.rotated ? item.def.width : item.def.height;
      expect(loc.x).toBeGreaterThanOrEqual(0);
      expect(loc.y).toBeGreaterThanOrEqual(0);
      expect(loc.x + w).toBeLessThanOrEqual(8);
      expect(loc.y + h).toBeLessThanOrEqual(6);
      occupied += w * h;
      for (let cy = loc.y; cy < loc.y + h; cy++) {
        for (let cx = loc.x; cx < loc.x + w; cx++) {
          expect(grid.itemAt(cx, cy)).toBe(item);
        }
      }
    }
    expect(grid.freeCells()).toBe(48 - occupied);
  });
});
