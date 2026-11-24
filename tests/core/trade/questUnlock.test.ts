import { describe, expect, it } from "vitest";

import { buy, questUnlocked } from "../../../src/core/trade/trade.ts";
import { TEST_TRADER, trader } from "./tradeFixtures.ts";

const LOCKED = {
  ...TEST_TRADER,
  offers: [
    { id: "q", item: "barter_bolts", level: 1, stock: 1, quest: "cleanup" },
  ],
};

describe("ofertas liberadas por quest", () => {
  it("só depois da quest concluída", () => {
    const { player, put } = trader();
    put("money_rub", 10_000);
    const offer = LOCKED.offers[0];
    expect(questUnlocked(player, offer)).toBe(false);
    expect(buy(player, LOCKED, "q", 0)).toEqual({
      ok: false,
      reason: "Exige uma quest",
    });
    player.quests.cleanup = { status: "active", progress: [] };
    expect(questUnlocked(player, offer)).toBe(false);
    player.quests.cleanup.status = "completed";
    expect(questUnlocked(player, offer)).toBe(true);
    expect(buy(player, LOCKED, "q", 0).ok).toBe(true);
    expect(questUnlocked(player, TEST_TRADER.offers[0])).toBe(true);
  });
});
