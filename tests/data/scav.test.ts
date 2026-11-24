import { describe, expect, it } from "vitest";

import { catalog } from "../../src/data/items.ts";
import { SCAV_LOADOUT } from "../../src/data/scav.ts";

describe("equipamento do Scav", () => {
  it("armas com carregador e munição do mesmo calibre", () => {
    for (const w of SCAV_LOADOUT.weapons) {
      const weapon = catalog.get(w.weapon);
      const mag = catalog.get(w.magazine);
      const ammo = catalog.get(w.ammo);
      expect(weapon.category).toBe("weapon");
      expect(mag.category).toBe("magazine");
      expect(ammo.category).toBe("ammo");
      expect(mag.stats?.caliber).toBe(weapon.stats?.caliber);
      expect(ammo.stats?.caliber).toBe(weapon.stats?.caliber);
      expect(w.weight).toBeGreaterThan(0);
      expect(w.spareMags[0]).toBeLessThanOrEqual(w.spareMags[1]);
      expect(w.looseAmmo[0]).toBeLessThanOrEqual(w.looseAmmo[1]);
    }
  });

  it("cada peça vai no slot certo", () => {
    for (const [slot, options] of Object.entries(SCAV_LOADOUT.gear)) {
      expect(options.some((o) => o.weight > 0)).toBe(true);
      for (const o of options) {
        if (o.item) expect(catalog.get(o.item).equipSlot).toBe(slot);
      }
    }
  });

  it("itens extras existem no catálogo", () => {
    for (const e of SCAV_LOADOUT.extras) {
      expect(catalog.has(e.item)).toBe(true);
      expect(e.weight).toBeGreaterThan(0);
    }
    expect(SCAV_LOADOUT.extraRolls[0]).toBeLessThanOrEqual(
      SCAV_LOADOUT.extraRolls[1],
    );
  });
});
