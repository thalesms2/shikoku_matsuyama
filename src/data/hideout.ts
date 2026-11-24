import type {
  HideoutData,
  ModuleDef,
  RecipeDef,
} from "../core/hideout/types.ts";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export const HIDEOUT_MODULES: readonly ModuleDef[] = [
  {
    id: "generator",
    name: "Gerador",
    description:
      "Um gerador a diesel remendado. Dá energia para a oficina e para o rádio e acelera todas as produções.",
    levels: [
      {
        level: 1,
        cost: [
          { item: "money_rub", count: 30_000 },
          { item: "barter_bolts", count: 3 },
        ],
        requires: {},
        buildMs: 20 * MIN,
        effects: { productionSpeed: 0.1 },
      },
      {
        level: 2,
        cost: [
          { item: "money_rub", count: 100_000 },
          { item: "barter_goldchain", count: 2 },
        ],
        requires: { pmcLevel: 4 },
        buildMs: HOUR,
        effects: { productionSpeed: 0.2 },
      },
    ],
  },
  {
    id: "stash",
    name: "Depósito",
    description:
      "Prateleiras e caixas no fundo do esconderijo. Cada nível aumenta o estoque.",
    levels: [
      {
        level: 1,
        cost: [{ item: "money_rub", count: 50_000 }],
        requires: {},
        buildMs: 30 * MIN,
        effects: { stashRows: 3 },
      },
      {
        level: 2,
        cost: [
          { item: "money_rub", count: 150_000 },
          { item: "barter_bolts", count: 5 },
        ],
        requires: { modules: [{ module: "generator", level: 1 }] },
        buildMs: 2 * HOUR,
        effects: { stashRows: 6 },
      },
      {
        level: 3,
        cost: [
          { item: "money_rub", count: 400_000 },
          { item: "barter_goldchain", count: 2 },
        ],
        requires: {
          pmcLevel: 8,
          loyalty: { trader: "merchant", level: 2 },
        },
        buildMs: 6 * HOUR,
        effects: { stashRows: 10 },
      },
    ],
  },
  {
    id: "medstation",
    name: "Enfermaria",
    description:
      "Uma maca e um armário de remédios. Cura o PMC aos poucos entre as raids e, no nível 2, opera partes destruídas.",
    levels: [
      {
        level: 1,
        cost: [
          { item: "money_rub", count: 25_000 },
          { item: "med_bandage", count: 2 },
        ],
        requires: {},
        buildMs: 15 * MIN,
        effects: { healPerMinute: 1 },
      },
      {
        level: 2,
        cost: [
          { item: "money_rub", count: 80_000 },
          { item: "med_kit", count: 2 },
        ],
        requires: { modules: [{ module: "generator", level: 1 }] },
        buildMs: HOUR,
        // opera uma parte destruída a cada 30 min (sem kit cirúrgico)
        effects: { healPerMinute: 3, surgeryMinutes: 30 },
      },
    ],
  },
  {
    id: "kitchen",
    name: "Cozinha",
    description:
      "Fogareiro, panelas e um filtro de água. Recupera energia e hidratação entre as raids e ferve água potável.",
    levels: [
      {
        level: 1,
        cost: [
          { item: "money_rub", count: 20_000 },
          { item: "food_water", count: 2 },
        ],
        requires: {},
        buildMs: 15 * MIN,
        effects: { energyPerMinute: 0.5, hydrationPerMinute: 0.5 },
      },
      {
        level: 2,
        cost: [
          { item: "money_rub", count: 60_000 },
          { item: "food_can", count: 2 },
        ],
        requires: { modules: [{ module: "generator", level: 1 }] },
        buildMs: 45 * MIN,
        effects: { energyPerMinute: 1.5, hydrationPerMinute: 1.5 },
      },
    ],
  },
  {
    id: "workbench",
    name: "Oficina",
    description:
      "Bancada com ferramentas e uma prensa manual. Recarrega munição e monta peças a partir de sucata.",
    levels: [
      {
        level: 1,
        cost: [
          { item: "money_rub", count: 40_000 },
          { item: "barter_bolts", count: 4 },
        ],
        requires: { modules: [{ module: "generator", level: 1 }] },
        buildMs: 30 * MIN,
        effects: {},
      },
      {
        level: 2,
        cost: [
          { item: "money_rub", count: 90_000 },
          { item: "barter_gpu", count: 1 },
        ],
        requires: {
          modules: [{ module: "generator", level: 2 }],
          loyalty: { trader: "colonel", level: 2 },
        },
        buildMs: 90 * MIN,
        effects: {},
      },
    ],
  },
  {
    id: "intel",
    name: "Central de informantes",
    description:
      "Um rádio e uma rede de olheiros que vendem o que ouvem. Gera rublos com o tempo, até um limite.",
    levels: [
      {
        level: 1,
        cost: [
          { item: "money_rub", count: 60_000 },
          { item: "barter_goldchain", count: 1 },
        ],
        requires: { modules: [{ module: "generator", level: 1 }] },
        buildMs: HOUR,
        effects: { incomePerHour: 1500, incomeCap: 18_000 },
      },
      {
        level: 2,
        cost: [
          { item: "money_rub", count: 200_000 },
          { item: "barter_goldchain", count: 3 },
        ],
        requires: { modules: [{ module: "generator", level: 2 }] },
        buildMs: 3 * HOUR,
        effects: { incomePerHour: 4000, incomeCap: 48_000 },
      },
    ],
  },
  {
    id: "watchtower",
    name: "Posto de vigia",
    description:
      "Um telhado com binóculos e um mapa marcado. Com informação sobre a cidade, o Scav sai mais cedo.",
    levels: [
      {
        level: 1,
        cost: [
          { item: "money_rub", count: 35_000 },
          { item: "barter_bolts", count: 2 },
        ],
        requires: {},
        buildMs: 30 * MIN,
        effects: { scavCooldown: 0.15 },
      },
      {
        level: 2,
        cost: [
          { item: "money_rub", count: 120_000 },
          { item: "barter_gpu", count: 1 },
        ],
        requires: { modules: [{ module: "generator", level: 1 }] },
        buildMs: 2 * HOUR,
        effects: { scavCooldown: 0.3 },
      },
    ],
  },
];

export const RECIPES: readonly RecipeDef[] = [
  {
    id: "boil-water",
    module: "kitchen",
    moduleLevel: 1,
    inputs: [],
    output: { item: "food_water", count: 1 },
    durationMs: HOUR,
  },
  {
    id: "ammo-9mm",
    module: "workbench",
    moduleLevel: 1,
    inputs: [{ item: "barter_bolts", count: 1 }],
    output: { item: "ammo_9mm", count: 50 },
    durationMs: HOUR,
  },
  {
    id: "ammo-545",
    module: "workbench",
    moduleLevel: 1,
    inputs: [{ item: "barter_bolts", count: 2 }],
    output: { item: "ammo_545", count: 60 },
    durationMs: 2 * HOUR,
  },
  {
    id: "mag-vk74",
    module: "workbench",
    moduleLevel: 2,
    inputs: [{ item: "barter_bolts", count: 1 }],
    output: { item: "mag_vk74", count: 2 },
    durationMs: HOUR,
  },
  {
    id: "med-kit",
    module: "workbench",
    moduleLevel: 2,
    inputs: [
      { item: "med_bandage", count: 2 },
      { item: "food_water", count: 1 },
    ],
    output: { item: "med_kit", count: 1 },
    durationMs: 90 * MIN,
  },
];

export const HIDEOUT: HideoutData = {
  modules: HIDEOUT_MODULES,
  recipes: RECIPES,
};
