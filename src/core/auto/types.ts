import type { HideoutData } from "../hideout/types.ts";
import type { ShopContext } from "../loadout/types.ts";
import type { QuestContext } from "../quests/types.ts";
import type {
  EnemyDef,
  EnemyKind,
  MapDef,
  RaidOutcome,
  StrategyId,
} from "../raid/types.ts";

/** O que fazer quando a vida está abaixo do mínimo */
export type LowHealthAction = "stop" | "wait";

/** Regras escolhidas pelo jogador para as raids automáticas */
export interface AutoRules {
  /** Id do mapa (inválido = o primeiro mapa) */
  map: string;
  strategy: StrategyId;
  /** Nome do loadout montado antes de cada raid (`null` = como está) */
  loadout: string | null;
  /** Comprar o que faltar do loadout */
  buyMissing: boolean;
  /** Raids nesta sequência */
  maxRaids: number;
  /** Vida total mínima (0 a 1) para entrar */
  minHealth: number;
  lowHealth: LowHealthAction;
  /** Parar quando o PMC morrer ou ficar MIA */
  stopOnDeath: boolean;
}

/** Resultado resumido de uma raid automática */
export interface AutoEntry {
  readonly n: number;
  readonly map: string;
  readonly outcome: RaidOutcome;
  readonly minutes: number;
  readonly lootValue: number;
  readonly xp: number;
  readonly kills: number;
}

/** Tudo das raids automáticas que vai para o save */
export interface AutoState {
  rules: AutoRules;
  running: boolean;
  /** Raids feitas nesta sequência */
  done: number;
  /** Quando a próxima raid pode começar */
  nextAt: number;
  /** `startedAt` da raid que a sequência começou (para fechá-la sozinha) */
  current: number | null;
  /** Últimos resultados, do mais novo para o mais velho */
  log: AutoEntry[];
  /** Por que a sequência parou */
  stopReason: string | null;
}

export interface AutoContext {
  readonly maps: readonly MapDef[];
  readonly enemies: Readonly<Record<EnemyKind, EnemyDef>>;
  readonly quests: QuestContext;
  readonly hideout: HideoutData;
  readonly shop: ShopContext;
}
