import type { SlotName } from "../inventory/equipment.ts";
import type { PmcState } from "../pmc/pmc.ts";
import type { SkillsState } from "../pmc/skills.ts";
import type { QuestsState } from "../quests/types.ts";
import type { RaidProfile, ScavProfile } from "../raid/types.ts";
import type { TradersState } from "../trade/types.ts";

/** Versão atual do formato do save. Mudou o formato? Incremente e migre. */
export const SAVE_VERSION = 5;

/** Item salvo; o conteúdo vai junto (grades, cartuchos, carregador) */
export interface SavedItem {
  uid: string;
  def: string;
  count: number;
  /** Conteúdo de cada grade interna */
  grids?: SavedPlacedItem[][];
  /** Cartuchos do carregador: [id da munição, quantidade], do fundo ao topo */
  rounds?: [string, number][];
  /** Carregador encaixado na arma */
  magazine?: SavedItem;
  /** v5: encontrado na raid */
  fir?: true;
}

/** Item salvo dentro de uma grade, com a posição */
export interface SavedPlacedItem extends SavedItem {
  x: number;
  y: number;
  /** Rotacionado */
  r: boolean;
}

export type SavedLoadJob =
  | {
      kind: "load";
      magazine: string;
      ammo: string;
      startedAt: number;
      done: number;
    }
  | { kind: "unload"; magazine: string; startedAt: number; done: number };

export interface SaveData {
  version: number;
  savedAt: number;
  /** `ItemFactory.nextId` */
  nextId: number;
  stash: { width: number; height: number; items: SavedPlacedItem[] };
  equipment: {
    slots: Partial<Record<SlotName, SavedItem>>;
    pockets: SavedPlacedItem[][];
  };
  pmc: PmcState;
  skills: SkillsState;
  loader: SavedLoadJob | null;
  /** v2: karma, estatísticas, regra de loot, seed e a raid em andamento */
  raid?: RaidProfile;
  /** v3: cooldown e estatísticas da raid Scav */
  scav?: ScavProfile;
  /** v4: reputação, volume, compras e reposição de cada vendedor */
  traders?: TradersState;
  /** v5: quests aceitas e concluídas (e `fir` nos itens) */
  quests?: QuestsState;
}
