import { describe, expect, it } from "vitest";

import { durabilityOf } from "../../../src/core/inventory/durability.ts";
import { loadedRounds } from "../../../src/core/inventory/magazine.ts";
import { armorFactor, armorWear } from "../../../src/core/raid/combat.ts";
import type { Foe } from "../../../src/core/raid/simulate.ts";
import type {
  EnemyDef,
  EnemyGear,
  EnemyGearOption,
  EnemyWeapon,
} from "../../../src/core/raid/types.ts";
import { catalog } from "../../../src/data/items.ts";
import {
  TEST_ENEMIES,
  armedPlayer,
  emptyPlayer,
  makeSim,
} from "./raidFixtures.ts";

const RIFLE: EnemyWeapon = {
  weight: 1,
  weapon: "rifle_vk74",
  magazine: "mag_vk74",
  ammo: "ammo_545ap",
  ammoCount: [5, 20],
};
const SHOTGUN: EnemyWeapon = {
  weight: 1,
  weapon: "shotgun_m12",
  ammo: "ammo_12g",
  ammoCount: [0, 10],
};
const HEAVY: EnemyGearOption = { weight: 1, item: "armor_heavy" };
const NONE: EnemyGearOption = { weight: 1, item: null };
const K3: EnemyGearOption = { weight: 1, item: "helmet_k3" };

const GEAR: EnemyGear = {
  weapons: [RIFLE, SHOTGUN],
  armor: [HEAVY, NONE],
  helmet: [K3, NONE],
};

/** Inimigo de teste com equipamento de verdade */
const GEARED: EnemyDef = {
  ...TEST_ENEMIES.pmc,
  name: "PMC equipado",
  gear: GEAR,
};

describe("inimigos com equipamento de verdade", () => {
  it("sem gear, só sorteia a classe do colete", () => {
    const { sim } = makeSim(emptyPlayer());
    expect(sim.armEnemy(TEST_ENEMIES.pmc)).toEqual({
      def: TEST_ENEMIES.pmc,
      armorClass: 3,
      armor: null,
      gear: null,
    });
  });

  it("com gear, dano, penetração e disparos vêm da arma e da munição", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.weights = [RIFLE, HEAVY, K3];
    const foe = sim.armEnemy(GEARED);
    expect(foe.def).toMatchObject({ damage: 40, penetration: 38, burst: 3 });
    expect(foe.armorClass).toBe(4);
    expect(foe.armor).toEqual({
      def: catalog.get("armor_heavy"),
      durability: 60,
    });
    expect(foe.gear).toEqual({
      weapon: RIFLE,
      helmet: catalog.get("helmet_k3"),
    });

    rng.weights = [SHOTGUN, NONE, NONE];
    const bare = sim.armEnemy(GEARED);
    expect(bare.def).toMatchObject({ damage: 200, penetration: 3, burst: 1 });
    expect(bare.armorClass).toBe(0);
    expect(bare.armor).toBeNull();
    expect(bare.gear?.helmet).toBeNull();
  });

  it("o log do encontro mostra a arma e a classe do colete", () => {
    const { sim, rng } = makeSim(emptyPlayer(), {
      enemies: { ...TEST_ENEMIES, pmc: GEARED },
    });
    rng.weights = [RIFLE, HEAVY, NONE];
    rng.chances = [true];
    sim.fight("pmc");
    expect(sim.events[0].text).toBe(
      "Avistou PMC equipado com Fuzil VK-74 (colete classe 4)",
    );
  });
});

describe("colete do inimigo gasto pelos acertos", () => {
  it("cada acerto gasta o colete, e a proteção cai junto", () => {
    const { player } = armedPlayer();
    const { sim, rng } = makeSim(player);
    rng.defaultChance = true;
    const armor = { def: catalog.get("armor_heavy"), durability: 30 };
    // 2 disparos de 9mm (dano 54, pen. 18) contra classe 4 pela metade
    const dealt = sim.playerTurn(GEARED, 4, armor) as number;
    const first = 54 * (1 - (1 - armorFactor(18, 4)) * 0.5);
    const wear = armorWear(54, 18, 4);
    const second = 54 * (1 - (1 - armorFactor(18, 4)) * ((30 - wear) / 60));
    expect(dealt).toBeCloseTo(first + second);
    expect(armor.durability).toBeCloseTo(30 - 2 * wear);
  });

  it("quebrado, deixa passar tudo e não gasta mais", () => {
    const { player } = armedPlayer();
    const { sim, rng } = makeSim(player);
    rng.defaultChance = true;
    const armor = { def: catalog.get("armor_heavy"), durability: 0 };
    expect(sim.playerTurn(GEARED, 4, armor)).toBe(108);
    expect(armor.durability).toBe(0);
  });
});

describe("corpo revistado", () => {
  const foe = (over: Partial<Foe> = {}): Foe => ({
    def: GEARED,
    armorClass: 4,
    armor: { def: catalog.get("armor_heavy"), durability: 42 },
    gear: { weapon: RIFLE, helmet: catalog.get("helmet_k3") },
    ...over,
  });

  it("deixa a arma com o carregador, o colete gasto, o capacete e a munição", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.ints = [17, 75, 12];
    const [weapon, armor, helmet, ammo] = sim.bodyGear(foe());
    expect(weapon.def.id).toBe("rifle_vk74");
    expect(weapon.magazine?.def.id).toBe("mag_vk74");
    expect(loadedRounds(weapon.magazine!)).toBe(17);
    expect(armor.def.id).toBe("armor_heavy");
    expect(durabilityOf(armor)).toBe(42);
    expect(helmet.def.id).toBe("helmet_k3");
    expect(durabilityOf(helmet)).toBe(30);
    expect(ammo.def.id).toBe("ammo_545ap");
    expect(ammo.count).toBe(12);
  });

  it("escopeta com o tubo; peças inteiras sem durabilidade; sem munição solta", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.ints = [0, 100, 0];
    const items = sim.bodyGear(
      foe({
        armor: { def: catalog.get("armor_heavy"), durability: 60 },
        gear: { weapon: SHOTGUN, helmet: catalog.get("helmet_k3") },
      }),
    );
    expect(items.map((i) => i.def.id)).toEqual([
      "shotgun_m12",
      "armor_heavy",
      "helmet_k3",
    ]);
    expect(loadedRounds(items[0])).toBe(0);
    expect(items[1].durability).toBeUndefined();
    expect(items[2].durability).toBeUndefined();

    rng.ints = [4];
    const [shotgun] = sim.bodyGear(
      foe({ armor: null, gear: { weapon: SHOTGUN, helmet: null } }),
    );
    expect(loadedRounds(shotgun)).toBe(4);
    expect(sim.bodyGear(foe({ gear: null }))).toEqual([]);
  });

  it("ao abater e revistar, leva o item da tabela e o equipamento", () => {
    const player = emptyPlayer();
    player.inventory.equipment.equip(
      "backpack",
      player.factory.create("backpack_hiker"),
    );
    const { sim, rng } = makeSim(player);
    rng.chances = [true];
    rng.ints = [1, 1, 5];
    sim.won(
      GEARED,
      foe({ armor: null, gear: { weapon: RIFLE, helmet: null } }),
    );
    const found = sim.events
      .filter((e) => e.kind === "loot")
      .map((e) => e.text);
    expect(found).toEqual([
      "Encontrou Parafusos no corpo",
      "Encontrou Fuzil VK-74 no corpo",
      "Encontrou Cartucho 5.45 perfurante x5 no corpo",
    ]);
  });

  it("sem o inimigo sorteado, revista só a tabela do mapa", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.chances = [true];
    sim.won(TEST_ENEMIES.scav);
    expect(sim.events.filter((e) => e.kind === "loot")).toHaveLength(1);
  });
});
