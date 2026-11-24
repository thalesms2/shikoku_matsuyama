import { Catalog, ItemFactory } from "../../../src/core/inventory/item.ts";
import type { ItemDef } from "../../../src/core/inventory/item.ts";
import { MAG_DEFS } from "./magFixtures.ts";

/** Itens de teste das armas com tubo: escopeta, cartuchos e um carregador 12 */
export const TUBE_DEFS: ItemDef[] = [
  {
    id: "shotgun",
    name: "Escopeta",
    shortName: "E",
    category: "weapon",
    width: 4,
    height: 1,
    basePrice: 800,
    equipSlot: "longWeapon",
    stats: { caliber: "C12", capacity: 4 },
  },
  {
    id: "buck",
    name: "Chumbo",
    shortName: "CH",
    category: "ammo",
    width: 1,
    height: 1,
    maxStack: 20,
    basePrice: 3,
    stats: { caliber: "C12" },
  },
  {
    id: "slug",
    name: "Balote",
    shortName: "BA",
    category: "ammo",
    width: 1,
    height: 1,
    maxStack: 20,
    basePrice: 7,
    stats: { caliber: "C12" },
  },
  {
    id: "mag12",
    name: "Carregador 12",
    shortName: "M12",
    category: "magazine",
    width: 1,
    height: 1,
    basePrice: 40,
    stats: { caliber: "C12", capacity: 8 },
  },
];

/** Fábrica com os itens de carregador e os de tubo */
export function chamberSetup() {
  const factory = new ItemFactory(new Catalog([...MAG_DEFS, ...TUBE_DEFS]));
  return { factory, make: factory.create.bind(factory) };
}
