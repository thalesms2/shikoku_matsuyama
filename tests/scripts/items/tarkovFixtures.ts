import type {
  ApiItem,
  RawItem,
  RawItemsData,
} from "../../../scripts/items/api.ts";
import { API_ITEMS } from "./fixtures.ts";

/**
 * Converte itens normalizados para o formato gravado do json.tarkov.dev:
 * `/{modo}/items` (nomes como chaves de tradução, categorias por id) e
 * `/{modo}/items_en` (as traduções).
 */
export function tarkovJson(items: readonly ApiItem[] = API_ITEMS): {
  data: RawItemsData;
  translations: Record<string, string>;
} {
  const data: RawItemsData = { items: {}, itemCategories: {} };
  const translations: Record<string, string> = {};
  for (const item of items) {
    const categories: string[] = [];
    if (item.category) {
      const catId = `cat-${item.category.normalizedName}`;
      data.itemCategories[catId] = {
        normalizedName: item.category.normalizedName,
      };
      categories.push(catId, "cat-item");
    }
    const raw: RawItem = {
      id: item.id,
      name: `${item.id} Name`,
      shortName: `${item.id} ShortName`,
      width: item.width,
      height: item.height,
      basePrice: item.basePrice,
      types: item.types,
      categories,
      gridImageLink: item.gridImageLink,
      properties: item.properties,
    };
    data.items[item.id] = raw;
    translations[raw.name] = item.name;
    translations[raw.shortName] = item.shortName;
  }
  return { data, translations };
}

/**
 * `fetch` falso do json.tarkov.dev: responde `/items` e `/items_en` com os
 * itens dados; qualquer outra URL vai para `other` (imagens).
 */
export function tarkovFetch(
  items: readonly ApiItem[] = API_ITEMS,
  other: (url: string) => Response = () => new Response("img"),
) {
  const { data, translations } = tarkovJson(items);
  return async (url: string) => {
    if (url.endsWith("/items")) return new Response(JSON.stringify({ data }));
    if (url.endsWith("/items_en")) {
      return new Response(JSON.stringify({ data: translations }));
    }
    return other(url);
  };
}
