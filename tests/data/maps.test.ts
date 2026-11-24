import { describe, expect, it } from "vitest";

import { catalog } from "../../src/data/items.ts";
import { ENEMIES, MAPS, mapById } from "../../src/data/maps.ts";

describe("mapas", () => {
  it("ids únicos e busca por id", () => {
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(MAPS.length);
    expect(mapById("harbor")?.name).toBe("Porto Velho");
    expect(mapById("nada")).toBeNull();
  });

  it.each(MAPS.map((m) => [m.id, m] as const))(
    "%s: loot do catálogo, extração livre e requisitos válidos",
    (_, map) => {
      expect(map.duration).toBeGreaterThan(0);
      expect(map.difficulty).toBeGreaterThanOrEqual(1);
      for (const entry of map.loot) {
        expect(catalog.has(entry.item)).toBe(true);
        expect(entry.weight).toBeGreaterThan(0);
      }
      expect(map.extracts.some((e) => !e.requirement)).toBe(true);
      for (const e of map.extracts) {
        const req = e.requirement;
        if (req && req.kind !== "noBackpack") {
          expect(catalog.has(req.item)).toBe(true);
        }
      }
    },
  );

  it("inimigos: PMC é mais perigoso que Scav", () => {
    expect(ENEMIES.pmc.accuracy).toBeGreaterThan(ENEMIES.scav.accuracy);
    expect(ENEMIES.pmc.health).toBeGreaterThan(ENEMIES.scav.health);
    expect(ENEMIES.scav.kind).toBe("scav");
    expect(ENEMIES.pmc.kind).toBe("pmc");
  });
});
