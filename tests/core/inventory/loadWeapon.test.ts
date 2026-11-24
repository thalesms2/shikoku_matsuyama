import { describe, expect, it } from "vitest";

import { Grid } from "../../../src/core/inventory/grid.ts";
import {
  attachMagazine,
  canLoadInto,
  canLoadWeapon,
  loadInto,
  loadWeapon,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import { chamberSetup } from "./chamberFixtures.ts";

describe("munição solta sobre a arma", () => {
  it("câmara vazia: 1 cartucho na câmara e o resto no carregador", () => {
    const { make } = chamberSetup();
    const rifle = make("rifle");
    const mag = make("mag");
    attachMagazine(rifle, mag);
    const ammo = make("fmj", 40);
    expect(canLoadWeapon(rifle, ammo)).toBe(true);
    expect(loadWeapon(rifle, ammo)).toBe(31);
    expect(rifle.chamber?.id).toBe("fmj");
    expect(loadedRounds(mag)).toBe(30);
    expect(ammo.count).toBe(9);
    // câmara e carregador cheios: recusa
    expect(canLoadWeapon(rifle, ammo)).toBe(false);
    expect(loadWeapon(rifle, ammo)).toBe(0);
  });

  it("câmara cheia: tudo vai para o carregador ou para o tubo", () => {
    const { make, factory } = chamberSetup();
    const shotgun = make("shotgun");
    shotgun.chamber = factory.catalog.get("slug");
    expect(loadWeapon(shotgun, make("buck", 10))).toBe(4);
    expect(shotgun.chamber.id).toBe("slug");
    expect(loadedRounds(shotgun)).toBe(4);
  });

  it("sem carregador, só a câmara; pilha de 1 sai de onde estava", () => {
    const { make } = chamberSetup();
    const rifle = make("rifle");
    const grid = new Grid(2, 2);
    const one = make("fmj", 1);
    grid.place(one, 0, 0);
    expect(loadWeapon(rifle, one)).toBe(1);
    expect(grid.has(one)).toBe(false);
    expect(rifle.chamber?.id).toBe("fmj");
    // câmara cheia e sem carregador: recusa
    expect(canLoadWeapon(rifle, make("fmj", 5))).toBe(false);
    const fresh = make("rifle");
    const five = make("fmj", 5);
    expect(loadWeapon(fresh, five)).toBe(1);
    expect(five.count).toBe(4);
  });

  it("recusa calibre errado, o que não é munição, pilha vazia e o que não é arma", () => {
    const { make } = chamberSetup();
    const rifle = make("rifle");
    expect(canLoadWeapon(rifle, make("nine", 5))).toBe(false);
    expect(canLoadWeapon(rifle, make("rock"))).toBe(false);
    const empty = make("fmj", 1);
    empty.count = 0;
    expect(canLoadWeapon(rifle, empty)).toBe(false);
    expect(canLoadWeapon(make("mag"), make("fmj", 5))).toBe(false);
  });

  it("canLoadInto/loadInto escolhem entre a arma e o carregador", () => {
    const { make } = chamberSetup();
    const mag = make("mag");
    const rifle = make("rifle");
    expect(canLoadInto(mag, make("fmj", 5))).toBe(true);
    expect(canLoadInto(rifle, make("fmj", 5))).toBe(true);
    expect(loadInto(mag, make("fmj", 5))).toBe(5);
    expect(loadInto(rifle, make("fmj", 5))).toBe(1);
  });
});
