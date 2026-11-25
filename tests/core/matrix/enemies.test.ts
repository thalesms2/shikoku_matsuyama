import { afterEach, describe, expect, it, vi } from "vitest";

import { resetCoreBalance } from "../../../src/core/balance.ts";
import {
  distance,
  fleeRoll,
  hearingRange,
  moveEnemy,
  perceptionContest,
  rollSpawn,
  spawnPoints,
  spawnTarget,
} from "../../../src/core/matrix/enemies.ts";
import type { MatrixEnemy } from "../../../src/core/matrix/enemies.ts";
import { MatrixRaid, runMatrixRaid } from "../../../src/core/matrix/raid.ts";
import type { FightStart } from "../../../src/core/matrix/raid.ts";
import { damage } from "../../../src/core/pmc/pmc.ts";
import { skillXpForLevel } from "../../../src/core/pmc/skills.ts";
import { CONTAINERS } from "../../../src/data/containers.ts";
import {
  ScriptRng,
  armedPlayer,
  emptyPlayer,
  give,
} from "../raid/raidFixtures.ts";
import { smallMap } from "./matrixFixtures.ts";

afterEach(() => {
  resetCoreBalance();
});

const EXIT = { id: "exit", name: "Saída", x: 4, y: 1 };
const enemy = (
  x: number,
  y: number,
  extra: Partial<MatrixEnemy> = {},
): MatrixEnemy => ({
  id: 1,
  kind: "scav",
  x,
  y,
  chasing: false,
  noticed: false,
  ignored: false,
  ...extra,
});

describe("primitivas dos inimigos", () => {
  it("distância e número do d10 por dificuldade", () => {
    expect(distance([0, 0], [2, 3])).toBe(5);
    expect([1, 2, 3, 4, 5].map(spawnTarget)).toEqual([9, 8, 6, 5, 3]);
  });

  it("pontos de spawn com peso; spawn só com d10 suficiente", () => {
    const map = smallMap([".S.P.", ".....", "....."], [EXIT]);
    expect(spawnPoints(map)).toEqual([
      { value: { cell: [1, 0], kind: "scav" }, weight: 1 },
      { value: { cell: [3, 0], kind: "pmc" }, weight: 0.3 },
    ]);
    const rng = new ScriptRng();
    rng.ints = [8, 9];
    expect(rollSpawn(map, rng, 7)).toBeNull();
    expect(rollSpawn(map, rng, 7)).toEqual(enemy(1, 0, { id: 7 }));
    expect(rollSpawn(smallMap(["....."], [EXIT]), rng, 1)).toBeNull();
  });

  it("movimento: persegue (horizontal antes) ou anda ao acaso com o d6", () => {
    const map = smallMap([".....", ".....", "....."], [EXIT]);
    const rng = new ScriptRng();
    const chaser = enemy(0, 0, { chasing: true });
    moveEnemy(chaser, map, [2, 2], rng);
    expect([chaser.x, chaser.y]).toEqual([1, 0]);
    chaser.x = 2;
    moveEnemy(chaser, map, [2, 2], rng);
    expect([chaser.x, chaser.y]).toEqual([2, 1]);
    moveEnemy(chaser, map, [2, 1], rng);
    expect([chaser.x, chaser.y]).toEqual([2, 1]);
    const walker = enemy(1, 1);
    rng.ints = [5, 6];
    moveEnemy(walker, map, [4, 4], rng);
    expect([walker.x, walker.y]).toEqual([1, 1]);
    moveEnemy(walker, map, [4, 4], rng);
    expect([walker.x, walker.y]).toEqual([1, 0]);
  });

  it("alcance da percepção por estratégia e terreno", () => {
    expect(hearingRange("rat", "road")).toBe(0);
    expect(hearingRange("neutral", "road")).toBe(2);
    expect(hearingRange("aggressive", "road")).toBe(3);
    expect(hearingRange("psycho", "road")).toBe(4);
    expect(hearingRange("psycho", "grass")).toBe(5);
    expect(hearingRange("psycho", "metal")).toBe(5);
  });

  it("disputa de percepção e fuga no d20", () => {
    const rng = new ScriptRng();
    rng.ints = [10, 5, 5, 10, 7, 7, 10, 6, 10, 5];
    expect(perceptionContest(rng, 0, 0)).toBe(1);
    expect(perceptionContest(rng, 0, 0)).toBe(-1);
    expect(perceptionContest(rng, 0, 0)).toBe(0);
    expect(fleeRoll(rng, 2)).toBe(true);
    expect(fleeRoll(rng, 0)).toBe(true);
  });
});

function raid(
  strategy: "rat" | "safe" | "neutral" | "aggressive" | "psycho",
  fight?: (s: FightStart) => "won" | "died" | "fled",
) {
  const map = smallMap([".....", ".....", "....."], [EXIT]);
  const { player } = armedPlayer();
  give(player, "med_bandage");
  const rng = new ScriptRng();
  rng.ints = [1];
  const r = new MatrixRaid({
    player,
    map,
    strategy,
    rng,
    containers: CONTAINERS,
    ...(fight && { fight }),
  });
  return { r, rng, player };
}

describe("MatrixRaid: percepção", () => {
  it("vê primeiro e quer brigar: briga com headshot e abate", () => {
    const fight = vi.fn(() => "won" as const);
    const { r, rng } = raid("neutral", fight);
    r.enemies.push(enemy(1, 1));
    rng.ints = [1, 15, 5];
    r.enemyTurn();
    expect(fight).toHaveBeenCalledWith(
      expect.objectContaining({
        playerFirst: true,
        playerHeadshot: true,
        enemyHeadshot: false,
      }),
      r,
    );
    expect(r.kills).toBe(1);
    expect(r.enemies).toEqual([]);
    expect(r.events.map((e) => e.text)).toEqual([
      "Viu um Scav antes de ser visto",
      "Briga com um Scav",
      "Abateu um Scav",
    ]);
  });

  it("o Rato vê e não briga: ignora e vai para a extração", () => {
    const { r, rng } = raid("rat");
    r.enemies.push(enemy(0, 1));
    rng.ints = [1, 15, 5, 1];
    r.enemyTurn();
    expect(r.enemies[0].ignored).toBe(true);
    expect(r.leaving).toBe(true);
    expect(r.events.map((e) => e.text)).toContain(
      "Com medo: indo direto para a extração",
    );
    // ignorado não decide de novo; fora do alcance volta a valer
    r.enemyTurn();
    r.enemies[0].x = 4;
    r.enemies[0].y = 0;
    r.enemyTurn();
    expect(r.enemies[0].ignored).toBe(false);
  });

  it("o inimigo percebe, vem atrás e chega sem ser notado: emboscada", () => {
    const fight = vi.fn(() => "won" as const);
    const { r, rng } = raid("neutral", fight);
    r.enemies.push(enemy(2, 1));
    rng.ints = [1, 5, 15];
    r.enemyTurn();
    expect(r.enemies[0].chasing).toBe(true);
    expect(r.events.at(-1)!.text).toBe("um Scav percebeu você e vem atrás");
    // anda 1 (para 1,1); o personagem tenta notar e falha
    rng.ints = [5, 15];
    r.enemyTurn();
    expect(r.enemies[0].x).toBe(1);
    // chega
    r.enemyTurn();
    expect(fight).toHaveBeenCalledWith(
      expect.objectContaining({ playerFirst: false, enemyHeadshot: true }),
      r,
    );
    expect(r.events.map((e) => e.text)).toContain(
      "um Scav chegou sem ser notado!",
    );
  });

  it("notado vindo: o Seguro tenta fugir (sem sucesso, depois despista)", () => {
    const { r, rng } = raid("safe");
    r.enemies.push(enemy(2, 1, { chasing: true, noticed: true }));
    rng.ints = [6, 10];
    r.enemyTurn();
    expect(r.events.at(-1)!.text).toBe("Tentou despistar um Scav, sem sucesso");
    expect(r.fleeing).toBe(true);
    r.enemies[0].x = 3;
    rng.ints = [20, 5];
    r.enemyTurn();
    expect(r.events.at(-1)!.text).toBe("Despistou um Scav");
    expect(r.enemies[0]).toMatchObject({ chasing: false, ignored: true });
  });

  it("o Agressivo despista e ataca com headshot", () => {
    const fight = vi.fn(() => "won" as const);
    const { r, rng, player } = raid("aggressive", fight);
    damage(player.pmc, "thorax", 1);
    r.enemies.push(enemy(3, 1, { chasing: true, noticed: true }));
    r.wantsToFlee = () => true;
    rng.ints = [20, 5];
    r.enemyTurn();
    expect(fight).toHaveBeenCalledWith(
      expect.objectContaining({ playerFirst: true, playerHeadshot: true }),
      r,
    );
  });

  it("notado vindo: o Neutro saudável enfrenta; a iniciativa é disputada", () => {
    const fight = vi.fn(() => "won" as const);
    const { r, rng } = raid("neutral", fight);
    r.enemies.push(enemy(3, 1, { chasing: true, noticed: true }));
    rng.ints = [15, 5];
    r.enemyTurn();
    expect(fight).toHaveBeenCalledWith(
      expect.objectContaining({ playerFirst: true, playerHeadshot: false }),
      r,
    );
  });

  it("chegando notado: briga com iniciativa disputada; perseguidor notado depois", () => {
    const fight = vi.fn(() => "won" as const);
    const { r, rng } = raid("aggressive", fight);
    r.enemies.push(enemy(1, 1, { chasing: true, noticed: true }));
    rng.ints = [3, 15];
    r.enemyTurn();
    expect(fight).toHaveBeenCalledWith(
      expect.objectContaining({ playerFirst: false }),
      r,
    );
    const second = raid("rat");
    second.r.enemies.push(enemy(3, 1, { chasing: true }));
    second.rng.ints = [15, 5];
    second.r.enemyTurn();
    expect(second.r.enemies[0].noticed).toBe(true);
    expect(second.r.leaving).toBe(true);
  });

  it("morrer na briga encerra a raid; fugir deixa o inimigo para trás", () => {
    const died = raid("neutral", () => "died");
    died.r.enemies.push(enemy(1, 1));
    died.rng.ints = [1, 15, 5];
    died.r.enemyTurn();
    expect(died.r.dead).toBe(true);
    expect(died.r.events.at(-1)!.text).toBe("Morto por um Scav");
    const fled = raid("neutral", () => "fled");
    fled.r.enemies.push(enemy(1, 1, { kind: "pmc" }));
    fled.rng.ints = [1, 15, 5];
    fled.r.enemyTurn();
    expect(fled.r.enemies[0]).toMatchObject({ chasing: false, ignored: true });
    expect(fled.r.events.at(-1)!.text).toBe("Fugiu de um PMC inimigo");
  });
});

describe("MatrixRaid: decisões e bônus", () => {
  it("brigar e fugir por estratégia", () => {
    const { r, player } = raid("safe");
    expect(r.wantsToFight()).toBe(true);
    damage(player.pmc, "thorax", 80);
    damage(player.pmc, "stomach", 70);
    damage(player.pmc, "leftLeg", 60);
    expect(r.wantsToFight()).toBe(false);
    expect(raid("rat").r.wantsToFight()).toBe(false);
    expect(raid("psycho").r.wantsToFight()).toBe(true);
    expect(r.wantsToFlee()).toBe(true);
    const neutral = raid("neutral");
    expect(neutral.r.wantsToFlee()).toBe(false);
    damage(neutral.player.pmc, "stomach", 70);
    damage(neutral.player.pmc, "leftLeg", 65);
    damage(neutral.player.pmc, "rightLeg", 65);
    damage(neutral.player.pmc, "leftArm", 60);
    damage(neutral.player.pmc, "rightArm", 60);
    expect(neutral.r.wantsToFlee()).toBe(true);
    expect(raid("psycho").r.wantsToFlee()).toBe(false);
  });

  it("sem remédio ou sem munição, faltam suprimentos", () => {
    const empty = new MatrixRaid({
      player: emptyPlayer(),
      map: smallMap(["....."], [{ ...EXIT, y: 0 }]),
      strategy: "safe",
      rng: new ScriptRng(),
      containers: CONTAINERS,
    });
    expect(empty.hasSupplies()).toBe(false);
    // comida não conta como remédio
    const { player: hungry } = armedPlayer();
    give(hungry, "food_can");
    const fed = new MatrixRaid({ ...raid("safe").r.setup, player: hungry });
    expect(fed.hasSupplies()).toBe(false);
    expect(raid("safe").r.hasSupplies()).toBe(true);
  });

  it("percepção, furtividade, mochila chamativa e fuga", () => {
    const { r, player } = raid("safe");
    expect(r.enemyPerception()).toBe(1 - 3);
    player.inventory.equipment.equip(
      "backpack",
      player.factory.create("backpack_school"),
    );
    player.skills.stealth = skillXpForLevel(10);
    player.skills.perception = skillXpForLevel(20);
    expect(r.enemyPerception()).toBeCloseTo(1 + 2 - 1 - 3);
    expect(r.playerPerception()).toBeCloseTo(2);
    expect(r.fleeBonus()).toBeCloseTo(2);
    const rat = new MatrixRaid({ ...raid("rat").r.setup, knowledgeLevel: 4 });
    expect(rat.fleeBonus()).toBeCloseTo(2 - 4);
  });
});

describe("runMatrixRaid com inimigos", () => {
  it("inimigos aparecem nos spawns; fugindo, cada célula custa mais", () => {
    const map = smallMap([".....", "..S..", "....."], [EXIT]);
    const rng = new ScriptRng();
    // linha 1; d10 = 10 (aparece); depois tudo no mínimo
    rng.ints = [1, 10];
    const result = runMatrixRaid({
      player: armedPlayer().player,
      map,
      strategy: "neutral",
      rng,
      containers: CONTAINERS,
    });
    expect(
      result.kills + result.events.filter((e) => e.kind === "chased").length,
    ).toBeGreaterThanOrEqual(0);
    expect(result.outcome).toBe("extracted");
  });

  it("morto no caminho: raid termina sem extração", () => {
    const map = smallMap([".....", ".....", "....."], [EXIT]);
    const rng = new ScriptRng();
    rng.ints = [1];
    const r = new MatrixRaid({
      player: armedPlayer().player,
      map,
      strategy: "neutral",
      rng,
      containers: CONTAINERS,
      fight: () => "died",
    });
    r.enemies.push(enemy(1, 1, { chasing: true }));
    const result = r.run();
    expect(result.outcome).toBe("killed");
    expect(result.extract).toBeNull();
    expect(result.events.at(-1)!.kind).toBe("death");
  });
});

describe("MatrixRaid: casos raros", () => {
  const died = () => "died" as const;
  const setup = (
    rows: string[],
    strategy: "neutral" | "safe" | "psycho" | "rat",
    extra = {},
  ) => {
    const map = smallMap(rows, [EXIT]);
    const rng = new ScriptRng();
    rng.ints = [1];
    const r = new MatrixRaid({
      player: armedPlayer().player,
      map,
      strategy,
      rng,
      containers: CONTAINERS,
      ...extra,
    });
    return { r, rng, map };
  };

  it("o Rato sempre foge; empate na percepção: ninguém percebe", () => {
    expect(setup(["....."], "rat").r.wantsToFlee()).toBe(true);
    const { r, rng } = setup([".....", ".....", "....."], "neutral");
    r.enemies.push(enemy(1, 1));
    rng.ints = [1, 11, 10];
    r.enemyTurn();
    expect(r.enemies[0]).toMatchObject({ chasing: false, ignored: false });
    expect(r.events).toEqual([]);
  });

  it("morto por um inimigo, os outros não agem mais no turno", () => {
    const { r, rng } = setup([".....", ".....", "....."], "neutral", {
      fight: died,
    });
    r.enemies.push(enemy(1, 1), enemy(4, 2, { id: 2 }));
    rng.ints = [1, 15, 5];
    r.enemyTurn();
    expect(r.dead).toBe(true);
    expect(r.enemies).toHaveLength(2);
  });

  it("fugindo, cada célula custa turnos a mais", () => {
    const { r } = setup([".....", ".....", "....."], "safe");
    r.enemies.push(enemy(4, 0, { chasing: true, noticed: true }));
    const result = r.run();
    expect(result.events.map((e) => e.text)).toContain(
      "Tentou despistar um Scav, sem sucesso",
    );
    expect(result.turns).toBeGreaterThan(result.path.length - 1);
  });

  it("morre revistando, procurando a borda ou indo a um alvo", () => {
    const search = setup([".....", ".c...", "....."], "neutral", {
      fight: died,
    });
    search.r.enemies.push(enemy(3, 1, { chasing: true }));
    expect(search.r.run().outcome).toBe("killed");

    const border = setup([".....", ".....", "....."], "neutral", {
      fight: died,
      knowledge: {
        extracts: new Set(),
        pois: new Set(),
        containers: new Set(),
        spawns: new Set(),
      },
    });
    border.r.enemies.push(enemy(3, 1, { chasing: true }));
    const lost = border.r.run();
    expect(lost.outcome).toBe("killed");
    expect(lost.events.map((e) => e.kind)).not.toContain("search");

    const target = setup([".....", ".....", "...c."], "psycho", {
      fight: died,
    });
    target.r.enemies.push(enemy(1, 1, { chasing: true }));
    expect(target.r.run().outcome).toBe("killed");
  });
});
