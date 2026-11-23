import type { DatabaseSync } from "node:sqlite";

import type { ApiItem } from "../../../scripts/items/api.ts";
import { openDb } from "../../../scripts/items/db.ts";

/** Item da API com valores padrão, para os testes */
export function apiItem(partial: Partial<ApiItem> & { id: string }): ApiItem {
  return {
    name: `Item ${partial.id}`,
    shortName: partial.id.toUpperCase(),
    width: 1,
    height: 1,
    basePrice: 100,
    types: ["barter"],
    category: { normalizedName: "barter-item" },
    gridImageLink: `https://assets.example/${partial.id}-grid-image.webp`,
    properties: null,
    ...partial,
  };
}

/** Respostas da API gravadas: um item de cada tipo relevante */
export const API_ITEMS: ApiItem[] = [
  apiItem({
    id: "src-rifle",
    name: "Fuzil de teste",
    width: 2,
    height: 1,
    basePrice: 30000,
    types: ["gun", "wearable"],
    category: { normalizedName: "assault-rifle" },
    properties: {
      __typename: "ItemPropertiesWeapon",
      caliber: "Caliber545x39",
      defaultWidth: 4,
      defaultHeight: 2,
    },
  }),
  apiItem({
    id: "src-pistol",
    name: "Pistola de teste",
    width: 2,
    height: 1,
    types: ["gun"],
    category: { normalizedName: "handgun" },
    properties: {
      __typename: "ItemPropertiesWeapon",
      caliber: "Caliber9x19PARA",
    },
  }),
  apiItem({
    id: "src-ammo",
    name: "Cartucho de teste",
    basePrice: 80,
    types: ["ammo"],
    category: { normalizedName: "ammo" },
    properties: {
      __typename: "ItemPropertiesAmmo",
      caliber: "Caliber545x39",
      stackMaxSize: 60,
      damage: 50,
      penetrationPower: 30,
    },
  }),
  apiItem({
    id: "src-mag",
    name: "Carregador de teste",
    width: 1,
    height: 2,
    types: ["mods"],
    category: { normalizedName: "magazine" },
    properties: { __typename: "ItemPropertiesMagazine", capacity: 30 },
  }),
  apiItem({
    id: "src-bag",
    name: "Mochila de teste",
    width: 3,
    height: 3,
    types: ["backpack", "wearable"],
    category: { normalizedName: "backpack" },
    properties: {
      __typename: "ItemPropertiesBackpack",
      grids: [{ width: 4, height: 4 }, { width: "x" }, null],
    },
  }),
  apiItem({
    id: "src-rig",
    name: "Colete de teste",
    width: 2,
    height: 3,
    types: ["rig", "armor", "wearable"],
    category: { normalizedName: "chest-rig" },
    properties: {
      __typename: "ItemPropertiesChestRig",
      class: 3,
      durability: 40,
      grids: [
        { width: 1, height: 2 },
        { width: 1, height: 1 },
      ],
    },
  }),
  apiItem({
    id: "src-helmet",
    name: "Capacete de teste",
    width: 2,
    height: 2,
    types: ["helmet", "armor", "wearable"],
    category: { normalizedName: "headwear" },
    properties: {
      __typename: "ItemPropertiesHelmet",
      class: 2,
      durability: 30,
    },
  }),
  apiItem({
    id: "src-armor",
    name: "Colete balístico de teste",
    width: 3,
    height: 3,
    types: ["armor", "wearable"],
    category: { normalizedName: "armor" },
    properties: { __typename: "ItemPropertiesArmor", class: 4, durability: 60 },
  }),
  apiItem({
    id: "src-box",
    name: "Caixa de teste",
    width: 2,
    height: 2,
    types: ["container"],
    category: { normalizedName: "common-container" },
    properties: {
      __typename: "ItemPropertiesContainer",
      grids: [{ width: 5, height: 5 }],
    },
  }),
  apiItem({
    id: "src-med",
    name: "Remédio de teste",
    types: ["meds"],
    category: null,
  }),
  apiItem({ id: "src-food", name: "Comida de teste", types: ["provisions"] }),
  apiItem({
    id: "src-key",
    name: "Chave de teste",
    types: ["keys"],
    gridImageLink: null,
  }),
  apiItem({ id: "src-junk", name: "Sucata de teste" }),
  apiItem({
    id: "src-money",
    name: "Dinheiro de teste",
    types: ["barter"],
    category: { normalizedName: "money" },
  }),
];

/** Banco em memória com o schema criado */
export function memoryDb(): DatabaseSync {
  return openDb(":memory:");
}

/** `fetch` falso que responde com o corpo JSON e o status dados */
export function jsonFetch(body: unknown, status = 200) {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
}
