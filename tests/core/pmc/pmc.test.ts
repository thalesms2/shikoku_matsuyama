import { describe, expect, it } from "vitest";

import {
  BODY_PARTS,
  BODY_PART_LABELS,
  MAX_ENERGY,
  MAX_HEALTH,
  MAX_HYDRATION,
  MAX_LEVEL,
  SPREAD_FACTOR,
  addPmcXp,
  changeEnergy,
  changeHydration,
  createPmc,
  damage,
  heal,
  isDead,
  levelForXp,
  levelProgress,
  restorePart,
  totalHealth,
  totalMaxHealth,
  xpForLevel,
} from "../../../src/core/pmc/pmc.ts";

describe("PMC novo", () => {
  it("começa com tudo cheio e nível 1", () => {
    const pmc = createPmc("Lobo");
    expect(pmc.name).toBe("Lobo");
    expect(createPmc().name).toBe("PMC");
    expect(pmc.health).toEqual(MAX_HEALTH);
    expect(pmc.health).not.toBe(MAX_HEALTH);
    expect(pmc.energy).toBe(MAX_ENERGY);
    expect(pmc.hydration).toBe(MAX_HYDRATION);
    expect(levelForXp(pmc.xp)).toBe(1);
    expect(totalHealth(pmc)).toBe(440);
    expect(totalMaxHealth()).toBe(440);
    expect(isDead(pmc)).toBe(false);
  });

  it("toda parte do corpo tem nome", () => {
    expect(Object.keys(BODY_PART_LABELS)).toEqual([...BODY_PARTS]);
  });
});

describe("nível", () => {
  it("XP acumulado: 1000 × n(n−1)/2", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(1000);
    expect(xpForLevel(3)).toBe(3000);
    expect(xpForLevel(10)).toBe(45000);
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(999)).toBe(xpForLevel(MAX_LEVEL));
  });

  it("nível pelo XP, com limite", () => {
    expect(levelForXp(999)).toBe(1);
    expect(levelForXp(1000)).toBe(2);
    expect(levelForXp(2999)).toBe(2);
    expect(levelForXp(1e12)).toBe(MAX_LEVEL);
  });

  it("progresso dentro do nível", () => {
    expect(levelProgress(1500)).toEqual({ current: 500, needed: 2000 });
    expect(levelProgress(1e12)).toEqual({ current: 0, needed: 0 });
  });

  it("addPmcXp devolve quantos níveis subiu e ignora valores não positivos", () => {
    const pmc = createPmc();
    expect(addPmcXp(pmc, 3500)).toBe(2);
    expect(addPmcXp(pmc, 0)).toBe(0);
    expect(addPmcXp(pmc, -5)).toBe(0);
    expect(pmc.xp).toBe(3500);
  });
});

describe("dano", () => {
  it("tira vida da parte atingida, sem passar de zero", () => {
    const pmc = createPmc();
    damage(pmc, "leftArm", 20);
    expect(pmc.health.leftArm).toBe(40);
    damage(pmc, "leftArm", 100);
    expect(pmc.health.leftArm).toBe(0);
    expect(pmc.health.thorax).toBe(85);
  });

  it("dano em parte destruída se espalha pelas partes vivas", () => {
    const pmc = createPmc();
    damage(pmc, "leftArm", 60);
    damage(pmc, "leftArm", 60);
    const share = (60 * SPREAD_FACTOR) / 6;
    expect(pmc.health.leftArm).toBe(0);
    expect(pmc.health.head).toBeCloseTo(35 - share);
    expect(pmc.health.rightLeg).toBeCloseTo(65 - share);
  });

  it("cabeça ou tórax em zero matam", () => {
    const pmc = createPmc();
    damage(pmc, "head", 40);
    expect(isDead(pmc)).toBe(true);
    const other = createPmc();
    damage(other, "thorax", 85);
    expect(isDead(other)).toBe(true);
  });

  it("morto não recebe mais dano e dano não positivo é ignorado", () => {
    const pmc = createPmc();
    damage(pmc, "stomach", 0);
    damage(pmc, "stomach", -5);
    expect(pmc.health.stomach).toBe(70);
    damage(pmc, "head", 35);
    damage(pmc, "stomach", 10);
    expect(pmc.health.stomach).toBe(70);
  });
});

describe("cura", () => {
  it("cura as partes mais feridas primeiro e devolve o total curado", () => {
    const pmc = createPmc();
    damage(pmc, "leftLeg", 30); // 35/65
    damage(pmc, "stomach", 10); // 60/70
    expect(heal(pmc, 35)).toBe(35);
    expect(pmc.health.leftLeg).toBe(65);
    expect(pmc.health.stomach).toBe(65);
  });

  it("em empate de proporção, partes vitais primeiro", () => {
    const pmc = createPmc();
    pmc.health.head = 17.5; // 50%
    pmc.health.leftArm = 30; // 50%
    heal(pmc, 10);
    expect(pmc.health.head).toBe(27.5);
    expect(pmc.health.leftArm).toBe(30);
  });

  it("não cura partes destruídas nem passa do máximo", () => {
    const pmc = createPmc();
    damage(pmc, "rightArm", 60);
    damage(pmc, "leftArm", 5);
    expect(heal(pmc, 100)).toBe(5);
    expect(pmc.health.rightArm).toBe(0);
    expect(heal(pmc, -3)).toBe(0);
  });

  it("restorePart devolve 1 PV a uma parte destruída", () => {
    const pmc = createPmc();
    expect(restorePart(pmc, "leftLeg")).toBe(false);
    damage(pmc, "leftLeg", 65);
    expect(restorePart(pmc, "leftLeg")).toBe(true);
    expect(pmc.health.leftLeg).toBe(1);
  });
});

describe("energia e hidratação", () => {
  it("ficam entre 0 e o máximo", () => {
    const pmc = createPmc();
    changeEnergy(pmc, -30);
    changeHydration(pmc, -40);
    expect([pmc.energy, pmc.hydration]).toEqual([70, 60]);
    changeEnergy(pmc, 500);
    changeHydration(pmc, -500);
    expect([pmc.energy, pmc.hydration]).toEqual([MAX_ENERGY, 0]);
    changeHydration(pmc, 500);
    changeEnergy(pmc, -500);
    expect([pmc.energy, pmc.hydration]).toEqual([0, MAX_HYDRATION]);
  });
});
