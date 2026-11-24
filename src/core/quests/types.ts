import type { EnemyKind, MapDef, StrategyId } from "../raid/types.ts";
import type { TraderDef } from "../trade/types.ts";

/** Objetivo de uma quest; `count` é quantas vezes/unidades */
export type QuestObjective =
  /** Entregar itens do estoque (`fir`: só os encontrados na raid) */
  | {
      readonly kind: "deliver";
      readonly item: string;
      readonly count: number;
      readonly fir?: boolean;
    }
  /** Extrair (opcional: mapa, saída e estratégia) */
  | {
      readonly kind: "extract";
      readonly count: number;
      readonly map?: string;
      readonly extract?: string;
      readonly strategy?: StrategyId;
    }
  /** Abater inimigos (opcional: mapa) */
  | {
      readonly kind: "kill";
      readonly target: EnemyKind;
      readonly count: number;
      readonly map?: string;
    }
  /** Sair de uma raid com o item encontrado nela (opcional: mapa) */
  | {
      readonly kind: "find";
      readonly item: string;
      readonly count: number;
      readonly map?: string;
    };

export interface QuestRequirements {
  readonly pmcLevel?: number;
  /** Quests que precisam estar concluídas */
  readonly quests?: readonly string[];
  readonly loyalty?: { readonly trader: string; readonly level: number };
}

export interface QuestRewards {
  /** XP do PMC */
  readonly xp?: number;
  /** Itens e dinheiro, entregues no estoque */
  readonly items?: readonly { readonly item: string; readonly count: number }[];
  readonly reputation?: readonly {
    readonly trader: string;
    readonly amount: number;
  }[];
}

export interface QuestDef {
  readonly id: string;
  readonly name: string;
  /** Vendedor que dá a quest */
  readonly trader: string;
  readonly description: string;
  /** Faz parte da cadeia principal (a fuga) */
  readonly main?: boolean;
  /** Concluir esta quest termina o jogo */
  readonly final?: boolean;
  readonly requires: QuestRequirements;
  readonly objectives: readonly QuestObjective[];
  readonly rewards: QuestRewards;
}

export type QuestStatus =
  | "locked"
  | "available"
  | "active"
  /** Objetivos cumpridos, falta entregar a quest */
  | "ready"
  | "completed";

/** Quest aceita (vai para o save) */
export interface QuestState {
  status: "active" | "completed";
  /** Progresso de cada objetivo, na ordem de `objectives` */
  progress: number[];
}

export type QuestsState = Record<string, QuestState>;

/** Dados que as regras das quests consultam */
export interface QuestContext {
  readonly quests: readonly QuestDef[];
  readonly traders: readonly TraderDef[];
  readonly maps: readonly MapDef[];
}
