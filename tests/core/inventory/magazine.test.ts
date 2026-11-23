import { describe, expect, it } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { totalValue } from "../../../src/core/inventory/item.ts";
import {
  attachMagazine,
  canAttachMagazine,
  canLoad,
  capacity,
  freeRounds,
  isMagazine,
  isWeapon,
  loadRounds,
  loadedRounds,
  popRound,
  removeMagazine,
  sameCaliber,
  unloadRounds,
  weaponRounds,
} from "../../../src/core/inventory/magazine.ts";
import { detach, moveToGrid } from "../../../src/core/inventory/operations.ts";
import { MAG_DEFS, magSetup } from "./magFixtures.ts";

describe("instâncias", () => {
  it("carregadores começam vazios e armas sem carregador", () => {
    const { make } = magSetup();
    const mag = make("mag");
    expect(mag.rounds).toEqual([]);
    expect(make("rifle").magazine).toBeNull();
    expect(make("rock").rounds).toBeUndefined();
    expect(make("rock").magazine).toBeUndefined();
  });

  it("identifica carregadores, armas, capacidade e calibre", () => {
    const { make } = magSetup();
    expect(isMagazine(make("mag"))).toBe(true);
    expect(isWeapon(make("rifle"))).toBe(true);
    expect(capacity(make("mag"))).toBe(30);
    expect(capacity(make("rock"))).toBe(0);
    expect(loadedRounds(make("rock"))).toBe(0);
    expect(sameCaliber(MAG_DEFS[0], MAG_DEFS[2])).toBe(true);
    expect(sameCaliber(MAG_DEFS[0], MAG_DEFS[1])).toBe(false);
    expect(sameCaliber(MAG_DEFS[7], MAG_DEFS[7])).toBe(false);
  });
});

describe("carregar", () => {
  it("carrega até a capacidade e deixa o resto na pilha", () => {
    const { make } = magSetup();
    const mag = make("mag");
    const ammo = make("fmj", 45);
    expect(loadRounds(mag, ammo)).toBe(30);
    expect(loadedRounds(mag)).toBe(30);
    expect(freeRounds(mag)).toBe(0);
    expect(ammo.count).toBe(15);
    expect(canLoad(mag, ammo)).toBe(false);
  });

  it("respeita o máximo pedido e junta com o topo do mesmo tipo", () => {
    const { make } = magSetup();
    const mag = make("mag");
    const ammo = make("fmj", 20);
    loadRounds(mag, ammo, 5);
    loadRounds(mag, ammo, 3);
    expect(mag.rounds).toEqual([{ def: ammo.def, count: 8 }]);
  });

  it("tipos diferentes ficam em sequência, na ordem carregada", () => {
    const { make } = magSetup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 10));
    loadRounds(mag, make("ap", 5));
    loadRounds(mag, make("fmj", 2));
    expect(mag.rounds!.map((r) => [r.def.id, r.count])).toEqual([
      ["fmj", 10],
      ["ap", 5],
      ["fmj", 2],
    ]);
  });

  it("a pilha vazia sai de onde estava", () => {
    const { make } = magSetup();
    const grid = new Grid(2, 2);
    const ammo = make("fmj", 10);
    grid.place(ammo, 0, 0);
    loadRounds(make("mag"), ammo);
    expect(ammo.count).toBe(0);
    expect(grid.isEmpty).toBe(true);
  });

  it("recusa calibre errado, itens que não são munição ou carregador", () => {
    const { make } = magSetup();
    const mag = make("mag");
    expect(canLoad(mag, make("nine", 10))).toBe(false);
    expect(canLoad(mag, make("rock"))).toBe(false);
    expect(canLoad(make("rock"), make("fmj"))).toBe(false);
    expect(loadRounds(mag, make("nine", 10))).toBe(0);
  });
});

describe("descarregar e disparar", () => {
  it("dispara do topo: o último cartucho carregado sai primeiro", () => {
    const { make } = magSetup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 2));
    loadRounds(mag, make("ap", 1));
    expect(popRound(mag)?.id).toBe("ap");
    expect(popRound(mag)?.id).toBe("fmj");
    expect(popRound(mag)?.id).toBe("fmj");
    expect(popRound(mag)).toBeNull();
    expect(popRound(make("rock"))).toBeNull();
  });

  it("descarrega para as grades, juntando com pilhas existentes", () => {
    const { make, factory } = magSetup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 10));
    loadRounds(mag, make("ap", 5));
    const grid = new Grid(3, 1);
    const existing = make("fmj", 50);
    grid.place(existing, 0, 0);
    expect(unloadRounds(mag, factory, [grid])).toBe(15);
    expect(loadedRounds(mag)).toBe(0);
    expect(existing.count).toBe(60);
    const ids = grid.items().map((i) => [i.def.id, i.count]);
    expect(ids).toEqual(
      expect.arrayContaining([
        ["ap", 5],
        ["fmj", 60],
      ]),
    );
  });

  it("descarrega só o máximo pedido", () => {
    const { make, factory } = magSetup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 10));
    expect(unloadRounds(mag, factory, [new Grid(2, 2)], 4)).toBe(4);
    expect(loadedRounds(mag)).toBe(6);
  });

  it("para quando não cabe mais, guardando o que coube em pilhas", () => {
    const { make, factory } = magSetup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 10));
    const grid = new Grid(1, 1);
    const stack = make("fmj", 55);
    grid.place(stack, 0, 0);
    expect(unloadRounds(mag, factory, [grid])).toBe(5);
    expect(stack.count).toBe(60);
    expect(loadedRounds(mag)).toBe(5);
    expect(unloadRounds(mag, factory, [grid])).toBe(0);
    expect(loadedRounds(mag)).toBe(5);
  });

  it("descarregar algo que não é carregador não faz nada", () => {
    const { make, factory } = magSetup();
    expect(unloadRounds(make("rock"), factory, [new Grid(2, 2)])).toBe(0);
  });
});

describe("carregador na arma", () => {
  it("encaixa carregador do mesmo calibre e tira de onde estava", () => {
    const { make } = magSetup();
    const grid = new Grid(4, 4);
    const rifle = make("rifle");
    const mag = make("mag");
    grid.place(mag, 0, 0);
    expect(canAttachMagazine(rifle, mag)).toBe(true);
    expect(attachMagazine(rifle, mag)).toBe(true);
    expect(rifle.magazine).toBe(mag);
    expect(mag.location).toEqual({ kind: "weapon", weapon: rifle });
    expect(grid.isEmpty).toBe(true);
  });

  it("recusa calibre errado, arma ocupada e itens errados", () => {
    const { make } = magSetup();
    const rifle = make("rifle");
    expect(attachMagazine(rifle, make("mag9"))).toBe(false);
    expect(canAttachMagazine(make("rock"), make("mag"))).toBe(false);
    expect(canAttachMagazine(rifle, make("fmj"))).toBe(false);
    attachMagazine(rifle, make("mag"));
    expect(canAttachMagazine(rifle, make("mag"))).toBe(false);
  });

  it("munição da arma é a do carregador encaixado", () => {
    const { make } = magSetup();
    const rifle = make("rifle");
    expect(weaponRounds(rifle)).toBe(0);
    const mag = make("mag");
    loadRounds(mag, make("fmj", 20));
    attachMagazine(rifle, mag);
    expect(weaponRounds(rifle)).toBe(20);
  });

  it("removeMagazine guarda o carregador na primeira grade com espaço", () => {
    const { make } = magSetup();
    const rifle = make("rifle");
    const mag = make("mag");
    attachMagazine(rifle, mag);
    const full = new Grid(1, 1);
    const free = new Grid(2, 2);
    expect(removeMagazine(rifle, [full, free])).toBe(mag);
    expect(rifle.magazine).toBeNull();
    expect(mag.location).toMatchObject({ kind: "grid", grid: free });
  });

  it("removeMagazine não faz nada sem carregador ou sem espaço", () => {
    const { make } = magSetup();
    const rifle = make("rifle");
    expect(removeMagazine(rifle, [new Grid(2, 2)])).toBeNull();
    const mag = make("mag");
    attachMagazine(rifle, mag);
    expect(removeMagazine(rifle, [new Grid(1, 1)])).toBeNull();
    expect(rifle.magazine).toBe(mag);
  });

  it("mover o carregador para uma grade o tira da arma", () => {
    const { make } = magSetup();
    const rifle = make("rifle");
    const mag = make("mag");
    attachMagazine(rifle, mag);
    expect(moveToGrid(mag, new Grid(2, 2), 0, 0)).toBe(true);
    expect(rifle.magazine).toBeNull();
    detach(mag);
    expect(mag.location).toBeNull();
  });

  it("armas equipadas também aceitam carregador", () => {
    const { make } = magSetup();
    const equipment = new Equipment();
    const pistol = make("pistol");
    equipment.equip("holster", pistol);
    expect(attachMagazine(pistol, make("mag9"))).toBe(true);
  });
});

describe("valor", () => {
  it("inclui os cartuchos e o carregador encaixado", () => {
    const { make } = magSetup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 10));
    loadRounds(mag, make("ap", 2));
    expect(totalValue(mag)).toBe(100 + 10 * 2 + 2 * 5);
    const rifle = make("rifle");
    attachMagazine(rifle, mag);
    expect(totalValue(rifle)).toBe(1000 + 130);
  });
});
