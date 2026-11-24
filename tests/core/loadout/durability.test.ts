import { describe, expect, it } from "vitest";

import { applyLoadout } from "../../../src/core/loadout/loadout.ts";
import { trader } from "../trade/tradeFixtures.ts";

describe("loadout: armadura mais inteira primeiro", () => {
  it("escolhe a de maior durabilidade", () => {
    const { player, put } = trader();
    const worn = put("armor_civil");
    worn.durability = 5;
    const better = put("armor_civil");
    better.durability = 30;
    applyLoadout(player, {
      name: "L",
      slots: { armor: "armor_civil" },
      magazines: {},
      carried: [],
    });
    expect(player.inventory.equipment.get("armor")).toBe(better);
  });
});
