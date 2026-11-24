import type { ScavLoadout } from "../core/raid/types.ts";

/** Equipamento aleatório do Scav (pesos relativos em cada lista) */
export const SCAV_LOADOUT: ScavLoadout = {
  weapons: [
    {
      weapon: "pistol_pk9",
      magazine: "mag_pk9",
      ammo: "ammo_9mm",
      weight: 5,
      spareMags: [0, 1],
      looseAmmo: [0, 15],
    },
    {
      weapon: "rifle_vk74",
      magazine: "mag_vk74",
      ammo: "ammo_545",
      weight: 3,
      spareMags: [0, 1],
      looseAmmo: [0, 20],
    },
  ],
  gear: {
    rig: [
      { item: null, weight: 4 },
      { item: "rig_cargo", weight: 3 },
    ],
    backpack: [
      { item: null, weight: 5 },
      { item: "backpack_sack", weight: 3 },
      { item: "backpack_hiker", weight: 0.5 },
    ],
    armor: [
      { item: null, weight: 8 },
      { item: "armor_civil", weight: 1 },
    ],
    helmet: [
      { item: null, weight: 6 },
      { item: "helmet_tk1", weight: 2 },
    ],
  },
  extras: [
    { item: "med_bandage", weight: 4 },
    { item: "food_can", weight: 3 },
    { item: "food_water", weight: 3 },
    { item: "barter_bolts", weight: 3 },
    { item: "money_rub", weight: 3, min: 100, max: 1500 },
    { item: "med_kit", weight: 0.5 },
    { item: "key_garage", weight: 0.3 },
  ],
  extraRolls: [0, 2],
};
