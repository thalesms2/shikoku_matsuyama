import { describe, expect, it } from "vitest";

import { SKILL_INFO } from "../../src/core/pmc/skills.ts";
import { ITEM_DEFS, catalog } from "../../src/data/items.ts";
import { TRADERS } from "../../src/data/traders.ts";

const of = (category: string) =>
  ITEM_DEFS.filter((d) => d.category === category);

describe("catálogo ampliado", () => {
  it("tem itens de todas as categorias que a raid nova vai sortear", () => {
    expect(ITEM_DEFS.length).toBeGreaterThanOrEqual(80);
    for (const category of [
      "weapon",
      "ammo",
      "magazine",
      "armor",
      "helmet",
      "rig",
      "backpack",
      "medical",
      "food",
      "barter",
      "key",
    ]) {
      expect(of(category).length, category).toBeGreaterThanOrEqual(2);
    }
  });

  it("toda arma tem dado de dano e um tipo que é skill de combate", () => {
    for (const weapon of of("weapon")) {
      expect(weapon.stats?.damageDie, weapon.id).toBeGreaterThan(0);
      const skill = weapon.stats?.weaponClass as keyof typeof SKILL_INFO;
      expect(SKILL_INFO[skill]?.category, weapon.id).toBe("combat");
    }
  });

  it("todo calibre de arma tem munição e um jeito de carregar", () => {
    for (const weapon of of("weapon")) {
      const caliber = weapon.stats!.caliber;
      const ammo = of("ammo").filter((a) => a.stats?.caliber === caliber);
      expect(ammo.length, weapon.id).toBeGreaterThan(0);
      for (const a of ammo) {
        expect(a.stats?.damageBonus, a.id).toBeGreaterThanOrEqual(0);
      }
      const internal = (weapon.stats!.capacity ?? 0) > 0;
      const mags = of("magazine").filter((m) => m.stats?.caliber === caliber);
      expect(internal || mags.length > 0, weapon.id).toBe(true);
    }
  });

  it("coletes dizem se são leves ou pesados; mochilas chamativas têm visibilidade", () => {
    for (const vest of of("armor")) {
      expect(["light", "heavy"], vest.id).toContain(vest.stats?.vestType);
    }
    expect(catalog.get("backpack_school").stats?.visibility).toBeGreaterThan(0);
    expect(
      catalog.get("backpack_expedition").stats?.visibility,
    ).toBeGreaterThan(0);
    expect(catalog.get("backpack_assault").stats?.visibility).toBeUndefined();
  });

  it("há itens de inteligência para o Centro de inteligência", () => {
    for (const id of ["intel_flash", "intel_folder", "intel_military"]) {
      expect(catalog.has(id)).toBe(true);
    }
  });

  it("os vendedores vendem parte dos itens novos", () => {
    const sold = new Set(TRADERS.flatMap((t) => t.offers.map((o) => o.item)));
    for (const id of [
      "smg_vr9",
      "med_tourniquet",
      "armor_patrol",
      "barter_tape",
    ]) {
      expect(sold.has(id), id).toBe(true);
    }
  });
});
