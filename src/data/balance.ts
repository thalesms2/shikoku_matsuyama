import {
  CORE_DEFAULTS,
  coreBalance,
  readCoreBalance,
  setCoreBalance,
} from "../core/balance.ts";
import type { CoreBalance } from "../core/balance.ts";
import type { FleaConfig } from "../core/flea/types.ts";
import { BALANCE_STAT_KEYS } from "../core/inventory/item.ts";
import type { Catalog, ItemOverride } from "../core/inventory/item.ts";
import { FLEA } from "./flea.ts";
import { catalog as gameCatalog } from "./items.ts";

/** Campos numéricos do mercado que o balanceamento pode mudar */
export const FLEA_BALANCE_KEYS = [
  "minPmcLevel",
  "slots",
  "trendMs",
  "trendAmplitude",
  "buyMarkup",
  "pressurePerStack",
  "pressureHalfLifeMs",
  "pressureLimit",
  "feeRate",
  "checkMs",
  "saleChance",
  "maxRatio",
  "listingMs",
] as const;

export type FleaBalanceKey = (typeof FLEA_BALANCE_KEYS)[number];

/** Valores do mercado que precisam ser maiores que zero (divisões e laços) */
const FLEA_POSITIVE: readonly FleaBalanceKey[] = [
  "trendMs",
  "pressureHalfLifeMs",
  "checkMs",
  "listingMs",
];

/** Todos os valores de balanceamento do jogo, como a janela de admin edita */
export interface BalanceDocument {
  core: CoreBalance;
  /** Ajustes por id de item (preço e dados técnicos) */
  items: Record<string, ItemOverride>;
  flea: Record<FleaBalanceKey, number>;
}

/** Valores do mercado como vieram dos dados */
const FLEA_DEFAULTS: Record<FleaBalanceKey, number> = Object.fromEntries(
  FLEA_BALANCE_KEYS.map((key) => [key, FLEA[key]]),
) as Record<FleaBalanceKey, number>;

/** Balanceamento padrão: o dos dados, sem ajustes */
export const DEFAULT_BALANCE: BalanceDocument = {
  core: CORE_DEFAULTS,
  items: {},
  flea: FLEA_DEFAULTS,
};

let items: Record<string, ItemOverride> = {};

/** Valores em uso agora */
export function currentBalance(): BalanceDocument {
  return structuredClone({
    core: coreBalance(),
    items,
    flea: Object.fromEntries(
      FLEA_BALANCE_KEYS.map((key) => [key, FLEA[key]]),
    ) as Record<FleaBalanceKey, number>,
  });
}

/**
 * Passa a usar os valores: o core, os ajustes dos itens (no catálogo, então
 * os itens já criados mudam na hora) e o mercado (no próprio `FLEA`).
 */
export function applyBalance(
  doc: BalanceDocument,
  catalog: Catalog = gameCatalog,
): void {
  setCoreBalance(doc.core);
  items = structuredClone(doc.items);
  catalog.applyOverrides(items);
  Object.assign(FLEA as FleaConfig, doc.flea);
}

/** Volta ao balanceamento padrão */
export function resetBalance(catalog: Catalog = gameCatalog): void {
  applyBalance(DEFAULT_BALANCE, catalog);
}

const valid = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * Lê um balanceamento vindo de fora (servidor, JSON). Números precisam ser
 * finitos e ≥ 0 (os tempos do mercado, > 0; `maxRatio`, > 1); ajustes de
 * itens que não existem no catálogo são descartados. O que faltar ou for
 * inválido fica com o padrão.
 */
export function readBalance(
  raw: unknown,
  catalog: Catalog = gameCatalog,
): BalanceDocument {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as {
    core?: unknown;
    items?: unknown;
    flea?: unknown;
  };
  const flea = { ...FLEA_DEFAULTS };
  const givenFlea = (
    typeof input.flea === "object" && input.flea !== null ? input.flea : {}
  ) as Record<string, unknown>;
  for (const key of FLEA_BALANCE_KEYS) {
    const value = givenFlea[key];
    if (!valid(value)) continue;
    if (FLEA_POSITIVE.includes(key) && value === 0) continue;
    if (key === "maxRatio" && value <= 1) continue;
    flea[key] = value;
  }
  const result: Record<string, ItemOverride> = {};
  const givenItems = (
    typeof input.items === "object" && input.items !== null ? input.items : {}
  ) as Record<string, unknown>;
  for (const [id, raw] of Object.entries(givenItems)) {
    if (!catalog.has(id) || typeof raw !== "object" || raw === null) continue;
    const given = raw as { basePrice?: unknown; stats?: unknown };
    const override: ItemOverride = {};
    if (valid(given.basePrice)) override.basePrice = given.basePrice;
    if (typeof given.stats === "object" && given.stats !== null) {
      const stats: ItemOverride["stats"] = {};
      for (const key of BALANCE_STAT_KEYS) {
        const value = (given.stats as Record<string, unknown>)[key];
        if (valid(value)) stats[key] = value;
      }
      if (Object.keys(stats).length > 0) override.stats = stats;
    }
    if (Object.keys(override).length > 0) result[id] = override;
  }
  return { core: readCoreBalance(input.core), items: result, flea };
}
