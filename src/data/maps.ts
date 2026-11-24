import type { EnemyDef, EnemyKind, MapDef } from "../core/raid/types.ts";

/** Inimigos controlados pela simulação */
export const ENEMIES: Readonly<Record<EnemyKind, EnemyDef>> = {
  scav: {
    kind: "scav",
    name: "um Scav",
    health: 110,
    accuracy: 0.13,
    // Dano, penetração, disparos e colete vêm do equipamento (`gear`)
    damage: 0,
    penetration: 0,
    armorClasses: [0],
    burst: 0,
    gear: {
      weapons: [
        {
          weight: 3,
          weapon: "pistol_pk9",
          magazine: "mag_pk9",
          ammo: "ammo_9mm",
          ammoCount: [0, 12],
        },
        {
          weight: 1.5,
          weapon: "rifle_vk74",
          magazine: "mag_vk74",
          ammo: "ammo_545",
          ammoCount: [0, 20],
        },
      ],
      armor: [
        { weight: 5, item: null },
        { weight: 2, item: "armor_civil" },
      ],
      helmet: [
        { weight: 6, item: null },
        { weight: 2, item: "helmet_tk1" },
      ],
    },
  },
  pmc: {
    kind: "pmc",
    name: "um PMC inimigo",
    health: 160,
    accuracy: 0.42,
    damage: 0,
    penetration: 0,
    armorClasses: [0],
    burst: 0,
    gear: {
      weapons: [
        {
          weight: 2,
          weapon: "rifle_vk74",
          magazine: "mag_vk74",
          ammo: "ammo_545",
          ammoCount: [10, 40],
        },
        {
          weight: 2,
          weapon: "rifle_vk74",
          magazine: "mag_vk74",
          ammo: "ammo_545ap",
          ammoCount: [10, 40],
        },
      ],
      armor: [
        { weight: 2, item: "armor_civil" },
        { weight: 2, item: "armor_heavy" },
      ],
      helmet: [
        { weight: 1, item: null },
        { weight: 2, item: "helmet_tk1" },
        { weight: 2, item: "helmet_k3" },
      ],
    },
  },
};

export const MAPS: readonly MapDef[] = [
  {
    id: "outskirts",
    name: "Periferia Norte",
    description:
      "Conjuntos habitacionais abandonados na saída da cidade. Muitos Scavs, pouca gente armada de verdade.",
    difficulty: 1,
    duration: 30,
    threats: { scav: 1.2, pmc: 0.3 },
    loot: [
      { item: "money_rub", weight: 6, min: 300, max: 3000 },
      { item: "barter_bolts", weight: 6 },
      { item: "food_can", weight: 4 },
      { item: "food_water", weight: 3 },
      { item: "med_bandage", weight: 4 },
      { item: "ammo_9mm", weight: 3, min: 5, max: 20 },
      { item: "ammo_545", weight: 2, min: 5, max: 20 },
      { item: "ammo_12g", weight: 2, min: 3, max: 10 },
      { item: "med_kit", weight: 1 },
      { item: "barter_goldchain", weight: 1 },
      { item: "mag_pk9", weight: 1 },
    ],
    extracts: [
      { id: "gas-station", name: "Estrada do Posto", risk: 0.15 },
      {
        id: "service-tunnel",
        name: "Túnel de Serviço",
        risk: 0.03,
        requirement: { kind: "key", item: "key_garage" },
      },
    ],
  },
  {
    id: "cement",
    name: "Cimenteira",
    description:
      "Fábrica de cimento fechada, apertada e escura. As brigas são curtas e quase sempre contra outros PMCs.",
    difficulty: 2,
    duration: 25,
    threats: { scav: 0.7, pmc: 0.9 },
    loot: [
      { item: "barter_bolts", weight: 7 },
      { item: "money_rub", weight: 4, min: 500, max: 4000 },
      { item: "ammo_545", weight: 4, min: 10, max: 30 },
      { item: "mag_vk74", weight: 2 },
      { item: "med_bandage", weight: 3 },
      { item: "med_kit", weight: 2 },
      { item: "food_water", weight: 2 },
      { item: "barter_goldchain", weight: 1.5 },
      { item: "barter_gpu", weight: 0.4 },
    ],
    extracts: [
      { id: "main-gate", name: "Portão Principal", risk: 0.25 },
      {
        id: "vent-shaft",
        name: "Duto de Ventilação",
        risk: 0.05,
        requirement: { kind: "noBackpack" },
      },
    ],
  },
  {
    id: "harbor",
    name: "Porto Velho",
    description:
      "Armazéns e contêineres no cais. Loot valioso, terreno aberto e atiradores de todos os lados.",
    difficulty: 3,
    duration: 40,
    threats: { scav: 1, pmc: 0.8 },
    loot: [
      { item: "money_rub", weight: 6, min: 1000, max: 8000 },
      { item: "barter_goldchain", weight: 3 },
      { item: "barter_bolts", weight: 4 },
      { item: "ammo_545", weight: 3, min: 10, max: 30 },
      { item: "med_kit", weight: 2 },
      { item: "food_can", weight: 2 },
      { item: "food_water", weight: 2 },
      { item: "barter_gpu", weight: 1 },
      { item: "ammo_case", weight: 0.3 },
    ],
    extracts: [
      { id: "south-pier", name: "Cais Sul", risk: 0.2 },
      {
        id: "smuggler-boat",
        name: "Barco do Contrabandista",
        risk: 0.05,
        requirement: { kind: "payment", item: "money_rub", amount: 7000 },
      },
    ],
  },
];

export function mapById(id: string): MapDef | null {
  return MAPS.find((m) => m.id === id) ?? null;
}
