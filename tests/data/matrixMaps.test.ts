import { describe, expect, it } from "vitest";

import { validateMatrix } from "../../src/core/matrix/matrix.ts";
import { CONTAINER_KINDS } from "../../src/core/matrix/types.ts";
import { CONTAINERS } from "../../src/data/containers.ts";
import { catalog } from "../../src/data/items.ts";
import { MAPS } from "../../src/data/maps.ts";
import {
  MATRIX_MAPS,
  MATRIX_MAP_DEFS,
  matrixMapById,
} from "../../src/data/matrixMaps.ts";

describe("contêineres", () => {
  it("os 17 tipos, com tabelas de itens que existem", () => {
    expect(Object.keys(CONTAINERS).sort()).toEqual([...CONTAINER_KINDS].sort());
    for (const def of Object.values(CONTAINERS)) {
      expect(def.rarity).toBeGreaterThanOrEqual(1);
      expect(def.rarity).toBeLessThanOrEqual(5);
      expect(def.searchTurns).toBeGreaterThanOrEqual(2);
      expect(def.searchTurns).toBeLessThanOrEqual(5);
      for (const chance of [def.findChance, def.rareChance]) {
        expect(chance).toBeGreaterThan(0);
        expect(chance).toBeLessThan(1);
      }
      expect(def.loot.length, def.kind).toBeGreaterThan(0);
      for (const entry of [...def.loot, ...def.rare]) {
        expect(catalog.has(entry.item), `${def.kind}: ${entry.item}`).toBe(
          true,
        );
      }
    }
  });

  it("gabinete de PC não tem munição; caixa de munição só tem munição", () => {
    const categories = (kind: keyof typeof CONTAINERS) =>
      [...CONTAINERS[kind].loot, ...CONTAINERS[kind].rare].map(
        (e) => catalog.get(e.item).category,
      );
    expect(categories("pcBlock")).not.toContain("ammo");
    expect(new Set(categories("ammoBox"))).toEqual(new Set(["ammo"]));
  });

  it("o cofre é o mais raro e a jaqueta, o mais comum", () => {
    expect(CONTAINERS.safe.rarity).toBe(5);
    expect(CONTAINERS.jacket.rarity).toBe(1);
  });
});

describe("mapas em matriz", () => {
  it("um para cada mapa da raid, todos válidos, com pontos de interesse óbvios", () => {
    expect(MATRIX_MAPS.map((m) => m.id)).toEqual(MAPS.map((m) => m.id));
    for (const map of MATRIX_MAPS) {
      expect(validateMatrix(map), map.id).toEqual([]);
      expect(
        map.pois.some((p) => p.obvious),
        map.id,
      ).toBe(true);
      const def = MATRIX_MAP_DEFS.find((d) => d.id === map.id)!;
      expect(map.difficulty).toBe(def.difficulty);
    }
  });

  it("todo tipo de contêiner aparece em algum mapa", () => {
    const used = new Set(
      MATRIX_MAPS.flatMap((m) =>
        m.cells.flat().flatMap((c) => c.container ?? []),
      ),
    );
    for (const kind of CONTAINER_KINDS) expect(used.has(kind), kind).toBe(true);
  });

  it("busca pelo id", () => {
    expect(matrixMapById("harbor")?.name).toBe("Porto Velho");
    expect(matrixMapById("nada")).toBeNull();
  });
});
