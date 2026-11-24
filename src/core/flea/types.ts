import type { Item, ItemCategory } from "../inventory/item.ts";

/** Regras e números do mercado (ficam em `src/data/flea.ts`) */
export interface FleaConfig {
  /** Nível do PMC que libera o mercado */
  readonly minPmcLevel: number;
  /** Anúncios ao mesmo tempo */
  readonly slots: number;
  /** Item de dinheiro usado em tudo (compras, taxa, vendas) */
  readonly currency: string;
  /** Categorias que só podem ser anunciadas se encontradas na raid */
  readonly firCategories: readonly ItemCategory[];
  /** Itens que não aparecem no mercado (além do dinheiro e dos sem valor) */
  readonly banned: readonly string[];
  /** Período da tendência de preço; o preço anda em linha reta entre dois */
  readonly trendMs: number;
  /** Variação máxima da tendência (0,2 = ±20%) */
  readonly trendAmplitude: number;
  /** Preço de compra = preço de mercado × `buyMarkup` */
  readonly buyMarkup: number;
  /** Pressão por pilha cheia negociada (vendida +, comprada −) */
  readonly pressurePerStack: number;
  /** Meia-vida da pressão (ela volta a 0 com o tempo) */
  readonly pressureHalfLifeMs: number;
  /** O preço fica entre `1 − limite` e `1 + limite` por causa da pressão */
  readonly pressureLimit: number;
  /** Taxa do anúncio = valor de mercado × `feeRate` × (preço/valor)² */
  readonly feeRate: number;
  /** Intervalo entre os sorteios de venda dos anúncios */
  readonly checkMs: number;
  /** Chance de vender a cada sorteio, com o preço igual ao de mercado */
  readonly saleChance: number;
  /** Acima desta razão preço/valor, o anúncio nunca vende */
  readonly maxRatio: number;
  /** Duração do anúncio; depois disso o item volta */
  readonly listingMs: number;
}

/** Anúncio do jogador; o item fica fora do estoque enquanto isso */
export interface FleaListing {
  readonly id: number;
  readonly item: Item;
  /** Preço pedido pela pilha inteira */
  readonly price: number;
  readonly listedAt: number;
  readonly expiresAt: number;
}

/** Resultado de um anúncio, esperando o jogador retirar */
export type FleaResult =
  | {
      readonly kind: "sold";
      readonly id: number;
      readonly def: string;
      readonly count: number;
      readonly price: number;
    }
  | { readonly kind: "expired"; readonly id: number; readonly item: Item };

export interface FleaStats {
  sold: number;
  earned: number;
  fees: number;
  bought: number;
  spent: number;
}

/** Tudo do mercado que vai para o save */
export interface FleaState {
  /** Seed da tendência de preços e dos sorteios de venda */
  seed: number;
  nextListing: number;
  listings: FleaListing[];
  results: FleaResult[];
  /** Pressão de oferta/demanda de cada item no momento `at` */
  pressure: Record<string, { value: number; at: number }>;
  /** Momento do último sorteio de venda feito */
  lastCheck: number;
  stats: FleaStats;
}
