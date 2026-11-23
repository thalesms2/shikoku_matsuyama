import { describe, expect, it, vi } from "vitest";

import {
  API_URL,
  ITEMS_QUERY,
  fetchApiItems,
} from "../../../scripts/items/api.ts";
import { API_ITEMS, jsonFetch } from "./fixtures.ts";

describe("fetchApiItems", () => {
  it("envia a query por POST e devolve os itens", async () => {
    const fetchFn = vi.fn(jsonFetch({ data: { items: API_ITEMS } }));
    await expect(fetchApiItems(fetchFn)).resolves.toEqual(API_ITEMS);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(API_URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ query: ITEMS_QUERY });
  });

  it("aceita outra URL", async () => {
    const fetchFn = vi.fn(jsonFetch({ data: { items: [] } }));
    await fetchApiItems(fetchFn, "http://local/graphql");
    expect((fetchFn.mock.calls[0] as unknown[])[0]).toBe(
      "http://local/graphql",
    );
  });

  it("repassa erros da API (strings ou objetos com message)", async () => {
    await expect(
      fetchApiItems(
        jsonFetch({ errors: ["GraphQL server unavailable."] }, 422),
      ),
    ).rejects.toThrow("Erro da API (422): GraphQL server unavailable.");
    await expect(
      fetchApiItems(jsonFetch({ errors: [{ message: "campo x" }, {}] })),
    ).rejects.toThrow("Erro da API (200): campo x; ");
  });

  it("falha com resposta sem JSON", async () => {
    const fetchFn = async () => new Response("<html>", { status: 502 });
    await expect(fetchApiItems(fetchFn)).rejects.toThrow(
      "A API respondeu 502 sem JSON válido",
    );
  });

  it("falha sem a lista de itens ou com status de erro", async () => {
    await expect(fetchApiItems(jsonFetch({ data: {} }))).rejects.toThrow(
      "sem a lista de itens",
    );
    await expect(
      fetchApiItems(jsonFetch({ data: { items: [] } }, 500)),
    ).rejects.toThrow("A API respondeu 500");
  });
});
