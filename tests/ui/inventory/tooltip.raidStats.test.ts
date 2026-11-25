// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { catalog } from "../../../src/data/items.ts";
import { formatCaliber, itemSheet } from "../../../src/ui/inventory/Tooltip.ts";

const make = (id: string) => new ItemFactory(catalog).create(id);

describe("tooltip: dados da raid nova", () => {
  it("arma: tipo e dado de dano", () => {
    const lines = itemSheet(make("rifle_kr47"));
    expect(lines).toContain("Tipo: Fuzis de assalto");
    expect(lines).toContain("Dado de dano: d20");
  });

  it("munição: bônus de dano (com sinal)", () => {
    expect(itemSheet(make("ammo_762x54ap"))).toContain("Bônus de dano: +8");
    expect(itemSheet(make("ammo_9mm"))).toContain("Bônus de dano: 0");
  });

  it("colete leve ou pesado; mochila que chama atenção", () => {
    expect(itemSheet(make("armor_patrol"))).toContain("Colete leve");
    expect(itemSheet(make("armor_assault"))).toContain("Colete pesado");
    expect(itemSheet(make("backpack_school"))).toContain("Chama atenção: +2");
    expect(itemSheet(make("backpack_assault")).join()).not.toContain(
      "Chama atenção",
    );
  });

  it("tipo desconhecido não aparece; .357 tem nome legível", () => {
    const item = make("rifle_kr47");
    const def = { ...item.def, stats: { ...item.def.stats, weaponClass: "x" } };
    expect(itemSheet({ ...item, def }).join()).not.toContain("Tipo:");
    expect(formatCaliber("Caliber357Magnum")).toBe(".357 Magnum");
  });
});
