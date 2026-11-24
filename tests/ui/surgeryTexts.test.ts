// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ItemFactory } from "../../src/core/inventory/item.ts";
import { HIDEOUT_MODULES } from "../../src/data/hideout.ts";
import { catalog } from "../../src/data/items.ts";
import { traderById } from "../../src/data/traders.ts";
import { itemSheet } from "../../src/ui/inventory/Tooltip.ts";
import { describeEffects } from "../../src/ui/scenes/HideoutScene.ts";
import { eventColor } from "../../src/ui/scenes/RaidScene.ts";

describe("kit cirúrgico e enfermaria: dados e textos", () => {
  it("o kit existe, opera na raid e a Doutora Iara vende", () => {
    const kit = new ItemFactory(catalog).create("med_surgery");
    expect(kit.def.stats?.surgery).toBeGreaterThan(0);
    expect(itemSheet(kit)).toContain(
      `Cirurgia na raid: ${kit.def.stats!.surgery} min`,
    );
    expect(
      traderById("doctor")!.offers.some((o) => o.item === "med_surgery"),
    ).toBe(true);
  });

  it("a enfermaria nível 2 opera e a tela descreve", () => {
    const med = HIDEOUT_MODULES.find((m) => m.id === "medstation")!;
    expect(med.levels[1].effects.surgeryMinutes).toBe(30);
    expect(describeEffects({ surgeryMinutes: 30 }, catalog)).toBe(
      "opera 1 parte destruída a cada 30 min",
    );
  });

  it("cirurgia aparece em verde no log", () => {
    expect(eventColor("surgery")).toBe(eventColor("heal"));
  });
});
