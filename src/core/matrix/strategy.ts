import { coreBalance } from "../balance.ts";
import type { RaidProfile } from "../raid/types.ts";

/** Estratégias da raid em matriz */
export const MATRIX_STRATEGY_IDS = [
  "rat",
  "safe",
  "neutral",
  "aggressive",
  "psycho",
] as const;
export type MatrixStrategyId = (typeof MATRIX_STRATEGY_IDS)[number];

export const MATRIX_STRATEGY_NAMES: Record<MatrixStrategyId, string> = {
  rat: "Rato",
  safe: "Seguro",
  neutral: "Neutro",
  aggressive: "Agressivo",
  psycho: "Psicopata",
};

/** Multiplicador dos turnos por célula da estratégia (balanceamento) */
export function moveFactor(strategy: MatrixStrategyId): number {
  return coreBalance().matrix[`${strategy}Move`];
}

/** Estratégia padrão de um mapa ainda sem escolha */
export const DEFAULT_MATRIX_STRATEGY: MatrixStrategyId = "neutral";

export function isMatrixStrategy(value: unknown): value is MatrixStrategyId {
  return MATRIX_STRATEGY_IDS.includes(value as MatrixStrategyId);
}

/** Estratégia guardada para o mapa (ou a padrão) */
export function mapStrategy(
  profile: RaidProfile,
  mapId: string,
): MatrixStrategyId {
  const saved = profile.mapStrategies?.[mapId];
  return isMatrixStrategy(saved) ? saved : DEFAULT_MATRIX_STRATEGY;
}

/** Guarda a estratégia escolhida para o mapa */
export function setMapStrategy(
  profile: RaidProfile,
  mapId: string,
  strategy: MatrixStrategyId,
): void {
  profile.mapStrategies = { ...profile.mapStrategies, [mapId]: strategy };
}
