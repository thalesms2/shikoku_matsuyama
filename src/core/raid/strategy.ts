import type { StrategyId } from "./types.ts";

export interface Strategy {
  readonly id: StrategyId;
  readonly name: string;
  readonly description: string;
  /** Multiplica o peso dos encontros com inimigos */
  readonly encounter: number;
  /** Multiplica o peso dos eventos de loot */
  readonly loot: number;
  /** Chance de evitar um combate depois de avistar o inimigo */
  readonly avoid: number;
  /** Soma na chance de atirar primeiro */
  readonly initiative: number;
  /** Chance de revistar o corpo depois de uma vitória */
  readonly searchBody: number;
  /** Multiplica a duração de cada passo da raid */
  readonly pace: number;
  /** Fração do tempo da raid em que o PMC começa a ir para a extração */
  readonly extractAt: readonly [number, number];
}

export const STRATEGIES: Readonly<Record<StrategyId, Strategy>> = {
  stealth: {
    id: "stealth",
    name: "Furtivo",
    description: "Evita brigas e anda devagar. Menos loot, menos risco.",
    encounter: 0.6,
    loot: 0.75,
    avoid: 0.5,
    initiative: 0.15,
    searchBody: 0.4,
    pace: 1.25,
    extractAt: [0.5, 0.72],
  },
  balanced: {
    id: "balanced",
    name: "Equilibrado",
    description: "Briga quando precisa e revista o que encontra.",
    encounter: 1,
    loot: 1,
    avoid: 0.2,
    initiative: 0,
    searchBody: 0.6,
    pace: 1,
    extractAt: [0.45, 0.72],
  },
  aggressive: {
    id: "aggressive",
    name: "Agressivo",
    description: "Caça inimigos e revista tudo. Mais loot, muito mais risco.",
    encounter: 1.6,
    loot: 1.4,
    avoid: 0,
    initiative: 0.05,
    searchBody: 0.85,
    pace: 0.85,
    extractAt: [0.45, 0.75],
  },
};

/** Variação do karma por comportamento na raid do PMC */
export const KARMA = {
  /** Matar um Scav */
  killScav: -0.25,
  /** Matar um PMC inimigo (hostil por definição) */
  killPmc: 0.1,
  /** Evitar um combate */
  avoid: 0.1,
  /** Extrair */
  extract: 0.05,
  min: -10,
  max: 10,
} as const;

/** Soma ao karma, limitado entre `KARMA.min` e `KARMA.max` */
export function clampKarma(value: number): number {
  return Math.min(KARMA.max, Math.max(KARMA.min, value));
}
