import type { FleaConfig } from "../core/flea/types.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * Mercado entre jogadores (simulado). Preços em rublos; o preço de mercado
 * varia com a tendência (±20% por hora) e com a pressão das compras e vendas
 * do jogador.
 */
export const FLEA: FleaConfig = {
  minPmcLevel: 5,
  slots: 3,
  currency: "money_rub",
  // Permutas e chaves só se encontradas na raid (as quests pedem essas)
  firCategories: ["barter", "key"],
  banned: ["secure_pouch"],
  trendMs: HOUR,
  trendAmplitude: 0.2,
  buyMarkup: 1.1,
  pressurePerStack: 0.08,
  pressureHalfLifeMs: 2 * HOUR,
  pressureLimit: 0.4,
  feeRate: 0.04,
  checkMs: MIN,
  // Pelo preço de mercado, vende em ~20 min em média
  saleChance: 0.05,
  maxRatio: 2,
  listingMs: 12 * HOUR,
};
