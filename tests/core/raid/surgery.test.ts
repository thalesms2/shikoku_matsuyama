import { describe, expect, it } from "vitest";

import { Catalog } from "../../../src/core/inventory/item.ts";
import { firstShotChance } from "../../../src/core/raid/combat.ts";
import { raidWarnings } from "../../../src/core/raid/profile.ts";
import {
  SURGERY_AMBUSH,
  SURPRISE_FIRST_SHOT,
} from "../../../src/core/raid/simulate.ts";
import { STRATEGIES } from "../../../src/core/raid/strategy.ts";
import { ITEM_DEFS } from "../../../src/data/items.ts";
import {
  TEST_ENEMIES,
  TEST_MAP,
  ScriptRng,
  armedPlayer,
  emptyPlayer,
  give,
  makeSim,
} from "./raidFixtures.ts";

/** Catálogo do jogo + um kit empilhável (para testar a pilha) */
const CATALOG = new Catalog([
  ...ITEM_DEFS,
  {
    id: "kit_stack",
    name: "Kit de teste",
    shortName: "K",
    category: "medical",
    width: 1,
    height: 1,
    maxStack: 3,
    basePrice: 1,
    stats: { surgery: 2 },
  },
]);

/** RNG que anota as probabilidades pedidas */
class SpyRng extends ScriptRng {
  asked: number[] = [];
  override chance(p?: number): boolean {
    this.asked.push(p ?? -1);
    return super.chance();
  }
}

describe("cirurgia na raid", () => {
  it("opera com o kit: leva o tempo do kit, consome e devolve 1 PV", () => {
    const { player } = armedPlayer();
    player.pmc.health.leftLeg = 0;
    const kit = give(player, "med_surgery");
    const { sim } = makeSim(player, {
      map: { ...TEST_MAP, threats: { scav: 0, pmc: 0 } },
    });
    sim.selfCare();
    expect(player.pmc.health.leftLeg).toBe(1);
    expect(kit.location).toBeNull();
    expect(sim.t).toBe(6);
    expect(sim.events.map((e) => e.text)).toEqual([
      "Começou a cirurgia: Perna esquerda (6 min)",
      "Cirurgia concluída: Perna esquerda recuperado",
    ]);
    expect(sim.events.every((e) => e.kind === "surgery")).toBe(true);
  });

  it("um kit por parte; pilha de kits diminui; sem kit não opera", () => {
    const player = emptyPlayer(CATALOG);
    player.inventory.equipment.equip("rig", player.factory.create("rig_cargo"));
    player.pmc.health.leftLeg = 0;
    player.pmc.health.rightArm = 0;
    player.pmc.health.rightLeg = 0;
    const stack = give(player, "kit_stack", 2);
    const { sim } = makeSim(player, {
      map: { ...TEST_MAP, threats: { scav: 0, pmc: 0 } },
    });
    sim.selfCare();
    expect(stack.location).toBeNull();
    expect(player.pmc.health.rightArm).toBe(1);
    expect(player.pmc.health.leftLeg).toBe(1);
    expect(player.pmc.health.rightLeg).toBe(0);
    expect(sim.t).toBe(4);
  });

  it("encontro surpresa: sem evitar, atira primeiro com metade da chance", () => {
    const { player } = armedPlayer();
    player.pmc.health.leftLeg = 0;
    give(player, "med_surgery");
    const rng = new SpyRng();
    // emboscada sim; depois o PMC atira primeiro e acerta tudo
    rng.chances = [true];
    rng.defaultChance = true;
    rng.weights.push("scav");
    const { sim } = makeSim(player, { rng, enemies: TEST_ENEMIES });
    sim.selfCare();
    expect(rng.asked[0]).toBeCloseTo(
      SURGERY_AMBUSH * STRATEGIES.balanced.encounter,
    );
    expect(sim.events.map((e) => e.text)).toContain(
      `${TEST_ENEMIES.scav.name} apareceu no meio da cirurgia!`,
    );
    // não houve sorteio para evitar a briga; o próximo foi o primeiro tiro
    expect(rng.asked[1]).toBeCloseTo(
      firstShotChance(player.skills, STRATEGIES.balanced.initiative) *
        SURPRISE_FIRST_SHOT,
    );
    expect(sim.kills.scav).toBe(1);
    expect(player.pmc.health.leftLeg).toBe(1);
  });

  it("morto na emboscada: a parte não volta", () => {
    const { player } = armedPlayer();
    player.pmc.health.leftLeg = 0;
    give(player, "med_surgery");
    const killer = {
      ...TEST_ENEMIES,
      pmc: {
        ...TEST_ENEMIES.pmc,
        health: 1e6,
        accuracy: 1,
        damage: 1e4,
        penetration: 100,
      },
    };
    const rng = new ScriptRng();
    rng.chances = [true, false];
    rng.defaultChance = true;
    rng.weights.push("pmc", "head");
    const { sim } = makeSim(player, { rng, enemies: killer });
    sim.selfCare();
    expect(sim.killedBy).toBe(killer.pmc.name);
    expect(player.pmc.health.leftLeg).toBe(0);
  });

  it("aviso antes da raid: parte destruída sem kit", () => {
    const { player } = armedPlayer();
    const { equipment } = player.inventory;
    equipment.equip("armor", player.factory.create("armor_civil"));
    equipment.equip("helmet", player.factory.create("helmet_tk1"));
    player.pmc.health.leftArm = 0;
    expect(raidWarnings(player)).toEqual([
      "Parte do corpo destruída e nenhum kit cirúrgico",
    ]);
    equipment.equip("secure", player.factory.create("secure_pouch"));
    equipment
      .get("secure")!
      .grids[0].place(player.factory.create("med_surgery"), 0, 0, false);
    expect(raidWarnings(player)).toEqual([]);
  });
});
