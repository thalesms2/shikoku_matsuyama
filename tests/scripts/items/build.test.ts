import { describe, expect, it } from "vitest";

import {
  buildCatalog,
  buildItemDef,
  defaultGridFilter,
  defaultSlot,
  mapCategory,
  referenceStats,
} from "../../../scripts/items/build.ts";
import {
  emptyOverride,
  setAsset,
  upsertOverride,
  upsertReferences,
} from "../../../scripts/items/db.ts";
import type { ItemOverride } from "../../../scripts/items/db.ts";
import { toReference } from "../../../scripts/items/reference.ts";
import type { ReferenceItem } from "../../../scripts/items/reference.ts";
import { API_ITEMS, apiItem, memoryDb } from "./fixtures.ts";

const ref = (id: string): ReferenceItem =>
  toReference(API_ITEMS.find((i) => i.id === id)!);

const named = (
  gameId: string,
  patch: Partial<ItemOverride> = {},
): ItemOverride => ({
  ...emptyOverride(gameId),
  name: `Nome ${gameId}`,
  shortName: gameId,
  ...patch,
});

describe("mapCategory", () => {
  it.each([
    ["src-rifle", "weapon"],
    ["src-pistol", "weapon"],
    ["src-ammo", "ammo"],
    ["src-helmet", "helmet"],
    ["src-rig", "rig"],
    ["src-armor", "armor"],
    ["src-bag", "backpack"],
    ["src-box", "container"],
    ["src-med", "medical"],
    ["src-food", "food"],
    ["src-key", "key"],
    ["src-junk", "barter"],
    ["src-money", "money"],
    ["src-mag", "magazine"],
  ])("%s -> %s", (id, category) => {
    expect(mapCategory(ref(id))).toBe(category);
  });
});

describe("defaultSlot", () => {
  it("pistolas vão no coldre e outras armas no slot de arma longa", () => {
    expect(defaultSlot("weapon", ref("src-pistol"))).toBe("pistol");
    expect(defaultSlot("weapon", ref("src-rifle"))).toBe("longWeapon");
    expect(defaultSlot("weapon", null)).toBe("longWeapon");
  });

  it("equipamentos vestíveis usam o slot da própria categoria", () => {
    for (const c of ["helmet", "armor", "rig", "backpack"] as const) {
      expect(defaultSlot(c, null)).toBe(c);
    }
    expect(defaultSlot("ammo", null)).toBeUndefined();
  });
});

describe("defaultGridFilter", () => {
  it("mochilas recusam mochilas e coletes recusam equipamentos grandes", () => {
    expect(defaultGridFilter("backpack")).toEqual({ deny: ["backpack"] });
    expect(defaultGridFilter("rig")).toEqual({
      deny: ["backpack", "rig", "armor"],
    });
    expect(defaultGridFilter("container")).toEqual({});
  });
});

describe("referenceStats", () => {
  it("copia só os dados técnicos presentes", () => {
    expect(referenceStats(ref("src-ammo"))).toEqual({
      caliber: "Caliber545x39",
      damage: 50,
      penetration: 30,
    });
    expect(referenceStats(ref("src-rig"))).toEqual({
      armorClass: 3,
      durability: 40,
    });
    expect(referenceStats(ref("src-mag"))).toEqual({ capacity: 30 });
  });

  it("devolve null sem referência ou sem dados técnicos", () => {
    expect(referenceStats(null)).toBeNull();
    expect(referenceStats(ref("src-junk"))).toBeNull();
  });
});

describe("buildItemDef", () => {
  it("usa a referência para o que o override não define", () => {
    const def = buildItemDef(
      named("ak", { sourceId: "src-rifle" }),
      ref("src-rifle"),
      null,
    );
    expect(def).toEqual({
      id: "ak",
      name: "Nome ak",
      shortName: "ak",
      category: "weapon",
      width: 4,
      height: 2,
      basePrice: 30000,
      equipSlot: "longWeapon",
      stats: { caliber: "Caliber545x39" },
    });
  });

  it("o override tem prioridade sobre a referência", () => {
    const def = buildItemDef(
      named("ammo", {
        sourceId: "src-ammo",
        category: "barter",
        width: 2,
        height: 2,
        maxStack: 10,
        basePrice: 1,
        equipSlot: "secure",
        description: "Texto próprio",
        grids: [{ width: 1, height: 1 }],
      }),
      ref("src-ammo"),
      null,
    );
    expect(def).toMatchObject({
      category: "barter",
      width: 2,
      height: 2,
      maxStack: 10,
      basePrice: 1,
      equipSlot: "secure",
      description: "Texto próprio",
      grids: [{ width: 1, height: 1 }],
    });
  });

  it("pilha da referência, grades com filtro padrão e imagem do asset", () => {
    expect(buildItemDef(named("a"), ref("src-ammo"), null).maxStack).toBe(60);
    const bag = buildItemDef(named("bag"), ref("src-bag"), {
      gameId: "bag",
      path: "assets/items/bag.webp",
      source: "tarkov.dev",
      sourceUrl: null,
      license: "x",
      status: "placeholder",
      updatedAt: "now",
    });
    expect(bag.grids).toEqual([{ width: 4, height: 4, deny: ["backpack"] }]);
    expect(bag.image).toBe("assets/items/bag.webp");
    expect(bag).not.toHaveProperty("description");
  });

  it("stats do override são mesclados por cima dos da referência", () => {
    const def = buildItemDef(
      named("ammo", { stats: { damage: 99, capacity: 1 } }),
      ref("src-ammo"),
      null,
    );
    expect(def.stats).toEqual({
      caliber: "Caliber545x39",
      damage: 99,
      penetration: 30,
      capacity: 1,
    });
    const local = buildItemDef(
      named("m", {
        category: "magazine",
        width: 1,
        height: 2,
        stats: { caliber: "C", capacity: 30 },
      }),
      null,
      null,
    );
    expect(local.stats).toEqual({ caliber: "C", capacity: 30 });
  });

  it("itens sem referência são definidos só pelo override", () => {
    const def = buildItemDef(
      named("x", { category: "food", width: 1, height: 2 }),
      null,
      null,
    );
    expect(def).toEqual({
      id: "x",
      name: "Nome x",
      shortName: "x",
      category: "food",
      width: 1,
      height: 2,
      basePrice: 0,
    });
  });

  it.each([
    ["name", { name: null, category: "food" as const, width: 1, height: 1 }],
    [
      "shortName",
      { shortName: null, category: "food" as const, width: 1, height: 1 },
    ],
    ["category", {}],
    ["width", { category: "food" as const }],
    ["height", { category: "food" as const, width: 1 }],
  ])("exige %s quando não há referência", (field, patch) => {
    expect(() => buildItemDef(named("x", patch), null, null)).toThrow(
      `x: falta "${field}"`,
    );
  });

  it("exige categoria quando a referência não tem uma conhecida", () => {
    const scope = toReference(
      apiItem({
        id: "scope",
        types: ["mods"],
        category: { normalizedName: "scope" },
      }),
    );
    expect(mapCategory(scope)).toBeNull();
    expect(() => buildItemDef(named("m"), scope, null)).toThrow(
      'falta "category"',
    );
  });

  it("falha se o sourceId não está na base", () => {
    expect(() =>
      buildItemDef(named("x", { sourceId: "sumiu" }), null, null),
    ).toThrow('item sumiu não está na base (rode "items sync")');
  });
});

describe("buildCatalog", () => {
  it("monta só os itens habilitados, com referência e imagem", () => {
    const db = memoryDb();
    upsertReferences(db, API_ITEMS.map(toReference), "now");
    upsertOverride(db, "rifle", {
      name: "Fuzil",
      shortName: "F",
      sourceId: "src-rifle",
    });
    upsertOverride(db, "can", {
      name: "Lata",
      shortName: "L",
      category: "food",
      width: 1,
      height: 1,
    });
    upsertOverride(db, "off", { name: "Off", shortName: "O", enabled: false });
    setAsset(db, {
      gameId: "rifle",
      path: "assets/items/rifle.webp",
      source: "tarkov.dev",
      sourceUrl: null,
      license: "x",
      status: "placeholder",
      updatedAt: "now",
    });
    const defs = buildCatalog(db);
    expect(defs.map((d) => d.id)).toEqual(["can", "rifle"]);
    expect(defs[1]).toMatchObject({
      width: 4,
      image: "assets/items/rifle.webp",
    });
  });

  it("valida as definições com o Catalog do jogo", () => {
    const db = memoryDb();
    upsertOverride(db, "bad", {
      name: "Ruim",
      shortName: "R",
      category: "food",
      width: 1,
      height: 1,
      grids: [{ width: 0, height: 1 }],
    });
    expect(() => buildCatalog(db)).toThrow("Grade inválida em bad");
  });
});
