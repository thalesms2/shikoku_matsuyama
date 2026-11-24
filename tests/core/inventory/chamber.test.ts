import { describe, expect, it } from "vitest";

import { Grid } from "../../../src/core/inventory/grid.ts";
import { totalValue } from "../../../src/core/inventory/item.ts";
import {
  attachMagazine,
  canAttachMagazine,
  canLoad,
  chamberRound,
  feedOf,
  fireRound,
  hasInternalMagazine,
  isFeed,
  loadRounds,
  loadedRounds,
  unloadChamber,
  weaponRounds,
} from "../../../src/core/inventory/magazine.ts";
import { chamberSetup } from "./chamberFixtures.ts";

describe("armas com tubo interno", () => {
  it("a escopeta guarda os cartuchos nela mesma, sem carregador", () => {
    const { make } = chamberSetup();
    const shotgun = make("shotgun");
    const rifle = make("rifle");
    const mag = make("mag");
    expect(shotgun.rounds).toEqual([]);
    expect("magazine" in shotgun).toBe(false);
    expect(hasInternalMagazine(shotgun)).toBe(true);
    expect(hasInternalMagazine(rifle)).toBe(false);
    expect(hasInternalMagazine(mag)).toBe(false);
    expect(isFeed(shotgun)).toBe(true);
    expect(isFeed(mag)).toBe(true);
    expect(isFeed(rifle)).toBe(false);
    expect(feedOf(shotgun)).toBe(shotgun);
    expect(feedOf(rifle)).toBeNull();
    attachMagazine(rifle, mag);
    expect(feedOf(rifle)).toBe(mag);
  });

  it("carrega munição do calibre até a capacidade e recusa carregador", () => {
    const { make } = chamberSetup();
    const shotgun = make("shotgun");
    const buck = make("buck", 10);
    expect(canLoad(shotgun, make("fmj", 5))).toBe(false);
    expect(loadRounds(shotgun, buck)).toBe(4);
    expect(buck.count).toBe(6);
    expect(canLoad(shotgun, buck)).toBe(false);
    expect(canAttachMagazine(shotgun, make("mag12"))).toBe(false);
    expect(attachMagazine(shotgun, make("mag12"))).toBe(false);
  });
});

describe("câmara", () => {
  it("chamberRound puxa o topo do carregador ou do tubo para a câmara vazia", () => {
    const { make } = chamberSetup();
    const rifle = make("rifle");
    expect(chamberRound(make("mag"))).toBe(false);
    expect(chamberRound(rifle)).toBe(false);
    const mag = make("mag");
    attachMagazine(rifle, mag);
    expect(chamberRound(rifle)).toBe(false);
    loadRounds(mag, make("fmj", 2));
    loadRounds(mag, make("ap", 1));
    expect(chamberRound(rifle)).toBe(true);
    expect(rifle.chamber?.id).toBe("ap");
    expect(loadedRounds(mag)).toBe(2);
    expect(weaponRounds(rifle)).toBe(3);
    // Já carregada: não puxa outro
    expect(chamberRound(rifle)).toBe(false);
    expect(loadedRounds(mag)).toBe(2);
  });

  it("fireRound dispara a câmara e sobe o próximo; vazia devolve null", () => {
    const { make } = chamberSetup();
    const shotgun = make("shotgun");
    expect(fireRound(shotgun)).toBeNull();
    loadRounds(shotgun, make("buck", 1));
    loadRounds(shotgun, make("slug", 1));
    // Câmara vazia: carrega antes de disparar
    expect(fireRound(shotgun)?.id).toBe("slug");
    expect(shotgun.chamber?.id).toBe("buck");
    expect(loadedRounds(shotgun)).toBe(0);
    expect(weaponRounds(shotgun)).toBe(1);
    expect(fireRound(shotgun)?.id).toBe("buck");
    expect(shotgun.chamber).toBeUndefined();
    expect(weaponRounds(shotgun)).toBe(0);
  });

  it("weaponRounds conta a câmara mesmo sem carregador", () => {
    const { make, factory } = chamberSetup();
    const rifle = make("rifle");
    rifle.chamber = factory.catalog.get("fmj");
    expect(weaponRounds(rifle)).toBe(1);
  });

  it("unloadChamber guarda o cartucho; sem espaço ou vazia não muda nada", () => {
    const { make, factory } = chamberSetup();
    const shotgun = make("shotgun");
    const grid = new Grid(1, 1);
    expect(unloadChamber(shotgun, factory, [grid])).toBe(false);
    shotgun.chamber = factory.catalog.get("buck");
    grid.place(make("rock"), 0, 0);
    expect(unloadChamber(shotgun, factory, [grid])).toBe(false);
    expect(shotgun.chamber?.id).toBe("buck");
    const free = new Grid(1, 1);
    expect(unloadChamber(shotgun, factory, [free])).toBe(true);
    expect(shotgun.chamber).toBeUndefined();
    expect(free.items()[0].def.id).toBe("buck");
  });

  it("o valor da arma inclui o tubo e a câmara", () => {
    const { make, factory } = chamberSetup();
    const shotgun = make("shotgun");
    loadRounds(shotgun, make("buck", 2));
    shotgun.chamber = factory.catalog.get("slug");
    expect(totalValue(shotgun)).toBe(800 + 2 * 3 + 7);
  });
});
