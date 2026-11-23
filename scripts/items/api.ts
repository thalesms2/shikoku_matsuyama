/**
 * Cliente da API GraphQL do tarkov.dev. Usado só em desenvolvimento, pelo
 * comando `npm run items -- sync`; o jogo nunca acessa a API.
 */

export const API_URL = "https://api.tarkov.dev/graphql";

export interface ApiGrid {
  width: number;
  height: number;
}

/** Item como vem da API (só os campos que o jogo usa como referência) */
export interface ApiItem {
  id: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  basePrice: number;
  types: string[];
  category: { normalizedName: string } | null;
  gridImageLink: string | null;
  properties: ({ __typename: string } & Record<string, unknown>) | null;
}

export const ITEMS_QUERY = `{
  items {
    id
    name
    shortName
    width
    height
    basePrice
    types
    category { normalizedName }
    gridImageLink
    properties {
      __typename
      ... on ItemPropertiesAmmo { caliber stackMaxSize damage penetrationPower }
      ... on ItemPropertiesWeapon { caliber defaultWidth defaultHeight }
      ... on ItemPropertiesMagazine { capacity }
      ... on ItemPropertiesArmor { class durability }
      ... on ItemPropertiesHelmet { class durability }
      ... on ItemPropertiesChestRig { class durability grids { width height } }
      ... on ItemPropertiesBackpack { grids { width height } }
      ... on ItemPropertiesContainer { grids { width height } }
    }
  }
}`;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Busca todos os itens da API */
export async function fetchApiItems(
  fetchFn: FetchFn = fetch,
  url = API_URL,
): Promise<ApiItem[]> {
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: ITEMS_QUERY }),
  });
  let body: { data?: { items?: ApiItem[] }; errors?: unknown[] };
  try {
    body = await res.json();
  } catch {
    throw new Error(`A API respondeu ${res.status} sem JSON válido`);
  }
  if (body.errors?.length) {
    const messages = body.errors.map((e) =>
      typeof e === "string" ? e : ((e as { message?: string }).message ?? ""),
    );
    throw new Error(`Erro da API (${res.status}): ${messages.join("; ")}`);
  }
  if (!res.ok || !Array.isArray(body.data?.items)) {
    throw new Error(`A API respondeu ${res.status} sem a lista de itens`);
  }
  return body.data.items;
}
