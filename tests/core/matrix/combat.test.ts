import { afterEach, describe, expect, it } from "vitest";

import { resetCoreBalance } from "../../../src/core/balance.ts";
import { durabilityOf } from "../../../src/core/inventory/durability.ts";
import {
  attachMagazine as attachMagazineFor,
  loadRounds,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import { autoPlace } from "../../../src/core/inventory/operations.ts";
import {
  armFoe,
  bodyItems,
  createD20Fight,
  damageDie,
  headshotChance,
  playerAttackBonus,
  reload,
  reloadTurns,
  roundsPerAttack,
  stat,
} from "../../../src/core/matrix/combat.ts";
import type { MatrixEnemy } from "../../../src/core/matrix/enemies.ts";
import { MatrixRaid } from "../../../src/core/matrix/raid.ts";
import type { FightStart } from "../../../src/core/matrix/raid.ts";
import type { MatrixStrategyId } from "../../../src/core/matrix/strategy.ts";
import { skillXpForLevel } from "../../../src/core/pmc/skills.ts";
import type { EnemyDef } from "../../../src/core/raid/types.ts";
import { CONTAINERS } from "../../../src/data/containers.ts";
import { catalog } from "../../../src/data/items.ts";
import { ENEMIES } from "../../../src/data/maps.ts";
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
const scav = (extra: Partial<MatrixEnemy> = {}): MatrixEnemy => ({
  id: 1,
  kind: "scav",
  x: 0,
  y: 1,
  chasing: true,
  noticed: true,
  ignored: false,
  ...extra,
});

function setup(
  strategy: MatrixStrategyId = "neutral",
  player = armedPlayer().player,
) {
  const rng = new ScriptRng();
  rng.ints = [1];
  if (!player.inventory.equipment.get("rig")) {
    player.inventory.equipment.equip("rig", player.factory.create("rig_cargo"));
  }
  const raid = new MatrixRaid({
    player,
    map: smallMap([".....", ".....", "....."], [EXIT]),
    strategy,
    rng,
    containers: CONTAINERS,
  });
  const fight = createD20Fight(ENEMIES);
  const start = (s: Partial<FightStart> = {}): FightStart => ({
    enemy: scav(),
    playerFirst: true,
    playerHeadshot: false,
    enemyHeadshot: false,
    ...s,
  });
  return { raid, rng, player, fight, start };
}

describe("peças do combate", () => {
  it("equipamento sorteado do inimigo e a vida da raid em matriz", () => {
    const { raid } = setup();
    const foe = armFoe(scav(), ENEMIES.scav, raid);
    expect(foe.weapon.id).toBe("pistol_pk9");
    expect(foe.magazine?.id).toBe("mag_pk9");
    expect(foe.ammo.id).toBe("ammo_9mm");
    expect(foe.armor).toBeNull();
    expect(foe.helmet).toBeNull();
    expect(foe.health).toBe(60);
    const pmc = armFoe(scav({ kind: "pmc" }), ENEMIES.pmc, raid);
    expect(pmc.health).toBe(90);
    expect(pmc.armor?.def.id).toBe("armor_civil");
    expect(pmc.helmet).toBeNull();
  });

  it("dado, rajada, recarga, bônus de acerto e headshot", () => {
    expect(damageDie(catalog.get("rifle_kr47"))).toBe(20);
    expect(damageDie(catalog.get("barter_bolts"))).toBe(6);
    expect(roundsPerAttack(catalog.get("rifle_kr47"))).toBe(3);
    expect(roundsPerAttack(catalog.get("pistol_pk9"))).toBe(1);
    expect(roundsPerAttack(catalog.get("barter_bolts"))).toBe(1);
    const { raid, player } = setup();
    expect(reloadTurns(raid)).toBe(2);
    player.skills.magDrills = skillXpForLevel(50);
    expect(reloadTurns(raid)).toBe(0);
    expect(playerAttackBonus(raid, catalog.get("pistol_pk9"))).toBe(0);
    player.skills.aim = skillXpForLevel(10);
    player.skills.pistols = skillXpForLevel(10);
    expect(playerAttackBonus(raid, catalog.get("pistol_pk9"))).toBeCloseTo(2);
    // sem tipo de arma, conta a Mira duas vezes (toda arma do catálogo tem tipo)
    expect(playerAttackBonus(raid, catalog.get("barter_bolts"))).toBeCloseTo(2);
    expect(headshotChance(raid, catalog.get("pistol_pk9"))).toBeCloseTo(
      0.15 + 0.03 + 0.03,
    );
    expect(headshotChance(raid, catalog.get("barter_bolts"))).toBeCloseTo(0.21);
    const rat = setup("rat");
    expect(playerAttackBonus(rat.raid, catalog.get("pistol_pk9"))).toBe(-4);
    rat.player.skills.aim = skillXpForLevel(50);
    expect(headshotChance(rat.raid, catalog.get("pistol_pk9"))).toBeCloseTo(
      0.3,
    );
  });

  it("recarregar: troca o carregador, enche o tubo, ou não há com o quê", () => {
    const { raid, player } = setup();
    const pistol = player.inventory.equipment.get("holster")!;
    pistol.magazine!.rounds!.length = 0;
    expect(reload(raid)).toBe(false);
    const spare = player.factory.create("mag_pk9");
    loadRounds(spare, player.factory.create("ammo_9mm", 5));
    player.inventory.equipment.carryGrids()[0].place(spare, 0, 0);
    give(player, "barter_bolts");
    expect(reload(raid)).toBe(true);
    expect(pistol.magazine).toBe(spare);
    // escopeta: enche o tubo com cartuchos soltos
    const shot = setup("neutral", emptyPlayer());
    const shotgun = shot.player.factory.create("shotgun_m12");
    shot.player.inventory.equipment.equip("primary", shotgun);
    expect(reload(shot.raid)).toBe(false);
    give(shot.player, "ammo_12g", 3);
    expect(reload(shot.raid)).toBe(true);
    expect(loadedRounds(shotgun)).toBe(3);
  });

  it("o corpo deixa a arma com o carregador, as proteções gastas e a munição", () => {
    const { raid, rng } = setup();
    const foe = armFoe(scav({ kind: "pmc" }), ENEMIES.pmc, raid);
    foe.armor!.durability = 10;
    rng.ints = [7, 15];
    const [weapon, armor, ammo] = bodyItems(raid, foe);
    expect(weapon.def.id).toBe("rifle_vk74");
    expect(loadedRounds(weapon.magazine!)).toBe(7);
    expect(durabilityOf(armor)).toBe(10);
    expect(ammo.count).toBe(15);
    rng.ints = [0, 0];
    foe.armor!.durability = 40;
    const items = bodyItems(raid, foe);
    expect(items).toHaveLength(2);
    expect(items[1].durability).toBeUndefined();
  });
});

describe("createD20Fight", () => {
  it("headshot do personagem mata na hora; o corpo é revistado", () => {
    const { raid, rng, fight, start } = setup();
    rng.chances = [true];
    expect(fight(start({ playerHeadshot: true }), raid)).toBe("won");
    const texts = raid.events.map((e) => e.text);
    expect(texts).toContain("Headshot em um Scav!");
    expect(texts.some((t) => t.startsWith("Achou Pistola PK-9"))).toBe(true);
  });

  it("headshot do inimigo: mata sem capacete, ou o capacete segura", () => {
    const { raid, rng, fight, start, player } = setup();
    rng.chances = [true];
    expect(fight(start({ enemyHeadshot: true }), raid)).toBe("died");
    expect(player.pmc.health.head).toBe(0);
    const helmeted = setup();
    const helmet = helmeted.player.factory.create("helmet_rock");
    helmeted.player.inventory.equipment.equip("helmet", helmet);
    helmeted.rng.chances = [true, true];
    helmeted.rng.defaultChance = false;
    const outcome = fight(start({ enemyHeadshot: true }), helmeted.raid);
    expect(helmeted.raid.events.map((e) => e.text)).toContain(
      "Seu Capacete de assalto Rochedo segurou um tiro na cabeça",
    );
    expect(durabilityOf(helmet)).toBe(25);
    expect(outcome).toBe("fled");
  });

  it("ninguém acerta (1 no d20): depois do limite, o inimigo recua", () => {
    const { raid, fight, start } = setup();
    expect(fight(start(), raid)).toBe("fled");
    expect(raid.events.at(-1)!.text).toBe("um Scav recuou");
    expect(raid.events.map((e) => e.text)).toContain("Errou um Scav");
    expect(raid.turn).toBe(50);
  });

  it("acertos: dano pelo dado; o colete do PMC inimigo segura e se gasta", () => {
    const { raid, rng, fight, start, player } = setup();
    player.skills.aim = skillXpForLevel(50);
    // d20 15 (passa), dado 6 → 6 de dano, o inimigo erra (1)... até matar
    rng.ints = Array.from({ length: 40 }, (_, i) =>
      i % 3 === 0 ? 20 : i % 3 === 1 ? 6 : 1,
    );
    expect(fight(start(), raid)).toBe("won");
    expect(raid.events.map((e) => e.text)).toContain("Acertou um Scav (−6)");
    const pmc = setup();
    pmc.rng.weights = [
      ENEMIES.pmc.gear!.weapons[0],
      ENEMIES.pmc.gear!.armor[1],
      ENEMIES.pmc.gear!.helmet[0],
      "thorax",
    ];
    pmc.rng.ints = [6, 3];
    fight(start({ enemy: scav({ kind: "pmc" }) }), pmc.raid);
    expect(pmc.raid.events.map((e) => e.text)).toContain(
      "Colete de placas Muralha de um PMC inimigo segurou o tiro",
    );
  });

  it("o inimigo acerta você; o seu colete segura e dá XP de colete", () => {
    const { raid, rng, fight, start, player } = setup();
    const armor = player.factory.create("armor_heavy");
    player.inventory.equipment.equip("armor", armor);
    rng.weights = [
      ENEMIES.scav.gear!.weapons[0],
      ENEMIES.scav.gear!.armor[0],
      ENEMIES.scav.gear!.helmet[0],
      "thorax",
      "thorax",
      "leftLeg",
    ];
    // personagem erra (1); inimigo: 8 (contra 10+4: segura); personagem erra; inimigo 20 no tórax; personagem erra; inimigo 20 na perna
    rng.ints = [1, 8, 3, 1, 20, 4, 1, 20, 6];
    fight(start(), raid);
    const texts = raid.events.map((e) => e.text);
    expect(texts).toContain(
      "Seu Colete de placas Muralha segurou o tiro de um Scav",
    );
    expect(texts.some((t) => t.startsWith("um Scav acertou você"))).toBe(true);
    expect(player.skills.heavyVests).toBeGreaterThan(1);
    expect(durabilityOf(armor)).toBeLessThan(60);
  });

  it("sem munição: recarrega (esperando os turnos) ou tenta fugir", () => {
    const { raid, fight, start, player } = setup();
    const pistol = player.inventory.equipment.get("holster")!;
    pistol.magazine!.rounds!.length = 0;
    const spare = player.factory.create("mag_pk9");
    loadRounds(spare, player.factory.create("ammo_9mm", 12));
    player.inventory.equipment.carryGrids()[0].place(spare, 0, 0);
    fight(start(), raid);
    expect(raid.events.map((e) => e.text)).toContain("Recarregando");
    expect(pistol.magazine).toBe(spare);

    const dry = setup();
    dry.player.inventory.equipment.get("holster")!.magazine!.rounds!.length = 0;
    dry.rng.ints = [1, 20, 1];
    expect(fight(start(), dry.raid)).toBe("fled");
    expect(dry.raid.events.map((e) => e.text)).toContain("Sem munição");
  });

  it("recarga instantânea com Manuseio de carregador alto", () => {
    const { raid, fight, start, player } = setup();
    player.skills.magDrills = skillXpForLevel(50);
    player.inventory.equipment.get("holster")!.magazine!.rounds!.length = 0;
    const spare = player.factory.create("mag_pk9");
    loadRounds(spare, player.factory.create("ammo_9mm", 12));
    player.inventory.equipment.carryGrids()[0].place(spare, 0, 0);
    fight(start(), raid);
    expect(raid.events.map((e) => e.text)).toContain("Errou um Scav");
  });

  it("o Rato foge; morrer pelos tiros encerra a briga", () => {
    const rat = setup("rat");
    rat.rng.ints = [20, 1];
    expect(rat.fight(rat.start(), rat.raid)).toBe("fled");
    const { raid, rng, fight, start, player } = setup();
    player.pmc.health.thorax = 1;
    rng.weights = [
      ENEMIES.scav.gear!.weapons[0],
      ENEMIES.scav.gear!.armor[0],
      ENEMIES.scav.gear!.helmet[0],
      "thorax",
    ];
    rng.ints = [20, 6];
    expect(fight(start({ playerFirst: false }), raid)).toBe("died");
  });

  it("o Psicopata contra dois inimigos ganha turnos extras", () => {
    const { raid, rng, fight, start } = setup("psycho");
    const second = scav({ id: 2 });
    raid.enemies.push(start().enemy, second);
    rng.ints = [1, 1, 15];
    fight({ ...start(), enemy: raid.enemies[0] }, raid);
    expect(raid.events.map((e) => e.text)).toContain("Rápido: turno extra");
  });

  it("vencendo vários, os outros também contam como abatidos", () => {
    const { raid, rng, fight, start, player } = setup("psycho");
    player.skills.aim = skillXpForLevel(50);
    const first = scav();
    const second = scav({ id: 2 });
    raid.enemies.push(first, second);
    rng.chances = [true];
    rng.ints = Array.from({ length: 36 }, (_, i) => [20, 6, 1][i % 3]);
    expect(
      fight({ ...start(), enemy: first, playerHeadshot: true }, raid),
    ).toBe("won");
    expect(raid.kills).toBe(1);
    expect(raid.enemies).not.toContain(second);
  });
});

describe("createD20Fight: casos que faltavam", () => {
  const bolt: EnemyDef = {
    ...ENEMIES.scav,
    gear: {
      weapons: [
        {
          weight: 1,
          weapon: "bolt_m91",
          ammo: "ammo_762x54",
          ammoCount: [0, 5],
        },
      ],
      armor: [{ weight: 1, item: null }],
      helmet: [{ weight: 1, item: "helmet_steel" }],
    },
  };

  it("arma de tubo no inimigo: sem carregador; o corpo deixa os cartuchos no tubo", () => {
    const { raid, rng } = setup();
    const foe = armFoe(scav(), bolt, raid);
    expect(foe.magazine).toBeNull();
    rng.ints = [3, 0];
    const [weapon, helmet] = bodyItems(raid, foe);
    expect(loadedRounds(weapon)).toBe(3);
    expect(helmet.def.id).toBe("helmet_steel");
  });

  it("recarga: item que não é munição no caminho; arma sem carregador recebe o reserva", () => {
    const shot = setup("neutral", emptyPlayer());
    const shotgun = shot.player.factory.create("shotgun_m12");
    shot.player.inventory.equipment.equip("primary", shotgun);
    give(shot.player, "barter_bolts");
    give(shot.player, "ammo_12g", 2);
    expect(reload(shot.raid)).toBe(true);
    const rifle = setup("neutral", emptyPlayer());
    const vk = rifle.player.factory.create("rifle_vk74");
    rifle.player.inventory.equipment.equip("primary", vk);
    const mag = rifle.player.factory.create("mag_vk74");
    loadRounds(mag, rifle.player.factory.create("ammo_545", 5));
    autoPlace(mag, rifle.player.inventory.equipment.carryGrids());
    expect(reload(rifle.raid)).toBe(true);
    expect(vk.magazine).toBe(mag);
  });

  it("acertos na cabeça, nos membros e passando pelo colete do inimigo", () => {
    const fight = createD20Fight({ ...ENEMIES, scav: bolt });
    const { raid, rng, player, start } = setup();
    player.skills.aim = skillXpForLevel(50);
    // cabeça (capacete de aço: classe 2) → 20 passa e gasta; perna; inimigo erra
    rng.weights = [
      bolt.gear!.weapons[0],
      bolt.gear!.armor[0],
      bolt.gear!.helmet[0],
      "head",
      "leftLeg",
    ];
    rng.ints = [20, 6, 1, 20, 6, 1];
    fight(start(), raid);
    const texts = raid.events.map((e) => e.text);
    expect(texts.filter((t) => t.startsWith("Acertou um Scav"))).toHaveLength(
      2,
    );
  });

  it("PMC inimigo acerta com bônus; capacete do personagem segura e recebe tiro", () => {
    const { raid, rng, fight, start, player } = setup();
    const helmet = player.factory.create("helmet_rock");
    player.inventory.equipment.equip("helmet", helmet);
    rng.weights = [
      ENEMIES.pmc.gear!.weapons[0],
      ENEMIES.pmc.gear!.armor[0],
      ENEMIES.pmc.gear!.helmet[0],
      "head",
      "head",
    ];
    // personagem erra; PMC: 9 + 3 (12) < 15: segura; personagem erra; PMC: 20 passa
    rng.ints = [1, 9, 4, 1, 20, 4];
    fight(start({ enemy: scav({ kind: "pmc" }) }), raid);
    const texts = raid.events.map((e) => e.text);
    expect(texts).toContain(
      "Seu Capacete de assalto Rochedo segurou o tiro de um PMC inimigo",
    );
    expect(texts.some((t) => t.startsWith("um PMC inimigo acertou você"))).toBe(
      true,
    );
    expect(player.skills.heavyVests + player.skills.lightVests).toBe(0);
  });

  it("headshots que erram; fuga que falha; sem munição e sem fugir", () => {
    const { raid, rng, fight, start } = setup();
    rng.chances = [false, false];
    fight(start({ playerHeadshot: true, enemyHeadshot: true }), raid);
    expect(raid.events.map((e) => e.text)).not.toContain(
      "Headshot em um Scav!",
    );
    const rat = setup("rat");
    rat.rng.ints = [1, 20, 1];
    rat.fight(rat.start(), rat.raid);
    expect(rat.raid.events.map((e) => e.text)).toContain("Errou um Scav");
    const dry = setup();
    dry.player.inventory.equipment.get("holster")!.magazine!.rounds!.length = 0;
    dry.fight(start(), dry.raid);
    expect(
      dry.raid.events.filter((e) => e.text === "Sem munição").length,
    ).toBeGreaterThan(1);
  });

  it("inimigo morto no meio da rodada não ataca; o Rato vencendo não revista", () => {
    const { raid, rng, fight, start } = setup("psycho");
    const a = scav();
    const b = scav({ id: 2 });
    raid.enemies.push(a, b);
    rng.ints = [20, 200, 1, 1, 20, 200];
    expect(fight({ ...start(), enemy: a }, raid)).toBe("won");
    const rat = setup("rat");
    // fuga falha (1 contra 20), depois acerta e mata
    rat.rng.ints = [1, 20, 20, 200];
    expect(rat.fight(rat.start(), rat.raid)).toBe("won");
    expect(rat.raid.events.map((e) => e.kind)).not.toContain("loot");
  });
});

describe("createD20Fight: últimos casos", () => {
  it("stat: 0 sem dados técnicos ou sem o campo", () => {
    expect(stat(catalog.get("barter_bolts"), "armorClass")).toBe(0);
    expect(stat(catalog.get("ammo_9mm"), "armorClass")).toBe(0);
    expect(stat(catalog.get("ammo_545ap"), "penetration")).toBe(38);
  });

  it("colete leve segura o tiro e dá XP de Coletes leves", () => {
    const { raid, rng, fight, start, player } = setup();
    player.inventory.equipment.equip(
      "armor",
      player.factory.create("armor_civil"),
    );
    rng.weights = [
      ENEMIES.scav.gear!.weapons[0],
      ENEMIES.scav.gear!.armor[0],
      ENEMIES.scav.gear!.helmet[0],
      "thorax",
    ];
    rng.ints = [1, 8, 3];
    fight(start(), raid);
    expect(player.skills.lightVests).toBeGreaterThan(0);
  });

  it("sem munição e a fuga falha: segue na briga", () => {
    const { raid, rng, fight, start, player } = setup();
    player.inventory.equipment.get("holster")!.magazine!.rounds!.length = 0;
    rng.ints = [1, 20, 1, 1, 20, 20];
    fight(start(), raid);
    expect(
      raid.events.filter((e) => e.text === "Sem munição").length,
    ).toBeGreaterThan(1);
  });
});

describe("createD20Fight: sem munição, foge", () => {
  it("a fuga dá certo", () => {
    const { raid, rng, fight, start, player } = setup();
    player.inventory.equipment.get("holster")!.magazine!.rounds!.length = 0;
    rng.ints = [20, 1];
    expect(fight(start(), raid)).toBe("fled");
    expect(raid.turn).toBe(1);
  });
});

describe("createD20Fight: rajada", () => {
  it("fuzil gasta 3 cartuchos por ataque", () => {
    const player = emptyPlayer();
    const rifle = player.factory.create("rifle_vk74");
    const mag = player.factory.create("mag_vk74");
    loadRounds(mag, player.factory.create("ammo_545", 30));
    attachMagazineFor(rifle, mag);
    player.inventory.equipment.equip("primary", rifle);
    const { raid, rng, fight, start } = setup("neutral", player);
    rng.ints = [20, 200];
    expect(fight(start(), raid)).toBe("won");
    // 3 disparos: 27 cartuchos sobram (um deles na câmara)
    expect(loadedRounds(mag) + (rifle.chamber ? 1 : 0)).toBe(27);
  });
});
