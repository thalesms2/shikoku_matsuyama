import { Equipment } from "../core/inventory/equipment.ts";
import { Grid } from "../core/inventory/grid.ts";
import type { ItemFactory } from "../core/inventory/item.ts";
import { attachMagazine, loadRounds } from "../core/inventory/magazine.ts";
import { autoPlace } from "../core/inventory/operations.ts";
import type { InventoryState } from "../core/state.ts";

/** Tamanho inicial do estoque do esconderijo, em células */
export const STASH_WIDTH = 10;
export const STASH_HEIGHT = 14;

export type { InventoryState } from "../core/state.ts";

/** Itens iniciais no estoque: [id, quantidade] */
export const STASH_ITEMS: readonly [string, number][] = [
  ["rifle_vk74", 1],
  ["shotgun_m12", 1],
  ["armor_civil", 1],
  ["helmet_tk1", 1],
  ["backpack_hiker", 1],
  ["ammo_case", 1],
  ["ammo_545", 60],
  ["ammo_545", 35],
  ["ammo_12g", 20],
  ["ammo_9mm", 50],
  ["med_kit", 1],
  ["med_bandage", 1],
  ["med_bandage", 1],
  ["food_water", 1],
  ["food_can", 1],
  ["barter_bolts", 1],
  ["barter_goldchain", 1],
  ["key_garage", 1],
  ["mag_vk74", 1],
  ["mag_vk74", 1],
  ["money_rub", 150000],
];

/** Monta o inventário inicial do jogador: estoque + equipamento básico */
export function createStarterInventory(
  factory: ItemFactory,
  stashItems: readonly [string, number][] = STASH_ITEMS,
): InventoryState {
  const stash = new Grid(STASH_WIDTH, STASH_HEIGHT);
  const equipment = new Equipment();

  const pistol = factory.create("pistol_pk9");
  equipment.equip("holster", pistol);
  const pistolMag = factory.create("mag_pk9");
  loadRounds(pistolMag, factory.create("ammo_9mm", 12));
  attachMagazine(pistol, pistolMag);
  equipment.equip("rig", factory.create("rig_cargo"));
  equipment.equip("backpack", factory.create("backpack_sack"));
  equipment.equip("secure", factory.create("secure_pouch"));

  autoPlace(factory.create("ammo_9mm", 30), equipment.carryGrids());
  autoPlace(factory.create("med_bandage"), equipment.carryGrids());

  for (const [id, count] of stashItems) {
    if (!autoPlace(factory.create(id, count), [stash])) {
      throw new Error(`Item inicial não coube no estoque: ${id}`);
    }
  }

  const ammoCase = stash.items().find((i) => i.def.id === "ammo_case");
  if (ammoCase) autoPlace(factory.create("ammo_545", 60), ammoCase.grids);

  return { stash, equipment };
}
