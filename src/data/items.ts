import { Catalog } from "../core/inventory/item.ts";
import type { ItemDef } from "../core/inventory/item.ts";
import generated from "./generated/items.json";

/**
 * Catálogo de itens do jogo, gerado a partir do banco local
 * (`data/items.db`) por `npm run items -- export`. Não edite o JSON à mão:
 * use `npm run items -- override ...` e exporte de novo.
 *
 * Preços em rublos-velhos (₽), a moeda principal da cidade.
 */
export const ITEM_DEFS: readonly ItemDef[] = generated as ItemDef[];

export const catalog = new Catalog(ITEM_DEFS);
