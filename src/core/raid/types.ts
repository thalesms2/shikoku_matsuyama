import type { SkillId } from "../pmc/skills.ts";

/** Requisito para usar uma extração */
export type ExtractRequirement =
  /** Precisa levar a chave (nos bolsos, colete, mochila ou contêiner seguro) */
  | { readonly kind: "key"; readonly item: string }
  /** Paga em dinheiro, que precisa estar no equipamento */
  | { readonly kind: "payment"; readonly item: string; readonly amount: number }
  /** Só passa quem não estiver de mochila */
  | { readonly kind: "noBackpack" };

export interface ExtractDef {
  readonly id: string;
  readonly name: string;
  /** Chance (0 a 1) de haver alguém de tocaia na saída */
  readonly risk: number;
  readonly requirement?: ExtractRequirement;
}

/** Linha da tabela de loot: id do item, peso no sorteio e quantidade */
export interface LootEntry {
  readonly item: string;
  readonly weight: number;
  readonly min?: number;
  readonly max?: number;
}

export type EnemyKind = "scav" | "pmc";

/** Perfil de um inimigo controlado pela simulação */
export interface EnemyDef {
  readonly kind: EnemyKind;
  readonly name: string;
  /** Pontos de vida (um total só, sem partes do corpo) */
  readonly health: number;
  /** Chance base de acerto por disparo */
  readonly accuracy: number;
  readonly damage: number;
  readonly penetration: number;
  /** Classes de armadura possíveis (sorteia uma) */
  readonly armorClasses: readonly number[];
  /** Disparos por troca de tiros */
  readonly burst: number;
}

export interface MapDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 1 (fácil) a 5 (difícil): aumenta a precisão dos inimigos */
  readonly difficulty: number;
  /** Tempo de raid em minutos simulados; passou disso, o PMC é dado como MIA */
  readonly duration: number;
  /** Peso de cada tipo de inimigo no sorteio de encontros */
  readonly threats: Readonly<Record<EnemyKind, number>>;
  readonly loot: readonly LootEntry[];
  /** Ao menos uma extração sem requisito */
  readonly extracts: readonly ExtractDef[];
}

export const STRATEGY_IDS = ["stealth", "balanced", "aggressive"] as const;
export type StrategyId = (typeof STRATEGY_IDS)[number];

/** Regra para guardar loot quando a grade enche */
export const LOOT_RULES = ["valuePerCell", "keepFirst"] as const;
export type LootRule = (typeof LOOT_RULES)[number];

export type RaidOutcome = "extracted" | "killed" | "mia";

export const RAID_EVENT_KINDS = [
  "start",
  "loot",
  "lootSwap",
  "lootLeft",
  "encounter",
  "avoid",
  "flee",
  "hit",
  "wounded",
  "kill",
  "disengage",
  "reload",
  "heal",
  "eat",
  "hazard",
  "starving",
  "quiet",
  "extract",
  "death",
  "mia",
] as const;
export type RaidEventKind = (typeof RAID_EVENT_KINDS)[number];

/** Uma linha do log da raid, em minutos simulados desde o começo */
export interface RaidEvent {
  readonly t: number;
  readonly kind: RaidEventKind;
  readonly text: string;
}

/** Item resumido para a tela de resultado */
export interface ItemSummary {
  readonly def: string;
  readonly name: string;
  readonly count: number;
}

export interface RaidSummary {
  readonly outcome: RaidOutcome;
  readonly map: string;
  readonly strategy: StrategyId;
  /** Minutos simulados até o fim da raid */
  readonly minutes: number;
  readonly kills: Readonly<Record<EnemyKind, number>>;
  /** Loot encontrado (que estava com o PMC no fim da raid) */
  readonly loot: readonly ItemSummary[];
  /** Valor do loot encontrado */
  readonly lootValue: number;
  /** Equipamento e loot perdidos (só quando morre) */
  readonly lost: readonly ItemSummary[];
  /** XP do PMC ganho (só quando extrai) */
  readonly xp: number;
  /** XP ganho em cada skill (mantido mesmo quando morre) */
  readonly skillXp: Partial<Record<SkillId, number>>;
  readonly karma: number;
  /** Nome da extração usada */
  readonly extract: string | null;
  /** Quem matou o PMC */
  readonly killedBy: string | null;
  /** Só na raid Scav: o que foi levado ao estoque ao extrair */
  readonly scav?: ScavTransfer;
}

/** Resultado da transferência do Scav para o estoque */
export interface ScavTransfer {
  /** Itens (equipamento e loot do Scav) guardados no estoque */
  readonly stored: readonly ItemSummary[];
  readonly storedValue: number;
  /** O que não coube no estoque e ficou para trás */
  readonly left: readonly ItemSummary[];
}

/**
 * Ajustes da simulação para um tipo de raid (a raid Scav usa o karma). Sem
 * modificadores, a raid do PMC não muda.
 */
export interface RaidModifiers {
  /** Chance de um Scav encontrado não ser hostil */
  readonly friendlyScav: number;
  /** Multiplica a chance de tocaia na extração */
  readonly extractRisk: number;
  /** Multiplica o peso dos eventos de loot */
  readonly lootWeight: number;
  /**
   * −1 a 1. Positivo: chance de sortear o loot duas vezes e ficar com o mais
   * valioso; negativo: com o menos valioso.
   */
  readonly lootQuality: number;
}

export const NO_MODIFIERS: RaidModifiers = {
  friendlyScav: 0,
  extractRisk: 1,
  lootWeight: 1,
  lootQuality: 0,
};

/** Opção de arma do Scav, com carregador e munição */
export interface ScavWeaponOption {
  readonly weapon: string;
  readonly magazine: string;
  readonly ammo: string;
  readonly weight: number;
  /** Carregadores extras (cheios) */
  readonly spareMags: readonly [number, number];
  /** Munição solta */
  readonly looseAmmo: readonly [number, number];
}

/** Opção de um slot do Scav; `item: null` = slot vazio */
export interface ScavSlotOption {
  readonly item: string | null;
  readonly weight: number;
}

export type ScavGearSlot = "helmet" | "armor" | "rig" | "backpack";

/** Tabelas do equipamento aleatório do Scav */
export interface ScavLoadout {
  readonly weapons: readonly ScavWeaponOption[];
  readonly gear: Readonly<Record<ScavGearSlot, readonly ScavSlotOption[]>>;
  /** Itens soltos (remédios, comida, dinheiro...) */
  readonly extras: readonly LootEntry[];
  readonly extraRolls: readonly [number, number];
}

/** Raid Scav: cooldown e estatísticas (vai para o save) */
export interface ScavProfile {
  /** Momento (relógio real, ms) em que a próxima raid Scav fica liberada */
  readyAt: number;
  stats: RaidStats;
}

/** Raid já resolvida, sendo mostrada em tempo real */
export interface ActiveRaid {
  /** Momento (relógio real, ms) em que a raid começou */
  readonly startedAt: number;
  readonly events: readonly RaidEvent[];
  readonly summary: RaidSummary;
}

export interface RaidStats {
  raids: number;
  extracted: number;
  killed: number;
  mia: number;
  kills: Record<EnemyKind, number>;
}

/** Tudo de raids que pertence ao jogador e vai para o save */
export interface RaidProfile {
  /** Comportamento acumulado nas raids do PMC (usado pela raid Scav) */
  karma: number;
  stats: RaidStats;
  lootRule: LootRule;
  /** Seed da próxima raid; muda a cada raid (recarregar não muda o sorteio) */
  seed: number;
  active: ActiveRaid | null;
}
