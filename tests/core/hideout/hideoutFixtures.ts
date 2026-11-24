import type { HideoutData } from "../../../src/core/hideout/types.ts";

export const MIN = 60_000;
export const HOUR = 60 * MIN;

/** Esconderijo pequeno para testes */
export const TEST_HIDEOUT: HideoutData = {
  modules: [
    {
      id: "power",
      name: "Energia",
      description: "",
      levels: [
        {
          level: 1,
          cost: [{ item: "money_rub", count: 1000 }],
          requires: {},
          buildMs: 10 * MIN,
          effects: { productionSpeed: 0.5 },
        },
      ],
    },
    {
      id: "store",
      name: "Depósito",
      description: "",
      levels: [
        {
          level: 1,
          cost: [{ item: "barter_bolts", count: 2 }],
          requires: {},
          buildMs: HOUR,
          effects: { stashRows: 2, healPerMinute: 1 },
        },
        {
          level: 2,
          cost: [],
          requires: {
            modules: [{ module: "power", level: 1 }],
            loyalty: { trader: "doctor", level: 2 },
            pmcLevel: 3,
          },
          buildMs: HOUR,
          effects: {
            stashRows: 5,
            healPerMinute: 2,
            energyPerMinute: 1,
            hydrationPerMinute: 1,
          },
        },
      ],
    },
    {
      id: "radio",
      name: "Rádio",
      description: "",
      levels: [
        {
          level: 1,
          cost: [],
          requires: {},
          buildMs: HOUR,
          effects: { incomePerHour: 1000, incomeCap: 3000, scavCooldown: 0.2 },
        },
        {
          level: 2,
          cost: [],
          requires: {},
          buildMs: HOUR,
          effects: { incomePerHour: 2000, incomeCap: 6000 },
        },
      ],
    },
  ],
  recipes: [
    {
      id: "water",
      module: "power",
      moduleLevel: 1,
      inputs: [],
      output: { item: "food_water", count: 1 },
      durationMs: HOUR,
    },
    {
      id: "ammo",
      module: "power",
      moduleLevel: 1,
      inputs: [{ item: "barter_bolts", count: 1 }],
      output: { item: "ammo_9mm", count: 120 },
      durationMs: 2 * HOUR,
    },
    {
      id: "late",
      module: "store",
      moduleLevel: 2,
      inputs: [],
      output: { item: "barter_bolts", count: 1 },
      durationMs: HOUR,
    },
  ],
};
