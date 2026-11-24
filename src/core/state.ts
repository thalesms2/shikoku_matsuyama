import type { Clock } from "./clock.ts";
import type { Equipment } from "./inventory/equipment.ts";
import type { Grid } from "./inventory/grid.ts";
import type { Item, ItemFactory } from "./inventory/item.ts";
import { MagazineLoader } from "./inventory/loading.ts";
import type { PmcState } from "./pmc/pmc.ts";
import type { SkillsState } from "./pmc/skills.ts";
import { createRaidProfile } from "./raid/profile.ts";
import type { RaidProfile } from "./raid/types.ts";

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
  /** Carregamento/descarregamento de carregador em andamento */
  loader: MagazineLoader;
  /** Karma, estatísticas, regra de loot, seed e a raid em andamento */
  raid: RaidProfile;
}

/**
 * Monta o estado do jogador. Sem `raid`, começa um perfil novo com a seed
 * tirada do relógio.
 */
export function createPlayerState(
  parts: Omit<PlayerState, "loader" | "raid"> & { raid?: RaidProfile },
  clock: Clock,
): PlayerState {
  return {
    ...parts,
    loader: new MagazineLoader(clock),
    raid: parts.raid ?? createRaidProfile(clock.now()),
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
