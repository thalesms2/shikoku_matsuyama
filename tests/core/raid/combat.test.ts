import { describe, expect, it } from "vitest";

import type { ItemDef } from "../../../src/core/inventory/item.ts";
import { createPmc } from "../../../src/core/pmc/pmc.ts";
import { createSkills, skillXpForLevel } from "../../../src/core/pmc/skills.ts";
import {
  ARM_PENALTY,
  BASE_HIT_CHANCE,
  HIT_ZONES,
  MAX_HIT_CHANCE,
  MIN_ARMOR_FACTOR,
  MIN_HIT_CHANCE,
  armorFactor,
  burstFor,
  enemyHitChance,
  firstShotChance,
  playerHitChance,
  protectedBy,
  vitalityFactor,
} from "../../../src/core/raid/combat.ts";
import { TEST_ENEMIES } from "./raidFixtures.ts";

describe("armorFactor", () => {
  it("sem armadura passa tudo", () => {
    expect(armorFactor(5, 0)).toBe(1);
  });

  it("penetração igual ou maior que classe × 10 passa inteira", () => {
    expect(armorFactor(30, 3)).toBe(1);
    expect(armorFactor(45, 3)).toBe(1);
  });

  it("abaixo, o dano cai na proporção, até o mínimo", () => {
    expect(armorFactor(15, 3)).toBeCloseTo(0.5);
    expect(armorFactor(1, 6)).toBe(MIN_ARMOR_FACTOR);
  });
});

describe("protectedBy", () => {
  it("capacete na cabeça, colete no tronco, nada nos membros", () => {
    expect(protectedBy("head")).toBe("helmet");
    expect(protectedBy("thorax")).toBe("armor");
    expect(protectedBy("stomach")).toBe("armor");
    expect(protectedBy("leftLeg")).toBeNull();
  });

  it("as zonas de acerto cobrem todas as partes", () => {
    expect(HIT_ZONES.map((z) => z.value)).toHaveLength(7);
    expect(HIT_ZONES.reduce((s, z) => s + z.weight, 0)).toBe(100);
  });
});

describe("chances", () => {
  it("acerto do PMC cresce com Mira e cai com braços destruídos", () => {
    const pmc = createPmc();
    const skills = createSkills();
    expect(playerHitChance(pmc, skills)).toBe(BASE_HIT_CHANCE);
    skills.aim = skillXpForLevel(50);
    expect(playerHitChance(pmc, skills)).toBeCloseTo(0.75);
    pmc.health.leftArm = 0;
    pmc.health.rightArm = 0;
    expect(playerHitChance(pmc, skills)).toBeCloseTo(0.75 - 2 * ARM_PENALTY);
    skills.aim = 0;
    pmc.health.leftArm = 0;
    expect(playerHitChance(pmc, skills)).toBeCloseTo(0.2);
  });

  it("acerto fica entre o mínimo e o máximo", () => {
    const enemy = { ...TEST_ENEMIES.scav, accuracy: 2 };
    expect(enemyHitChance(enemy, 1)).toBe(MAX_HIT_CHANCE);
    expect(enemyHitChance({ ...enemy, accuracy: -1 }, 1)).toBe(MIN_HIT_CHANCE);
  });

  it("inimigos acertam mais em mapas difíceis", () => {
    const enemy = TEST_ENEMIES.scav;
    expect(enemyHitChance(enemy, 1)).toBe(0.5);
    expect(enemyHitChance(enemy, 3)).toBeCloseTo(0.56);
    expect(enemyHitChance(enemy, 0)).toBe(0.5);
  });

  it("primeiro tiro: estratégia e Percepção, no máximo 90%", () => {
    const skills = createSkills();
    expect(firstShotChance(skills, 0.1)).toBeCloseTo(0.6);
    skills.perception = skillXpForLevel(20);
    expect(firstShotChance(skills, 0)).toBeCloseTo(0.6);
    expect(firstShotChance(skills, 1)).toBe(0.9);
  });

  it("Vitalidade reduz o dano recebido pela metade do bônus", () => {
    const skills = createSkills();
    expect(vitalityFactor(skills)).toBe(1);
    skills.vitality = skillXpForLevel(20);
    expect(vitalityFactor(skills)).toBeCloseTo(0.9);
  });
});

describe("burstFor", () => {
  const def = (extra: Partial<ItemDef>) =>
    ({ id: "w", category: "weapon", ...extra }) as ItemDef;

  it("escopeta 1, fuzil 3, pistola 2", () => {
    expect(
      burstFor(
        def({ equipSlot: "longWeapon", stats: { caliber: "Caliber12g" } }),
      ),
    ).toBe(1);
    expect(burstFor(def({ equipSlot: "longWeapon" }))).toBe(3);
    expect(burstFor(def({ equipSlot: "pistol" }))).toBe(2);
  });
});
