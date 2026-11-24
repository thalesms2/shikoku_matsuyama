import { ManualClock } from "../../../src/core/clock.ts";
import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import type { Catalog, Item } from "../../../src/core/inventory/item.ts";
import {
  attachMagazine,
  loadRounds,
} from "../../../src/core/inventory/magazine.ts";
import { autoPlace } from "../../../src/core/inventory/operations.ts";
import { createPmc } from "../../../src/core/pmc/pmc.ts";
import { createSkills } from "../../../src/core/pmc/skills.ts";
import { RaidSimulation } from "../../../src/core/raid/simulate.ts";
import type { RaidSetup } from "../../../src/core/raid/simulate.ts";
import type {
  EnemyDef,
  EnemyKind,
  MapDef,
} from "../../../src/core/raid/types.ts";
import { Rng } from "../../../src/core/rng.ts";
import { createPlayerState } from "../../../src/core/state.ts";
import type { PlayerState } from "../../../src/core/state.ts";
import { catalog as gameCatalog } from "../../../src/data/items.ts";

/**
 * RNG com respostas roteirizadas: cada fila é consumida em ordem e, quando
 * acaba, usa o padrão (chance = `defaultChance`, int = mínimo, pick = o
 * primeiro, weighted = o primeiro com peso positivo, next = `nextValue`).
 */
export class ScriptRng extends Rng {
  chances: boolean[] = [];
  defaultChance = false;
  ints: number[] = [];
  weights: unknown[] = [];
  picks: unknown[] = [];
  nextValue = 0;

  constructor() {
    super(1);
  }

  override next(): number {
    return this.nextValue;
  }

  override chance(): boolean {
    return this.chances.length > 0 ? this.chances.shift()! : this.defaultChance;
  }

  override int(min: number): number {
    return this.ints.length > 0 ? this.ints.shift()! : min;
  }

  override pick<T>(items: readonly T[]): T {
    return this.picks.length > 0 ? (this.picks.shift() as T) : items[0];
  }

  override weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    if (this.weights.length > 0) return this.weights.shift() as T;
    return entries.find((e) => e.weight > 0)!.value;
  }
}

export const TEST_ENEMIES: Record<EnemyKind, EnemyDef> = {
  scav: {
    kind: "scav",
    name: "Scav de teste",
    health: 50,
    accuracy: 0.5,
    damage: 20,
    penetration: 10,
    armorClasses: [0],
    burst: 1,
  },
  pmc: {
    kind: "pmc",
    name: "PMC de teste",
    health: 100,
    accuracy: 0.5,
    damage: 30,
    penetration: 30,
    armorClasses: [3],
    burst: 2,
  },
};

export const TEST_MAP: MapDef = {
  id: "test",
  name: "Mapa de teste",
  description: "",
  difficulty: 1,
  duration: 30,
  threats: { scav: 1, pmc: 1 },
  loot: [{ item: "barter_bolts", weight: 1 }],
  extracts: [{ id: "exit", name: "Saída", risk: 0 }],
};

/** Jogador sem nada equipado e com estoque vazio */
export function emptyPlayer(
  catalog: Catalog = gameCatalog,
  clock = new ManualClock(),
): PlayerState {
  return createPlayerState(
    {
      inventory: { stash: new Grid(10, 10), equipment: new Equipment() },
      pmc: createPmc(),
      skills: createSkills(),
      factory: new ItemFactory(catalog),
    },
    clock,
  );
}

/** Pistola com carregador cheio (12) no coldre e colete tático vazio */
export function armedPlayer(): { player: PlayerState; pistol: Item } {
  const player = emptyPlayer();
  const { factory } = player;
  const { equipment } = player.inventory;
  const pistol = factory.create("pistol_pk9");
  const mag = factory.create("mag_pk9");
  loadRounds(mag, factory.create("ammo_9mm", 12));
  attachMagazine(pistol, mag);
  equipment.equip("holster", pistol);
  equipment.equip("rig", factory.create("rig_cargo"));
  return { player, pistol };
}

/** Coloca um item novo no equipamento (bolsos, colete, mochila) */
export function give(player: PlayerState, id: string, count = 1): Item {
  const item = player.factory.create(id, count);
  if (!autoPlace(item, player.inventory.equipment.carryGrids())) {
    throw new Error(`Não coube: ${id}`);
  }
  return item;
}

export function makeSim(
  player: PlayerState,
  setup: Partial<RaidSetup> = {},
): { sim: RaidSimulation; rng: ScriptRng } {
  const rng = (setup.rng as ScriptRng | undefined) ?? new ScriptRng();
  const sim = new RaidSimulation({
    player,
    map: TEST_MAP,
    strategy: "balanced",
    enemies: TEST_ENEMIES,
    lootRule: "valuePerCell",
    ...setup,
    rng,
  });
  return { sim, rng };
}

export const kinds = (sim: RaidSimulation) => sim.events.map((e) => e.kind);
