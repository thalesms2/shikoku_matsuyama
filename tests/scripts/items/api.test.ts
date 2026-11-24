import { describe, expect, it, vi } from "vitest";

import {
  API_URL,
  fetchApiItems,
  itemsUrl,
  normalizeItems,
  translationsUrl,
} from "../../../scripts/items/api.ts";
import { API_ITEMS, jsonFetch } from "./fixtures.ts";
import { tarkovFetch, tarkovJson } from "./tarkovFixtures.ts";

describe("URLs", () => {
  it("modo regular e traduções em inglês por padrão", () => {
    expect(API_URL).toBe("https://json.tarkov.dev");
    expect(itemsUrl()).toBe("https://json.tarkov.dev/regular/items");
    expect(translationsUrl()).toBe("https://json.tarkov.dev/regular/items_en");
    expect(itemsUrl("http://x", "pve")).toBe("http://x/pve/items");
    expect(translationsUrl("http://x", "pve", "pt")).toBe(
      "http://x/pve/items_pt",
    );
  });
});

describe("normalizeItems", () => {
  it("traduz nomes e usa a categoria mais específica", () => {
    const { data, translations } = tarkovJson();
    expect(normalizeItems(data, translations)).toEqual(API_ITEMS);
  });

  it("sem tradução fica a chave; categoria desconhecida vira null", () => {
    const { data } = tarkovJson([API_ITEMS[0]]);
    data.items[API_ITEMS[0].id].categories = ["sumiu"];
    const [item] = normalizeItems(data, {});
    expect(item.name).toBe(`${API_ITEMS[0].id} Name`);
    expect(item.shortName).toBe(`${API_ITEMS[0].id} ShortName`);
    expect(item.category).toBeNull();
  });
});

describe("fetchApiItems", () => {
  it("faz GET dos itens e das traduções e devolve normalizado", async () => {
    const fetchFn = vi.fn(tarkovFetch());
    await expect(fetchApiItems(fetchFn)).resolves.toEqual(API_ITEMS);
    const calls = fetchFn.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url).sort()).toEqual([
      itemsUrl(),
      translationsUrl(),
    ]);
    expect(calls.every(([, init]) => init.method === "GET")).toBe(true);
  });

  it("aceita outra URL base", async () => {
    const fetchFn = vi.fn(tarkovFetch([]));
    await expect(fetchApiItems(fetchFn, "http://local")).resolves.toEqual([]);
    expect((fetchFn.mock.calls[0] as unknown[])[0]).toBe(
      "http://local/regular/items",
    );
  });

  it("sem itemCategories, os itens ficam sem categoria", async () => {
    const fetchFn = async (url: string) =>
      new Response(
        JSON.stringify({
          data: url.endsWith("_en")
            ? {}
            : { items: tarkovJson([API_ITEMS[0]]).data.items },
        }),
      );
    const [item] = await fetchApiItems(fetchFn);
    expect(item.category).toBeNull();
  });

  it("falha com resposta sem JSON", async () => {
    const fetchFn = async () => new Response("<html>", { status: 502 });
    await expect(fetchApiItems(fetchFn)).rejects.toThrow(
      "A API respondeu 502 sem JSON válido em https://json.tarkov.dev/regular/",
    );
  });

  it("falha com status de erro, sem dados ou sem a lista de itens", async () => {
    await expect(fetchApiItems(jsonFetch({ data: {} }, 500))).rejects.toThrow(
      "A API respondeu 500 em",
    );
    await expect(fetchApiItems(jsonFetch({}))).rejects.toThrow(
      "A API respondeu sem dados em",
    );
    await expect(fetchApiItems(jsonFetch({ data: null }))).rejects.toThrow(
      "sem dados",
    );
    await expect(fetchApiItems(jsonFetch({ data: {} }))).rejects.toThrow(
      "sem a lista de itens em https://json.tarkov.dev/regular/items",
    );
  });
});
