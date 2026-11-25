import { afterEach, describe, expect, it } from "vitest";

import { resetCoreBalance } from "../../../src/core/balance.ts";
import { createD20Fight } from "../../../src/core/matrix/combat.ts";
import type { MatrixEnemy } from "../../../src/core/matrix/enemies.ts";
import { MatrixRaid } from "../../../src/core/matrix/raid.ts";
import type { MatrixStrategyId } from "../../../src/core/matrix/strategy.ts";
import { damage } from "../../../src/core/pmc/pmc.ts";
import { CONTAINERS } from "../../../src/data/containers.ts";
import { ENEMIES } from "../../../src/data/maps.ts";
import { ScriptRng, armedPlayer, give } from "../raid/raidFixtures.ts";
import { smallMap } from "./matrixFixtures.ts";

afterEach(() => {
  resetCoreBalance();
});

function setup(strategy: MatrixStrategyId = "neutral") {
  const { player } = armedPlayer();
  const rng = new ScriptRng();
  rng.ints = [1];
  const raid = new MatrixRaid({
    player,
    map: smallMap(
      [".....", ".....", "....."],
      [{ id: "e", name: "Saída", x: 4, y: 1 }],
    ),
    strategy,
    rng,
    containers: CONTAINERS,
  });
  return { raid, rng, player };
}

const texts = (raid: MatrixRaid) => raid.events.map((e) => e.text);

describe("sangramento", () => {
  it("cada dano rola o sangramento; a parte que já sangra não rola de novo", () => {
    const { raid, rng } = setup();
    rng.chances = [false, true];
    raid.bleed("leftArm");
    expect(raid.bleeding).toEqual([]);
    raid.bleed("leftArm");
    raid.bleed("leftArm");
    expect(raid.bleeding).toEqual(["leftArm"]);
    expect(texts(raid)).toEqual(["Começou a sangrar: Braço esquerdo"]);
  });

  it("perde vida por turno em cada parte e pode morrer sangrando", () => {
    const { raid, player } = setup();
    raid.bleeding.push("leftArm", "thorax");
    raid.tickBleeding();
    expect(player.pmc.health.leftArm).toBe(59);
    expect(player.pmc.health.thorax).toBe(84);
    player.pmc.health.thorax = 1;
    raid.tickBleeding();
    expect(raid.dead).toBe(true);
    expect(texts(raid).at(-1)).toBe("Morreu sangrando");
    // sem sangrar, nada acontece
    const calm = setup();
    calm.raid.tickBleeding();
    expect(calm.raid.dead).toBe(false);
  });

  it("sangrando, o turno da raid tira vida e para de agir ao morrer", () => {
    const { raid, player } = setup();
    raid.bleeding.push("thorax");
    player.pmc.health.thorax = 2;
    raid.spend(5);
    expect(raid.dead).toBe(true);
    expect(raid.turn).toBe(2);
  });
});

describe("cuidados automáticos", () => {
  it("estanca com o torniquete primeiro, depois com o remédio de menor cura", () => {
    const { raid, player } = setup();
    give(player, "med_kit");
    give(player, "med_bandage");
    give(player, "med_tourniquet");
    raid.bleeding.push("leftArm", "rightLeg");
    raid.selfCare();
    expect(raid.bleeding).toEqual([]);
    expect(texts(raid)).toEqual([
      "Estancou Braço esquerdo com Torniquete",
      "Estancou Perna direita com Atadura",
    ]);
    // sem remédio, continua sangrando
    raid.bleeding.push("leftArm");
    const left = setup();
    left.raid.bleeding.push("leftArm");
    left.raid.selfCare();
    expect(left.raid.bleeding).toEqual(["leftArm"]);
  });

  it("cura com o remédio de maior cura quando a vida cai; para quando não cura mais", () => {
    const { raid, player } = setup();
    give(player, "med_bandage");
    give(player, "med_kit");
    damage(player.pmc, "thorax", 70);
    raid.selfCare();
    expect(texts(raid)[0]).toMatch(/^Usou Kit/);
    expect(player.pmc.health.thorax).toBe(85);
    // só partes destruídas: o remédio não cura, para
    const broken = setup();
    give(broken.player, "med_bandage");
    for (const part of [
      "leftArm",
      "rightArm",
      "leftLeg",
      "rightLeg",
      "stomach",
    ] as const) {
      broken.player.pmc.health[part] = 0;
    }
    broken.raid.selfCare();
    expect(texts(broken.raid)).toEqual([]);
  });

  it("come e bebe abaixo do limite, com o item de mais energia/hidratação", () => {
    const { raid, player } = setup();
    give(player, "food_can");
    give(player, "food_water");
    player.pmc.energy = 20;
    player.pmc.hydration = 20;
    raid.selfCare();
    expect(texts(raid)).toEqual([
      "Consumiu Lata de carne",
      "Consumiu Garrafa de água",
    ]);
    const hungry = setup();
    hungry.player.pmc.energy = 10;
    hungry.raid.selfCare();
    expect(texts(hungry.raid)).toEqual([]);
  });

  it("o Seguro ferido ou sangrando vai para a extração", () => {
    const bleeding = setup("safe");
    bleeding.raid.bleeding.push("leftArm");
    bleeding.raid.selfCare();
    expect(bleeding.raid.leaving).toBe(true);
    expect(texts(bleeding.raid)).toContain("Ferido: indo para a extração");
    bleeding.raid.selfCare();
    expect(
      texts(bleeding.raid).filter((t) => t.startsWith("Ferido")),
    ).toHaveLength(1);
    const hurt = setup("safe");
    damage(hurt.player.pmc, "stomach", 70);
    damage(hurt.player.pmc, "leftLeg", 65);
    damage(hurt.player.pmc, "rightLeg", 65);
    damage(hurt.player.pmc, "leftArm", 60);
    hurt.raid.selfCare();
    expect(hurt.raid.leaving).toBe(true);
    const neutral = setup("neutral");
    neutral.raid.bleeding.push("leftArm");
    neutral.raid.selfCare();
    expect(neutral.raid.leaving).toBe(false);
  });
});

describe("sangramento no combate", () => {
  const scav: MatrixEnemy = {
    id: 1,
    kind: "scav",
    x: 0,
    y: 1,
    chasing: true,
    noticed: true,
    ignored: false,
  };
  const fight = createD20Fight(ENEMIES);
  const start = {
    enemy: scav,
    playerFirst: true,
    playerHeadshot: false,
    enemyHeadshot: false,
  };

  it("o inimigo atingido pode sangrar e perde vida a cada troca", () => {
    const { raid, rng } = setup();
    // acerta (20, dano 1) e o inimigo sangra; depois ninguém acerta
    rng.ints = [20, 1];
    rng.chances = [true];
    expect(fight({ ...start, enemy: { ...scav } }, raid)).toBe("won");
    expect(texts(raid)).toContain("um Scav está sangrando");
  });

  it("o tiro do inimigo pode fazer sangrar; sangrando na briga, pode morrer", () => {
    const { raid, rng, player } = setup();
    rng.weights = [
      ENEMIES.scav.gear!.weapons[0],
      ENEMIES.scav.gear!.armor[0],
      ENEMIES.scav.gear!.helmet[0],
      "leftArm",
    ];
    rng.ints = [20, 1];
    rng.chances = [true];
    fight({ ...start, enemy: { ...scav }, playerFirst: false }, raid);
    expect(raid.bleeding).toContain("leftArm");
    const dying = setup();
    dying.raid.bleeding.push("thorax");
    dying.player.pmc.health.thorax = 1;
    expect(fight({ ...start, enemy: { ...scav } }, dying.raid)).toBe("died");
    expect(player.pmc.health.leftArm).toBeLessThan(60);
  });
});

describe("cuidados: escolhe a comida que mais rende", () => {
  it("entre bolachas e lata de carne, come a lata", () => {
    const { raid, player } = setup();
    give(player, "food_crackers");
    give(player, "food_can");
    player.pmc.energy = 10;
    raid.selfCare();
    expect(texts(raid)).toEqual(["Consumiu Lata de carne"]);
  });
});

describe("cuidados: comida não estanca", () => {
  it("só com comida no equipamento, continua sangrando", () => {
    const { raid, player } = setup();
    give(player, "food_water");
    raid.bleeding.push("leftArm");
    raid.selfCare();
    expect(raid.bleeding).toEqual(["leftArm"]);
  });
});
