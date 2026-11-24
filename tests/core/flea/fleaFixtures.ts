import type { FleaConfig } from "../../../src/core/flea/types.ts";
import { xpForLevel } from "../../../src/core/pmc/pmc.ts";
import { trader } from "../trade/tradeFixtures.ts";

export const MIN = 60_000;
export const HOUR = 60 * MIN;

/** Mercado de teste: preço sem tendência (igual ao basePrice) */
export const TEST_FLEA: FleaConfig = {
  minPmcLevel: 2,
  slots: 2,
  currency: "money_rub",
  firCategories: ["barter"],
  banned: ["key_garage"],
  trendMs: HOUR,
  trendAmplitude: 0,
  buyMarkup: 1.1,
  pressurePerStack: 0.1,
  pressureHalfLifeMs: HOUR,
  pressureLimit: 0.3,
  feeRate: 0.05,
  checkMs: MIN,
  saleChance: 0.5,
  maxRatio: 2,
  listingMs: 10 * MIN,
};

/** Jogador com o mercado liberado (nível 2), estoque vazio e seed fixa */
export function market(width = 10, height = 10, now = 0) {
  const t = trader(width, height, now);
  t.player.pmc.xp = xpForLevel(2);
  t.player.flea.seed = 42;
  t.player.flea.lastCheck = now;
  return t;
}
