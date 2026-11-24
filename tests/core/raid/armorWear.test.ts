import { describe, expect, it } from "vitest";

import { durabilityOf } from "../../../src/core/inventory/durability.ts";
import {
  ARMOR_WEAR,
  armorFactor,
  armorWear,
  wornArmorFactor,
} from "../../../src/core/raid/combat.ts";
import { TEST_ENEMIES, armedPlayer, makeSim } from "./raidFixtures.ts";

describe("armadura gasta", () => {
  it("protege na proporção da durabilidade", () => {
    expect(wornArmorFactor(10, 2, 1)).toBe(armorFactor(10, 2));
    expect(wornArmorFactor(10, 2, 0)).toBe(1);
    expect(wornArmorFactor(10, 2, 0.5)).toBeCloseTo(0.75);
  });

  it("desgaste pela metade contra munição fraca, inteiro contra forte", () => {
    expect(armorWear(40, 0, 2)).toBeCloseTo(40 * ARMOR_WEAR * 0.5);
    expect(armorWear(40, 10, 2)).toBeCloseTo(40 * ARMOR_WEAR * 0.75);
    expect(armorWear(40, 50, 2)).toBeCloseTo(40 * ARMOR_WEAR);
    expect(armorWear(40, 5, 0)).toBeCloseTo(40 * ARMOR_WEAR);
  });

  it("na raid, o acerto no colete gasta e avisa quando quebra", () => {
    const { player } = armedPlayer();
    const armor = player.factory.create("armor_civil");
    player.inventory.equipment.equip("armor", armor);
    const { sim, rng } = makeSim(player);
    // o RNG roteirizado erra por padrão: todo disparo acerta
    rng.defaultChance = true;
    const enemy = { ...TEST_ENEMIES.scav, burst: 1, damage: 20 };
    rng.weights.push("thorax");
    sim.enemyTurn(enemy, 1);
    const lost = armorWear(20, enemy.penetration, 2);
    expect(durabilityOf(armor)).toBeCloseTo(40 - lost);

    armor.durability = 0.1;
    rng.weights.push("thorax");
    sim.enemyTurn(enemy, 1);
    expect(durabilityOf(armor)).toBe(0);
    expect(sim.events.at(-1)!.text).toContain(`${armor.def.name} quebrou`);

    // quebrada: não gasta mais nem avisa de novo
    rng.weights.push("thorax");
    sim.enemyTurn(enemy, 1);
    expect(sim.events.at(-1)!.text).not.toContain("quebrou");

    // acerto fora da armadura não gasta nada
    armor.durability = 30;
    rng.weights.push("leftLeg");
    sim.enemyTurn(enemy, 1);
    expect(durabilityOf(armor)).toBe(30);
  });
});
