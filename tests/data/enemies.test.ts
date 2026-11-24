import { describe, expect, it } from "vitest";

import {
  hasInternalMagazine,
  sameCaliber,
} from "../../src/core/inventory/magazine.ts";
import { maxStack } from "../../src/core/inventory/size.ts";
import { catalog } from "../../src/data/items.ts";
import { ENEMIES } from "../../src/data/maps.ts";
import { TRADERS } from "../../src/data/traders.ts";

describe("equipamento dos inimigos", () => {
  for (const enemy of Object.values(ENEMIES)) {
    describe(enemy.name, () => {
      const gear = enemy.gear!;

      it("tem equipamento de verdade com pesos positivos", () => {
        expect(gear).toBeDefined();
        for (const list of [gear.weapons, gear.armor, gear.helmet]) {
          expect(list.length).toBeGreaterThan(0);
          for (const option of list) expect(option.weight).toBeGreaterThan(0);
        }
      });

      it("arma, carregador e munição existem e são do mesmo calibre", () => {
        for (const w of gear.weapons) {
          const weapon = catalog.get(w.weapon);
          const ammo = catalog.get(w.ammo);
          expect(weapon.category).toBe("weapon");
          expect(ammo.category).toBe("ammo");
          expect(sameCaliber(weapon, ammo)).toBe(true);
          const tube = hasInternalMagazine({ def: weapon } as never);
          if (tube) expect(w.magazine).toBeUndefined();
          else {
            const mag = catalog.get(w.magazine!);
            expect(mag.category).toBe("magazine");
            expect(sameCaliber(weapon, mag)).toBe(true);
          }
          const [min, max] = w.ammoCount;
          expect(min).toBeGreaterThanOrEqual(0);
          expect(max).toBeGreaterThanOrEqual(min);
          expect(max).toBeLessThanOrEqual(maxStack(ammo));
        }
      });

      it("coletes e capacetes são itens da categoria certa", () => {
        for (const { item } of gear.armor) {
          if (item) expect(catalog.get(item).category).toBe("armor");
        }
        for (const { item } of gear.helmet) {
          if (item) expect(catalog.get(item).category).toBe("helmet");
        }
      });
    });
  }

  it("o PMC inimigo usa o colete classe 4, o capacete K-3 e a munição perfurante", () => {
    const gear = ENEMIES.pmc.gear!;
    expect(gear.armor.map((a) => a.item)).toContain("armor_heavy");
    expect(gear.helmet.map((a) => a.item)).toContain("helmet_k3");
    expect(gear.weapons.map((w) => w.ammo)).toContain("ammo_545ap");
    expect(catalog.get("armor_heavy").stats).toEqual({
      armorClass: 4,
      durability: 60,
    });
    expect(catalog.get("ammo_545ap").stats?.penetration).toBe(38);
  });

  it("o Mercador Tito vende o K-3 (nível 2) e o colete de placas (nível 3)", () => {
    const tito = TRADERS.find((t) => t.id === "merchant")!;
    const level = (item: string) =>
      tito.offers.find((o) => o.item === item)?.level;
    expect(level("helmet_k3")).toBe(2);
    expect(level("armor_heavy")).toBe(3);
  });
});
