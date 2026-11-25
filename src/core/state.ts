import { createAutoState } from "./auto/auto.ts";
import type { AutoState } from "./auto/types.ts";
import type { Clock } from "./clock.ts";
import { createFleaState } from "./flea/flea.ts";
import type { FleaState } from "./flea/types.ts";
import { createHideoutState } from "./hideout/hideout.ts";
import type { HideoutState } from "./hideout/types.ts";
import type { Equipment } from "./inventory/equipment.ts";
import type { Grid } from "./inventory/grid.ts";
import type { Item, ItemFactory } from "./inventory/item.ts";
import type { Loadout } from "./loadout/types.ts";
import type { MapKnowledgeState } from "./matrix/knowledge.ts";
import type { PmcState } from "./pmc/pmc.ts";
import type { SkillsState } from "./pmc/skills.ts";
import type { QuestsState } from "./quests/types.ts";
import { createRaidProfile, createScavProfile } from "./raid/profile.ts";
import type { RaidProfile, ScavProfile } from "./raid/types.ts";
import type { TradersState } from "./trade/types.ts";

export interface InventoryState {
  stash: Grid;
  equipment: Equipment;
}

/** Tudo que pertence ao jogador e vai para o save */
export interface PlayerState {
  inventory: InventoryState;
  pmc: PmcState;
  skills: SkillsState;
  /** Cria itens novos; o `nextId` dela vai para o save */
  factory: ItemFactory;
  /** Karma, estatísticas, regra de loot, seed e a raid em andamento */
  raid: RaidProfile;
  /** Cooldown e estatísticas da raid Scav */
  scav: ScavProfile;
  /** Reputação, volume negociado e estoque comprado de cada vendedor */
  traders: TradersState;
  /** Quests aceitas e concluídas, com o progresso */
  quests: QuestsState;
  /** Módulos, obra, produções, renda e o último cálculo do esconderijo */
  hideout: HideoutState;
  /** Anúncios, resultados, pressão de preços e estatísticas do mercado */
  flea: FleaState;
  /** Modelos de equipamento salvos */
  loadouts: Loadout[];
  /** Regras e andamento das raids automáticas */
  auto: AutoState;
  /** Raid em matriz: conhecimento de cada mapa (habilidade e pontos achados) */
  mapKnowledge: MapKnowledgeState;
}

/**
 * Monta o estado do jogador. Sem `raid`, começa um perfil novo com a seed
 * tirada do relógio; sem `scav`, a raid Scav começa liberada; sem `traders`, nenhum vendedor
 * tem histórico (o estado de cada um é criado no primeiro acesso); sem
 * `hideout`/`flea`, começam vazios a partir do relógio.
 */
export function createPlayerState(
  parts: Omit<
    PlayerState,
    | "raid"
    | "scav"
    | "traders"
    | "quests"
    | "hideout"
    | "flea"
    | "loadouts"
    | "auto"
    | "mapKnowledge"
  > & {
    raid?: RaidProfile;
    scav?: ScavProfile;
    traders?: TradersState;
    quests?: QuestsState;
    hideout?: HideoutState;
    flea?: FleaState;
    loadouts?: Loadout[];
    auto?: AutoState;
    mapKnowledge?: MapKnowledgeState;
  },
  clock: Clock,
): PlayerState {
  return {
    ...parts,
    raid: parts.raid ?? createRaidProfile(clock.now()),
    scav: parts.scav ?? createScavProfile(),
    traders: parts.traders ?? {},
    quests: parts.quests ?? {},
    hideout: parts.hideout ?? createHideoutState(clock.now()),
    flea: parts.flea ?? createFleaState(clock.now()),
    loadouts: parts.loadouts ?? [],
    auto: parts.auto ?? createAutoState(),
    mapKnowledge: parts.mapKnowledge ?? {},
  };
}

/**
 * Onde guardar o que sai de um item (munição descarregada, carregador
 * removido, metade de pilha): a grade do próprio item, depois o equipamento
 * (bolsos, colete tático, mochila) e por fim o estoque, sem repetir.
 */
export function storageFor(inventory: InventoryState, item: Item): Grid[] {
  const grids: Grid[] = [];
  if (item.location?.kind === "grid") grids.push(item.location.grid);
  for (const grid of [...inventory.equipment.carryGrids(), inventory.stash]) {
    if (!grids.includes(grid)) grids.push(grid);
  }
  return grids;
}
