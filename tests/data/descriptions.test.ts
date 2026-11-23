import { describe, expect, it } from "vitest";

import { ITEM_DEFS } from "../../src/data/items.ts";

describe("descrições dos itens", () => {
  it("todo item do catálogo tem uma descrição própria", () => {
    for (const def of ITEM_DEFS) {
      expect(def.description?.trim().length, def.id).toBeGreaterThan(10);
    }
  });
});
