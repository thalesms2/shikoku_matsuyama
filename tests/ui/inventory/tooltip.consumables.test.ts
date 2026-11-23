// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { Catalog, ItemFactory } from "../../../src/core/inventory/item.ts";
import { itemSheet } from "../../../src/ui/inventory/Tooltip.ts";

describe("itemSheet: consumíveis", () => {
  it("mostra cura e efeitos com sinal", () => {
    const factory = new ItemFactory(
      new Catalog([
        {
          id: "c",
          name: "C",
          shortName: "c",
          category: "food",
          width: 1,
          height: 1,
          basePrice: 1,
          stats: { heal: 10, energy: 40, hydration: -5 },
        },
      ]),
    );
    expect(itemSheet(factory.create("c"))).toEqual([
      "Cura: 10 PV",
      "Energia: +40",
      "Hidratação: -5",
    ]);
  });
});
