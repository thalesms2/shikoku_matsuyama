import type { Equipment, SlotName } from "./equipment.ts";
import { Grid } from "./grid.ts";
import { maxStack } from "./size.ts";

export type ItemCategory =
  | "weapon"
  | "ammo"
  | "armor"
  | "helmet"
  | "rig"
  | "backpack"
  | "container"
  | "medical"
  | "food"
  | "barter"
  | "key"
  | "money";

/** Tipo de slot de equipamento em que um item pode ser equipado */
export type EquipSlotType =
  | "longWeapon"
  | "pistol"
  | "helmet"
  | "armor"
  | "rig"
  | "backpack"
  | "secure";

/** Restrições de categoria de uma grade */
export interface GridFilter {
  /** Se definido, só estas categorias entram */
  readonly allow?: readonly ItemCategory[];
  /** Estas categorias nunca entram */
  readonly deny?: readonly ItemCategory[];
}

/** Grade interna de um item contêiner (mochila, colete, caixa) */
export interface GridSpec extends GridFilter {
  readonly width: number;
  readonly height: number;
}

/** Definição estática de um tipo de item */
export interface ItemDef {
  readonly id: string;
  readonly name: string;
  /** Nome curto mostrado dentro da célula */
  readonly shortName: string;
  readonly category: ItemCategory;
  /** Largura em células, sem rotação */
  readonly width: number;
  /** Altura em células, sem rotação */
  readonly height: number;
  /** Máximo por pilha (padrão 1 = não empilhável) */
  readonly maxStack?: number;
  /** Preço base em moeda principal, por unidade */
  readonly basePrice: number;
  readonly equipSlot?: EquipSlotType;
  /** Grades internas, para itens contêiner */
  readonly grids?: readonly GridSpec[];
}

export interface GridLocation {
  readonly kind: "grid";
  readonly grid: Grid;
  readonly x: number;
  readonly y: number;
  readonly rotated: boolean;
}

export interface SlotLocation {
  readonly kind: "slot";
  readonly equipment: Equipment;
  readonly slot: SlotName;
}

/** Onde um item está guardado */
export type ItemLocation = GridLocation | SlotLocation;

/** Uma instância de item no jogo */
export interface Item {
  readonly uid: string;
  readonly def: ItemDef;
  /** Quantidade na pilha (1 para itens não empilháveis) */
  count: number;
  /** Grades internas (vazio se não for contêiner) */
  readonly grids: readonly Grid[];
  /** `null` quando o item não está em lugar nenhum (solto) */
  location: ItemLocation | null;
}

/** Conjunto de definições de itens, indexado por id */
export class Catalog {
  private readonly defs = new Map<string, ItemDef>();

  constructor(defs: readonly ItemDef[]) {
    for (const def of defs) {
      if (this.defs.has(def.id)) {
        throw new Error(`Item duplicado no catálogo: ${def.id}`);
      }
      validateDef(def);
      this.defs.set(def.id, def);
    }
  }

  get(id: string): ItemDef {
    const def = this.defs.get(id);
    if (!def) throw new Error(`Item desconhecido: ${id}`);
    return def;
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  all(): ItemDef[] {
    return [...this.defs.values()];
  }
}

function validateDef(def: ItemDef): void {
  const positiveInt = (n: number) => Number.isInteger(n) && n > 0;
  if (!positiveInt(def.width) || !positiveInt(def.height)) {
    throw new Error(`Tamanho inválido em ${def.id}`);
  }
  if (!positiveInt(maxStack(def))) {
    throw new Error(`maxStack inválido em ${def.id}`);
  }
  for (const spec of def.grids ?? []) {
    if (!positiveInt(spec.width) || !positiveInt(spec.height)) {
      throw new Error(`Grade inválida em ${def.id}`);
    }
  }
}

/** Cria instâncias de itens com uids únicos e sequenciais */
export class ItemFactory {
  private counter: number;

  constructor(
    readonly catalog: Catalog,
    nextId = 1,
  ) {
    this.counter = nextId;
  }

  /** Próximo id que será usado (para salvar no save) */
  get nextId(): number {
    return this.counter;
  }

  create(defId: string, count = 1): Item {
    const def = this.catalog.get(defId);
    if (!Number.isInteger(count) || count < 1 || count > maxStack(def)) {
      throw new RangeError(
        `Quantidade inválida para ${defId}: ${count} (máx. ${maxStack(def)})`,
      );
    }
    const grids: Grid[] = [];
    const item: Item = {
      uid: `i${this.counter++}`,
      def,
      count,
      grids,
      location: null,
    };
    for (const spec of def.grids ?? []) {
      grids.push(new Grid(spec.width, spec.height, spec, item));
    }
    return item;
  }
}

/** Valor total do item: pilha + tudo que está dentro dele */
export function totalValue(item: Item): number {
  let value = item.def.basePrice * item.count;
  for (const grid of item.grids) {
    for (const inner of grid.items()) value += totalValue(inner);
  }
  return value;
}
