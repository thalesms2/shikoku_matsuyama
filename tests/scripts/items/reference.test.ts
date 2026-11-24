import { describe, expect, it } from "vitest";

import { toReference } from "../../../scripts/items/reference.ts";
import { API_ITEMS, apiItem } from "./fixtures.ts";

const byId = (id: string) => API_ITEMS.find((i) => i.id === id)!;

describe("toReference", () => {
  it("normaliza os campos básicos", () => {
    const ref = toReference(byId("src-junk"));
    expect(ref).toEqual({
      sourceId: "src-junk",
      sourceName: "Sucata de teste",
      sourceShortName: "SRC-JUNK",
      sourceCategory: "barter-item",
      types: ["barter"],
      width: 1,
      height: 1,
      basePrice: 100,
      maxStack: null,
      caliber: null,
      capacity: null,
      damage: null,
      penetration: null,
      armorClass: null,
      durability: null,
      grids: [],
      imageUrl: "https://assets.example/src-junk-grid-image.webp",
    });
  });

  it("armas usam o tamanho do preset padrão", () => {
    const ref = toReference(byId("src-rifle"));
    expect([ref.width, ref.height]).toEqual([4, 2]);
    expect(ref.caliber).toBe("Caliber545x39");
    // sem defaultWidth/Height, fica o tamanho do item
    const pistol = toReference(byId("src-pistol"));
    expect([pistol.width, pistol.height]).toEqual([2, 1]);
  });

  it("munição traz pilha, dano e penetração", () => {
    expect(toReference(byId("src-ammo"))).toMatchObject({
      maxStack: 60,
      damage: 50,
      penetration: 30,
    });
  });

  it("carregadores trazem a capacidade e armaduras a classe", () => {
    expect(toReference(byId("src-mag")).capacity).toBe(30);
    expect(toReference(byId("src-armor"))).toMatchObject({
      armorClass: 4,
      durability: 60,
    });
  });

  it("capacidade de contêiner (com grade) é ignorada", () => {
    const ref = toReference(
      apiItem({
        id: "bag",
        properties: {
          propertiesType: "ItemPropertiesBackpack",
          capacity: 20,
          grids: [{ width: 4, height: 5 }],
        },
      }),
    );
    expect(ref.capacity).toBeNull();
    expect(ref.grids).toEqual([{ width: 4, height: 5 }]);
  });

  it("grades inválidas são descartadas", () => {
    expect(toReference(byId("src-bag")).grids).toEqual([
      { width: 4, height: 4 },
    ]);
    expect(toReference(byId("src-rig")).grids).toHaveLength(2);
  });

  it("sem categoria, sem imagem e campos vazios viram null", () => {
    const ref = toReference(
      apiItem({
        id: "x",
        category: null,
        gridImageLink: "",
        properties: { __typename: "X", caliber: "", damage: Number.NaN },
      }),
    );
    expect(ref.sourceCategory).toBeNull();
    expect(ref.imageUrl).toBeNull();
    expect(ref.caliber).toBeNull();
    expect(ref.damage).toBeNull();
  });

  it("copia a lista de tipos", () => {
    const item = byId("src-junk");
    const ref = toReference(item);
    ref.types.push("x");
    expect(item.types).toEqual(["barter"]);
  });
});
