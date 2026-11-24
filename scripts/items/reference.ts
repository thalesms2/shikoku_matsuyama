import type { ApiGrid, ApiItem } from "./api.ts";

/**
 * Dados de referência de um item, normalizados a partir da API. Ficam salvos
 * na tabela `items` do banco local. Nomes da fonte servem só para busca e
 * curadoria; o jogo usa os nomes próprios de `item_overrides`.
 */
export interface ReferenceItem {
  sourceId: string;
  sourceName: string;
  sourceShortName: string;
  /** `category.normalizedName` da fonte */
  sourceCategory: string | null;
  types: string[];
  width: number;
  height: number;
  basePrice: number;
  maxStack: number | null;
  caliber: string | null;
  /**
   * Capacidade de carregadores. A fonte também manda `capacity` em
   * contêineres (total de células), que é ignorado: quem tem grade não é
   * carregador.
   */
  capacity: number | null;
  damage: number | null;
  penetration: number | null;
  armorClass: number | null;
  durability: number | null;
  grids: ApiGrid[];
  imageUrl: string | null;
}

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const str = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

function grids(value: unknown): ApiGrid[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((g) => ({ width: num(g?.width), height: num(g?.height) }))
    .filter((g): g is ApiGrid => g.width !== null && g.height !== null);
}

/** Converte um item da API para os dados de referência do jogo */
export function toReference(item: ApiItem): ReferenceItem {
  const p: Record<string, unknown> = item.properties ?? {};
  const itemGrids = grids(p.grids);
  return {
    sourceId: item.id,
    sourceName: item.name,
    sourceShortName: item.shortName,
    sourceCategory: item.category?.normalizedName ?? null,
    types: [...item.types],
    // Armas: o tamanho do preset padrão (com peças) é o que ocupa no inventário
    width: num(p.defaultWidth) ?? item.width,
    height: num(p.defaultHeight) ?? item.height,
    basePrice: item.basePrice,
    maxStack: num(p.stackMaxSize),
    caliber: str(p.caliber),
    capacity: itemGrids.length === 0 ? num(p.capacity) : null,
    damage: num(p.damage),
    penetration: num(p.penetrationPower),
    armorClass: num(p.class),
    durability: num(p.durability),
    grids: itemGrids,
    imageUrl: str(item.gridImageLink),
  };
}
