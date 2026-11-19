import { Grid } from "./grid.ts";
import type { EquipSlotType, Item } from "./item.ts";

/** Slots de equipamento do personagem e o tipo de item que cada um aceita */
export const SLOTS = {
  primary: "longWeapon",
  secondary: "longWeapon",
  holster: "pistol",
  helmet: "helmet",
  armor: "armor",
  rig: "rig",
  backpack: "backpack",
  secure: "secure",
} as const satisfies Record<string, EquipSlotType>;

export type SlotName = keyof typeof SLOTS;

export const SLOT_NAMES = Object.keys(SLOTS) as SlotName[];

/** Quantidade de bolsos (cada um é uma grade 1x1) */
export const POCKET_COUNT = 4;

/** Equipamento vestido pelo personagem: slots + bolsos */
export class Equipment {
  readonly pockets: readonly Grid[];
  private readonly slots = new Map<SlotName, Item>();

  constructor() {
    this.pockets = Array.from({ length: POCKET_COUNT }, () => new Grid(1, 1));
  }

  get(slot: SlotName): Item | null {
    return this.slots.get(slot) ?? null;
  }

  /** Se o item é do tipo certo e o slot está vazio */
  canEquip(slot: SlotName, item: Item): boolean {
    return item.def.equipSlot === SLOTS[slot] && !this.slots.has(slot);
  }

  /** Equipa um item solto (`location === null`) */
  equip(slot: SlotName, item: Item): void {
    if (item.location !== null) {
      throw new Error(`O item ${item.uid} precisa ser removido antes`);
    }
    if (!this.canEquip(slot, item)) {
      throw new Error(`O item ${item.uid} não pode ir no slot ${slot}`);
    }
    this.slots.set(slot, item);
    item.location = { kind: "slot", equipment: this, slot };
  }

  /** Tira o item do slot, deixando-o solto */
  unequip(slot: SlotName): Item | null {
    const item = this.slots.get(slot);
    if (!item) return null;
    this.slots.delete(slot);
    item.location = null;
    return item;
  }

  /**
   * Grades onde o personagem carrega loot, na ordem de preferência:
   * bolsos, colete tático, mochila. O contêiner seguro fica de fora.
   */
  carryGrids(): Grid[] {
    return [
      ...this.pockets,
      ...(this.get("rig")?.grids ?? []),
      ...(this.get("backpack")?.grids ?? []),
    ];
  }

  /** Itens equipados nos slots */
  equipped(): Item[] {
    return SLOT_NAMES.flatMap((slot) => this.slots.get(slot) ?? []);
  }
}
