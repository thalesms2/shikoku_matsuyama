import { generateMatrix } from "../core/matrix/matrix.ts";
import type { MatrixMap, MatrixMapDef } from "../core/matrix/types.ts";
import { Rng } from "../core/rng.ts";

/**
 * Receitas dos mapas da raid em matriz (os mesmos mapas da raid atual). A
 * mesma receita sempre gera o mesmo mapa; o editor de mapas (12J) poderá
 * trocar o resultado.
 */
export const MATRIX_MAP_DEFS: readonly MatrixMapDef[] = [
  {
    id: "outskirts",
    name: "Periferia Norte",
    difficulty: 1,
    seed: 1101,
    terrain: { road: 5, grass: 3, building: 2, rubble: 1 },
    containers: {
      jacket: 4,
      drawer: 4,
      crate: 3,
      cashRegister: 2,
      sportsBag: 2,
      medbag: 2,
      toolbox: 2,
      deadBody: 1,
      suitcase: 1,
    },
    pois: [
      {
        id: "pharmacy",
        name: "Farmácia",
        obvious: true,
        containers: ["medbag", "medbag", "cashRegister"],
      },
      {
        id: "apartments",
        name: "Apartamentos",
        obvious: false,
        containers: ["drawer", "jacket", "suitcase", "pcBlock"],
      },
    ],
    extracts: [
      { id: "gas-station", name: "Estrada do Posto" },
      {
        id: "service-tunnel",
        name: "Túnel de Serviço",
        requirement: { kind: "key", item: "key_garage" },
      },
    ],
  },
  {
    id: "cement",
    name: "Cimenteira",
    difficulty: 2,
    seed: 2202,
    terrain: { road: 3, metal: 3, rubble: 3, building: 2, grass: 1 },
    containers: {
      toolbox: 4,
      crate: 4,
      drawer: 2,
      ammoBox: 2,
      deadBody: 2,
      jacket: 2,
      pcBlock: 1,
      groundCache: 1,
      supplyCrate: 1,
    },
    pois: [
      {
        id: "workshop",
        name: "Oficina",
        obvious: true,
        containers: ["toolbox", "toolbox", "crate", "weaponBox"],
      },
      {
        id: "office",
        name: "Escritório da fábrica",
        obvious: false,
        containers: ["pcBlock", "drawer", "safe"],
      },
      {
        id: "infirmary",
        name: "Enfermaria",
        obvious: false,
        containers: ["medbag", "medbag", "drawer"],
      },
    ],
    extracts: [
      { id: "main-gate", name: "Portão Principal" },
      {
        id: "vent-shaft",
        name: "Duto de Ventilação",
        requirement: { kind: "noBackpack" },
      },
    ],
  },
  {
    id: "harbor",
    name: "Porto Velho",
    difficulty: 3,
    seed: 3303,
    terrain: { road: 3, metal: 4, building: 2, rubble: 2, grass: 1 },
    containers: {
      crate: 4,
      supplyCrate: 3,
      ammoBox: 2,
      deadBody: 2,
      suitcase: 2,
      toolbox: 2,
      grenadeBox: 1,
      groundCache: 1,
      buriedBarrel: 1,
      weaponBox: 1,
    },
    pois: [
      {
        id: "military",
        name: "Posto militar",
        obvious: true,
        containers: ["weaponBox", "ammoBox", "grenadeBox", "supplyCrate"],
      },
      {
        id: "customs",
        name: "Alfândega",
        obvious: true,
        containers: ["safe", "suitcase", "pcBlock"],
      },
      {
        id: "hospital-ship",
        name: "Navio-hospital",
        obvious: false,
        containers: ["medbag", "medbag", "supplyCrate", "deadBody"],
      },
      {
        id: "smugglers",
        name: "Depósito dos contrabandistas",
        obvious: false,
        containers: ["safe", "buriedBarrel", "crate"],
      },
    ],
    extracts: [
      { id: "south-pier", name: "Cais Sul" },
      {
        id: "smuggler-boat",
        name: "Barco do Contrabandista",
        requirement: { kind: "payment", item: "money_rub", amount: 7000 },
      },
    ],
  },
];

/** Os mapas gerados a partir das receitas */
export const MATRIX_MAPS: readonly MatrixMap[] = MATRIX_MAP_DEFS.map((def) =>
  generateMatrix(def, new Rng(def.seed)),
);

export function matrixMapById(id: string): MatrixMap | null {
  return MATRIX_MAPS.find((m) => m.id === id) ?? null;
}
