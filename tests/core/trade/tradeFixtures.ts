import { ManualClock } from "../../../src/core/clock.ts";
import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import { autoPlace } from "../../../src/core/inventory/operations.ts";
import { createPmc } from "../../../src/core/pmc/pmc.ts";
import { createSkills } from "../../../src/core/pmc/skills.ts";
import { createPlayerState } from "../../../src/core/state.ts";
import type { PlayerState } from "../../../src/core/state.ts";
import type { TraderDef } from "../../../src/core/trade/types.ts";
import { catalog } from "../../../src/data/items.ts";

export const HOUR = 3_600_000;

export const TEST_TRADER: TraderDef = {
  id: "test",
  name: "Vendedor de teste",
  specialty: "Testes",
  description: "Só para testes.",
  currency: "money_rub",
  levels: [
    {
      level: 1,
      minPmcLevel: 1,
      minReputation: 0,
      minVolume: 0,
      buyMarkup: 1.5,
      sellRate: 0.5,
    },
    {
      level: 2,
      minPmcLevel: 2,
      minReputation: 0.1,
      minVolume: 1000,
      buyMarkup: 1.2,
      sellRate: 0.6,
    },
  ],
  buys: { barter: 1, weapon: 0.5, container: 1, magazine: 1, ammo: 1 },
  restockMs: HOUR,
  offers: [
    { id: "bolts", item: "barter_bolts", level: 1, stock: 2 },
    { id: "ammo", item: "ammo_9mm", count: 50, level: 1, stock: 5 },
    {
      id: "gold",
      item: "barter_goldchain",
      level: 1,
      stock: 1,
      barter: [{ item: "barter_bolts", count: 2 }],
    },
    {
      id: "usd",
      item: "money_usd",
      count: 10,
      level: 1,
      stock: 3,
      price: 1500,
      currency: "money_rub",
    },
    { id: "gpu", item: "barter_gpu", level: 2, stock: 1 },
  ],
};

export const USD_TRADER: TraderDef = {
  ...TEST_TRADER,
  id: "usd",
  currency: "money_usd",
};

/** Jogador com estoque vazio do tamanho dado e o relógio em `now` */
export function trader(width = 10, height = 10, now = 0) {
  const clock = new ManualClock(now);
  const factory = new ItemFactory(catalog);
  const player: PlayerState = createPlayerState(
    {
      inventory: { stash: new Grid(width, height), equipment: new Equipment() },
      pmc: createPmc(),
      skills: createSkills(),
      factory,
    },
    clock,
  );
  const put = (id: string, count = 1, grid = player.inventory.stash): Item => {
    const item = factory.create(id, count);
    if (!autoPlace(item, [grid])) throw new Error(`Não coube: ${id}`);
    return item;
  };
  return { player, clock, factory, put };
}
