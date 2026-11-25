import type { AutoState } from "../auto/types.ts";
import type { FleaState, FleaStats } from "../flea/types.ts";
import type { HideoutState } from "../hideout/types.ts";
import type { SlotName } from "../inventory/equipment.ts";
import type { Loadout } from "../loadout/types.ts";
import type { MapKnowledgeState } from "../matrix/knowledge.ts";
import type { PmcState } from "../pmc/pmc.ts";
import type { SkillsState } from "../pmc/skills.ts";
import type { QuestsState, RepeatableState } from "../quests/types.ts";
import type { RaidProfile, ScavProfile } from "../raid/types.ts";
import type { TradersState } from "../trade/types.ts";

/** Versão atual do formato do save. Mudou o formato? Incremente e migre. */
export const SAVE_VERSION = 19;

/** Item salvo; o conteúdo vai junto (grades, cartuchos, carregador) */
export interface SavedItem {
  uid: string;
  def: string;
  count: number;
  /** Conteúdo de cada grade interna */
  grids?: SavedPlacedItem[][];
  /** Cartuchos do carregador ou do tubo: [id da munição, quantidade], do fundo ao topo */
  rounds?: [string, number][];
  /** Carregador encaixado na arma */
  magazine?: SavedItem;
  /** v5: encontrado na raid */
  fir?: true;
  /** v10: durabilidade atual (só quando não está inteira) */
  dur?: number;
  /** v12: cartucho na câmara da arma (id da munição) */
  chamber?: string;
}

/** Item salvo dentro de uma grade, com a posição */
export interface SavedPlacedItem extends SavedItem {
  x: number;
  y: number;
  /** Rotacionado */
  r: boolean;
}

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
  /** v2: karma, estatísticas, regra de loot, seed e a raid em andamento */
  raid?: RaidProfile;
  /** v3: cooldown e estatísticas da raid Scav */
  scav?: ScavProfile;
  /** v4: reputação, volume, compras e reposição de cada vendedor */
  traders?: TradersState;
  /** v5: quests aceitas e concluídas (e `fir` nos itens) */
  quests?: QuestsState;
  /** v6: esconderijo (módulos, obra, produções, renda, último cálculo) */
  hideout?: HideoutState;
  /** v7: mercado (anúncios com o item, resultados, pressão, estatísticas) */
  flea?: SavedFlea;
  /** v8: loadouts salvos */
  loadouts?: Loadout[];
  /** v9: regras e andamento das raids automáticas */
  auto?: AutoState;
  /** v17: conhecimento de cada mapa da raid em matriz */
  mapKnowledge?: MapKnowledgeState;
  /** v19: quests repetíveis (seed, próximo número e ofertas) */
  repeatable?: RepeatableState;
}

export type SavedFleaResult =
  | { kind: "sold"; id: number; def: string; count: number; price: number }
  | { kind: "expired"; id: number; item: SavedItem };

export interface SavedFlea {
  seed: number;
  nextListing: number;
  listings: {
    id: number;
    item: SavedItem;
    price: number;
    listedAt: number;
    expiresAt: number;
  }[];
  results: SavedFleaResult[];
  pressure: FleaState["pressure"];
  lastCheck: number;
  stats: FleaStats;
}
