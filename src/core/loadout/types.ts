import type { FleaConfig } from "../flea/types.ts";
import type { SlotName } from "../inventory/equipment.ts";
import type { TraderDef } from "../trade/types.ts";

/** Item e quantidade de um loadout */
export interface LoadoutItem {
  readonly item: string;
  readonly count: number;
}

/** Modelo de equipamento salvo pelo jogador (vai para o save) */
export interface Loadout {
  name: string;
  /** Item de cada slot */
  slots: Partial<Record<SlotName, string>>;
  /** Carregador encaixado na arma de cada slot */
  magazines: Partial<Record<SlotName, string>>;
  /** Itens carregados nos bolsos, colete tático e mochila (somados por tipo) */
  carried: LoadoutItem[];
}

/** Onde comprar o que falta */
export interface ShopContext {
  readonly traders: readonly TraderDef[];
  readonly flea: FleaConfig;
}

/** De onde vem a compra de um item e quanto custa por unidade, em rublos */
export type PurchaseSource =
  | { readonly kind: "trader"; readonly trader: string; readonly offer: string }
  | { readonly kind: "flea" };

export interface PurchaseOption {
  readonly source: PurchaseSource;
  /** Unidades por compra */
  readonly lot: number;
  /** Preço de uma compra, em rublos */
  readonly rub: number;
}

/** Resultado de aplicar um loadout */
export interface ApplyReport {
  /** Itens que não estavam no estoque */
  readonly missing: LoadoutItem[];
  /** Itens que não couberam no equipamento */
  readonly noSpace: LoadoutItem[];
}
