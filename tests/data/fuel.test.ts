import { describe, expect, it } from "vitest";

import { HIDEOUT } from "../../src/data/hideout.ts";
import { catalog } from "../../src/data/items.ts";
import { traderById } from "../../src/data/traders.ts";

describe("combustível do gerador (dados)", () => {
  it("o gerador queima galões, e o Nico vende", () => {
    expect(HIDEOUT.fuel).toEqual({ module: "generator", item: "barter_fuel" });
    expect(HIDEOUT.modules.some((m) => m.id === "generator")).toBe(true);
    expect(catalog.get("barter_fuel").name).toBe("Galão de combustível");
    expect(
      traderById("scrapper")!.offers.some((o) => o.item === "barter_fuel"),
    ).toBe(true);
  });
});
