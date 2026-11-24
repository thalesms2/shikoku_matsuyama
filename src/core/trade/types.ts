import type { ItemCategory } from "../inventory/item.ts";

/** Nível de lealdade com um vendedor e o que ele exige */
export interface LoyaltyLevel {
  readonly level: number;
  readonly minPmcLevel: number;
  readonly minReputation: number;
  /** Rublos negociados com o vendedor (compras + vendas) */
  readonly minVolume: number;
  /** Multiplica o preço base nas compras do jogador */
  readonly buyMarkup: number;
  /** Fração do valor que o vendedor paga nas vendas do jogador */
  readonly sellRate: number;
}

/** Item pedido numa troca (barter) */
export interface BarterCost {
  readonly item: string;
  readonly count: number;
}

export interface TraderOffer {
  readonly id: string;
  readonly item: string;
  /** Unidades entregues por compra (padrão 1) */
  readonly count?: number;
  /** Nível de lealdade mínimo */
  readonly level: number;
  /** Compras possíveis até a próxima reposição */
  readonly stock: number;
  /** Troca: itens pedidos no lugar de dinheiro */
  readonly barter?: readonly BarterCost[];
  /** Preço fixo (ex.: câmbio); sem ele, `basePrice × count × markup` */
  readonly price?: number;
  /** Moeda do preço fixo (padrão: a do vendedor) */
  readonly currency?: string;
  /** Quest que precisa estar concluída para liberar a oferta */
  readonly quest?: string;
}

export interface TraderDef {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly description: string;
  /** Item de dinheiro usado nos preços e pago nas vendas */
  readonly currency: string;
  /** Do nível 1 em diante; o nível 1 não exige nada */
  readonly levels: readonly LoyaltyLevel[];
  /** Categorias que o vendedor compra, com o multiplicador do preço */
  readonly buys: Readonly<Partial<Record<ItemCategory, number>>>;
  readonly offers: readonly TraderOffer[];
  /** Intervalo de reposição do estoque (tempo real) */
  readonly restockMs: number;
  /**
   * Conserta armaduras: preço = basePrice × fração gasta × `repairRate`
   * (sem o campo, não conserta)
   */
  readonly repairRate?: number;
}

/** O que o jogador tem com um vendedor (vai para o save) */
export interface TraderState {
  reputation: number;
  /** Rublos negociados (compras + vendas) */
  volume: number;
  /** Compras de cada oferta desde a última reposição */
  bought: Record<string, number>;
  /** Momento (relógio real, ms) da próxima reposição */
  restockAt: number;
}

export type TradersState = Record<string, TraderState>;

export type TradeResult =
  | { readonly ok: true; readonly amount: number }
  | { readonly ok: false; readonly reason: string };
