import type { Equipment, SlotName } from "./equipment.ts";
import { Grid } from "./grid.ts";
import { maxStack } from "./size.ts";

export const ITEM_CATEGORIES = [
  "weapon",
  "ammo",
  "armor",
  "helmet",
  "rig",
  "backpack",
  "container",
  "medical",
  "food",
  "barter",
  "key",
  "money",
  "magazine",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const EQUIP_SLOT_TYPES = [
  "longWeapon",
  "pistol",
  "helmet",
  "armor",
  "rig",
  "backpack",
  "secure",
] as const;

/** Tipo de slot de equipamento em que um item pode ser equipado */
export type EquipSlotType = (typeof EQUIP_SLOT_TYPES)[number];

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

/** Dados técnicos do item (vindos da referência da API), todos opcionais */
export interface ItemStats {
  /** Calibre, no formato da fonte (ex.: "Caliber545x39") */
  readonly caliber?: string;
  readonly damage?: number;
  readonly penetration?: number;
  readonly armorClass?: number;
  readonly durability?: number;
  /** Capacidade de carregadores */
  readonly capacity?: number;
  /** Consumíveis: pontos de vida curados */
  readonly heal?: number;
  /** Consumíveis: energia recuperada (negativo gasta) */
  readonly energy?: number;
  /** Consumíveis: hidratação recuperada (negativo gasta) */
  readonly hydration?: number;
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
  /** Descrição mostrada ao jogador */
  readonly description?: string;
  /** Caminho da imagem do item, relativo a `public/` */
  readonly image?: string;
  readonly stats?: ItemStats;
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

/** Carregador encaixado em uma arma */
export interface WeaponLocation {
  readonly kind: "weapon";
  readonly weapon: Item;
}

/** Onde um item está guardado */
export type ItemLocation = GridLocation | SlotLocation | WeaponLocation;

/** Cartuchos de um mesmo tipo, em sequência, dentro de um carregador */
export interface RoundStack {
  readonly def: ItemDef;
  count: number;
}

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
  /**
   * Carregadores: cartuchos na ordem em que foram carregados. O último da
   * lista é o topo, o próximo a ser disparado.
   */
  readonly rounds?: RoundStack[];
  /** Armas: carregador encaixado */
  magazine?: Item | null;
  /** Encontrado na raid (saiu com o loot de uma raid em que extraiu) */
  fir?: boolean;
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
    return this.build(defId, count, `i${this.counter}`, true);
  }

  /**
   * Recria um item salvo, com o uid original, sem gastar um id novo. O
   * `nextId` da fábrica deve vir do mesmo save.
   */
  restore(defId: string, count: number, uid: string): Item {
    return this.build(defId, count, uid, false);
  }

  private build(
    defId: string,
    count: number,
    uid: string,
    fresh: boolean,
  ): Item {
    const def = this.catalog.get(defId);
    if (!Number.isInteger(count) || count < 1 || count > maxStack(def)) {
      throw new RangeError(
        `Quantidade inválida para ${defId}: ${count} (máx. ${maxStack(def)})`,
      );
    }
    if (fresh) this.counter++;
    const grids: Grid[] = [];
    const item: Item = {
      uid,
      def,
      count,
      grids,
      location: null,
      ...(def.category === "magazine" && { rounds: [] }),
      ...(def.category === "weapon" && { magazine: null }),
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
  for (const round of item.rounds ?? []) {
    value += round.def.basePrice * round.count;
  }
  if (item.magazine) value += totalValue(item.magazine);
  return value;
}
