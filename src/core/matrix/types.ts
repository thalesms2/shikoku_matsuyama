import type { ExtractRequirement, LootEntry } from "../raid/types.ts";

/** Tipos de terreno de uma célula: custo de movimento e barulho */
export const TERRAINS = [
  "road",
  "grass",
  "metal",
  "rubble",
  "building",
] as const;
export type Terrain = (typeof TERRAINS)[number];

/** Os 17 tipos de contêiner de loot */
export const CONTAINER_KINDS = [
  "safe",
  "buriedBarrel",
  "cashRegister",
  "deadBody",
  "drawer",
  "groundCache",
  "grenadeBox",
  "jacket",
  "medbag",
  "supplyCrate",
  "pcBlock",
  "suitcase",
  "sportsBag",
  "toolbox",
  "weaponBox",
  "ammoBox",
  "crate",
] as const;
export type ContainerKind = (typeof CONTAINER_KINDS)[number];

/** Definição de um tipo de contêiner */
export interface ContainerDef {
  readonly kind: ContainerKind;
  readonly name: string;
  /**
   * Nível de raridade (1 a 5). As estratégias escolhem o que pegar por ele,
   * porque o personagem não sabe o valor dos itens.
   */
  readonly rarity: number;
  /** Turnos para revistar (2 a 5) */
  readonly searchTurns: number;
  /** Chance de achar o loot ao revistar (antes das skills) */
  readonly findChance: number;
  /** Chance de o item sair da tabela rara */
  readonly rareChance: number;
  readonly loot: readonly LootEntry[];
  readonly rare: readonly LootEntry[];
}

/** Uma célula da matriz */
export interface MatrixCell {
  readonly terrain: Terrain;
  readonly container?: ContainerKind;
  /** Ponto de spawn de Scavs */
  readonly scavSpawn?: true;
  /** Ponto de spawn de PMCs inimigos */
  readonly pmcSpawn?: true;
}

/** Extração numa célula */
export interface MatrixExtract {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly requirement?: ExtractRequirement;
}

/** Ponto de interesse: grupo de células com contêineres (ex.: enfermaria) */
export interface PointOfInterest {
  readonly id: string;
  readonly name: string;
  readonly cells: readonly (readonly [number, number])[];
  /** Conhecido desde o começo (ex.: hospital, base militar) */
  readonly obvious: boolean;
}

/** Mapa em matriz: o personagem entra pela esquerda e sai pela direita */
export interface MatrixMap {
  readonly id: string;
  readonly name: string;
  readonly difficulty: number;
  readonly width: number;
  readonly height: number;
  /** Linha por linha: `cells[y][x]` */
  readonly cells: readonly (readonly MatrixCell[])[];
  readonly extracts: readonly MatrixExtract[];
  readonly pois: readonly PointOfInterest[];
}

/** Receita para gerar um mapa (fixo: a mesma receita gera o mesmo mapa) */
export interface MatrixMapDef {
  readonly id: string;
  readonly name: string;
  readonly difficulty: number;
  readonly seed: number;
  /** Peso de cada terreno */
  readonly terrain: Readonly<Partial<Record<Terrain, number>>>;
  /** Peso de cada tipo de contêiner espalhado pelo mapa */
  readonly containers: Readonly<Partial<Record<ContainerKind, number>>>;
  /** Pontos de interesse: nome, se é óbvio e os contêineres dele */
  readonly pois: readonly {
    readonly id: string;
    readonly name: string;
    readonly obvious: boolean;
    readonly containers: readonly ContainerKind[];
  }[];
  /** Extrações: as com requisito ficam mais perto da entrada que as livres */
  readonly extracts: readonly {
    readonly id: string;
    readonly name: string;
    readonly requirement?: ExtractRequirement;
  }[];
}
