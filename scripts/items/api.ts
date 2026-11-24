/**
 * Cliente dos dados JSON do tarkov.dev (https://json.tarkov.dev/endpoints).
 * Usado só em desenvolvimento, pelo comando `npm run items -- sync`; o jogo
 * nunca acessa a API.
 *
 * Dois arquivos por modo de jogo:
 * - `/{modo}/items`: itens indexados por id, com nomes como chaves de
 *   tradução (`"<id> Name"`), categorias por id e `properties` por tipo;
 * - `/{modo}/items_{idioma}`: o mapa chave de tradução → texto.
 */

export const API_URL = "https://json.tarkov.dev";
/** Modo de jogo: `regular`, `pve` ou `pvp-season` */
export const GAME_MODE = "regular";
/** Idioma dos nomes da fonte (só para busca e curadoria) */
export const LANGUAGE = "en";

export interface ApiGrid {
  width: number;
  height: number;
}

/** Item normalizado (só os campos que o jogo usa como referência) */
export interface ApiItem {
  id: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  basePrice: number;
  types: string[];
  /** Categoria mais específica do item */
  category: { normalizedName: string } | null;
  gridImageLink: string | null;
  /** Propriedades do tipo (`propertiesType` diz qual) */
  properties: Record<string, unknown> | null;
}

/** Item como vem em `/{modo}/items` */
export interface RawItem {
  id: string;
  /** Chave de tradução, ex.: `"5447a9cd4bdc2dbd208b4567 Name"` */
  name: string;
  shortName: string;
  width: number;
  height: number;
  basePrice: number;
  types: string[];
  /** Ids das categorias, da mais específica para a mais geral */
  categories: string[];
  gridImageLink: string | null;
  properties: Record<string, unknown> | null;
}

export interface RawItemsData {
  items: Record<string, RawItem>;
  itemCategories: Record<string, { normalizedName: string }>;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export const itemsUrl = (base = API_URL, mode = GAME_MODE) =>
  `${base}/${mode}/items`;

export const translationsUrl = (
  base = API_URL,
  mode = GAME_MODE,
  lang = LANGUAGE,
) => `${base}/${mode}/items_${lang}`;

/** GET de um endpoint; devolve o campo `data` da resposta */
async function getData<T>(fetchFn: FetchFn, url: string): Promise<T> {
  const res = await fetchFn(url, { method: "GET" });
  let body: { data?: T };
  try {
    body = await res.json();
  } catch {
    throw new Error(`A API respondeu ${res.status} sem JSON válido em ${url}`);
  }
  if (!res.ok) throw new Error(`A API respondeu ${res.status} em ${url}`);
  if (typeof body?.data !== "object" || body.data === null) {
    throw new Error(`A API respondeu sem dados em ${url}`);
  }
  return body.data;
}

/** Junta itens, categorias e traduções no formato normalizado */
export function normalizeItems(
  data: RawItemsData,
  translations: Record<string, string>,
): ApiItem[] {
  const text = (key: string) => translations[key] ?? key;
  return Object.values(data.items).map((raw) => {
    const category = data.itemCategories[raw.categories[0]];
    return {
      id: raw.id,
      name: text(raw.name),
      shortName: text(raw.shortName),
      width: raw.width,
      height: raw.height,
      basePrice: raw.basePrice,
      types: raw.types,
      category: category ? { normalizedName: category.normalizedName } : null,
      gridImageLink: raw.gridImageLink,
      properties: raw.properties,
    };
  });
}

/** Busca todos os itens (com os nomes no idioma `LANGUAGE`) */
export async function fetchApiItems(
  fetchFn: FetchFn = fetch,
  base = API_URL,
): Promise<ApiItem[]> {
  const [data, translations] = await Promise.all([
    getData<Partial<RawItemsData>>(fetchFn, itemsUrl(base)),
    getData<Record<string, string>>(fetchFn, translationsUrl(base)),
  ]);
  if (typeof data.items !== "object" || data.items === null) {
    throw new Error(
      `A API respondeu sem a lista de itens em ${itemsUrl(base)}`,
    );
  }
  return normalizeItems(
    { items: data.items, itemCategories: data.itemCategories ?? {} },
    translations,
  );
}
