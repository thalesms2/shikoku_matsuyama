import { Catalog, ItemFactory } from "../../../src/core/inventory/item.ts";
import type { ItemDef } from "../../../src/core/inventory/item.ts";

/** Itens de teste para carregadores e armas */
export const MAG_DEFS: ItemDef[] = [
  {
    id: "rifle",
    name: "Fuzil",
    shortName: "F",
    category: "weapon",
    width: 4,
    height: 2,
    basePrice: 1000,
    equipSlot: "longWeapon",
    stats: { caliber: "C545" },
  },
  {
    id: "pistol",
    name: "Pistola",
    shortName: "P",
    category: "weapon",
    width: 2,
    height: 1,
    basePrice: 500,
    equipSlot: "pistol",
    stats: { caliber: "C9" },
  },
  {
    id: "mag",
    name: "Carregador 545",
    shortName: "M",
    category: "magazine",
    width: 1,
    height: 2,
    basePrice: 100,
    stats: { caliber: "C545", capacity: 30 },
  },
  {
    id: "mag9",
    name: "Carregador 9",
    shortName: "M9",
    category: "magazine",
    width: 1,
    height: 1,
    basePrice: 50,
    stats: { caliber: "C9", capacity: 12 },
  },
  {
    id: "fmj",
    name: "545 FMJ",
    shortName: "FMJ",
    category: "ammo",
    width: 1,
    height: 1,
    maxStack: 60,
    basePrice: 2,
    stats: { caliber: "C545" },
  },
  {
    id: "ap",
    name: "545 AP",
    shortName: "AP",
    category: "ammo",
    width: 1,
    height: 1,
    maxStack: 60,
    basePrice: 5,
    stats: { caliber: "C545" },
  },
  {
    id: "nine",
    name: "9mm",
    shortName: "9",
    category: "ammo",
    width: 1,
    height: 1,
    maxStack: 50,
    basePrice: 1,
    stats: { caliber: "C9" },
  },
  {
    id: "rock",
    name: "Pedra",
    shortName: "R",
    category: "barter",
    width: 1,
    height: 1,
    basePrice: 1,
  },
];

export function magSetup() {
  const factory = new ItemFactory(new Catalog(MAG_DEFS));
  return { factory, make: factory.create.bind(factory) };
}
