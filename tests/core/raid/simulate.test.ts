import { describe, expect, it } from "vitest";

import { Catalog } from "../../../src/core/inventory/item.ts";
import type { ItemDef } from "../../../src/core/inventory/item.ts";
import {
  attachMagazine,
  loadRounds,
  loadedRounds,
  popRound,
} from "../../../src/core/inventory/magazine.ts";
import { MAX_HEALTH, totalHealth } from "../../../src/core/pmc/pmc.ts";
import {
  HAZARDS,
  MAX_EXCHANGES,
  QUIET_TEXTS,
  isCarried,
  statOf,
} from "../../../src/core/raid/simulate.ts";
import { KARMA } from "../../../src/core/raid/strategy.ts";
import { catalog } from "../../../src/data/items.ts";
import {
  TEST_ENEMIES,
  TEST_MAP,
  armedPlayer,
  emptyPlayer,
  give,
  kinds,
  makeSim,
} from "./raidFixtures.ts";

const killer = {
  ...TEST_ENEMIES,
  scav: { ...TEST_ENEMIES.scav, damage: 1000 },
};

describe("run", () => {
  it("raid tranquila: loot, extração, XP e sem kit as pernas continuam destruídas", () => {
    const { player } = armedPlayer();
    player.pmc.health.leftLeg = 0;
    player.pmc.health.rightLeg = 0;
    const { sim } = makeSim(player);
    const { events, summary } = sim.run();
    // extração em 30 × 0,45 = 13,5 min; passos de 2 × 1,5 (pernas destruídas)
    expect(events[0]).toEqual({
      t: 0,
      kind: "start",
      text: "Entrou em Mapa de teste (Equilibrado)",
    });
    expect(events[1].t).toBe(3);
    expect(kinds(sim)).toEqual([
      "start",
      "loot",
      "loot",
      "loot",
      "loot",
      "extract",
      "extract",
    ]);
    expect(summary).toMatchObject({
      outcome: "extracted",
      map: "test",
      strategy: "balanced",
      minutes: 17,
      kills: { scav: 0, pmc: 0 },
      loot: [{ def: "barter_bolts", name: "Parafusos", count: 4 }],
      lootValue: 10000,
      lost: [],
      xp: 300 + 85 + 10,
      karma: KARMA.extract,
      extract: "Saída",
      killedBy: null,
    });
    expect(summary.skillXp).toEqual({
      endurance: 7.5,
      perception: 8,
      strength: 0.8,
    });
    expect(player.pmc.xp).toBe(395);
    expect(player.pmc.health.leftLeg).toBe(0);
    expect(player.pmc.energy).toBeCloseTo(100 - 0.15 * 15);
  });

  it("cancela o carregamento de carregador em andamento", () => {
    const { player } = armedPlayer();
    const mag = give(player, "mag_pk9");
    const ammo = give(player, "ammo_9mm", 10);
    player.loader.start({ kind: "load", magazine: mag, ammo });
    makeSim(player).sim.run();
    expect(player.loader.job).toBeNull();
  });

  it("tempo esgotado antes da extração: MIA, perde o equipamento", () => {
    const { player } = armedPlayer();
    give(player, "barter_bolts");
    const { sim, rng } = makeSim(player, {
      map: { ...TEST_MAP, duration: 3 },
    });
    rng.ints = [5];
    const { events, summary } = sim.run();
    expect(events.at(-1)).toMatchObject({ t: 5, kind: "mia" });
    expect(summary.outcome).toBe("mia");
    expect(summary.xp).toBe(0);
    expect(summary.lost.map((l) => l.def).sort()).toEqual([
      "barter_bolts",
      "pistol_pk9",
      "rig_cargo",
    ]);
    expect(player.inventory.equipment.get("holster")).toBeNull();
    expect(player.pmc.health).toEqual(MAX_HEALTH);
  });

  it("chegou na extração depois do fim do tempo: MIA", () => {
    const { player } = armedPlayer();
    const { sim } = makeSim(player, { map: { ...TEST_MAP, duration: 3 } });
    const { events, summary } = sim.run();
    expect(kinds(sim)).toEqual(["start", "extract", "mia"]);
    expect(events.at(-1)!.t).toBe(4);
    expect(summary.minutes).toBe(4);
    expect(summary.outcome).toBe("mia");
  });

  it("morte sem atirador conhecido", () => {
    const player = emptyPlayer();
    player.pmc.health.head = 0;
    const { sim } = makeSim(player);
    const { events, summary } = sim.run();
    expect(events.at(-1)!.text).toBe("Morto");
    expect(summary).toMatchObject({ outcome: "killed", killedBy: null });
  });

  it("morte em combate registra quem matou", () => {
    const { player } = armedPlayer();
    const { sim, rng } = makeSim(player, { enemies: killer });
    rng.weights = ["scav", "head"];
    rng.chances = [false, false, true];
    const { events, summary } = sim.run();
    expect(events.at(-1)!.text).toBe("Morto por Scav de teste");
    expect(summary.killedBy).toBe("Scav de teste");
    expect(summary.outcome).toBe("killed");
  });
});

describe("advance", () => {
  it("gasta energia e hidratação; zeradas, o estômago sofre", () => {
    const player = emptyPlayer();
    player.pmc.energy = 0.1;
    const { sim } = makeSim(player);
    sim.advance(2);
    expect(player.pmc.energy).toBe(0);
    expect(player.pmc.hydration).toBeCloseTo(99.6);
    expect(player.pmc.health.stomach).toBeCloseTo(70 - 1.2);
    expect(kinds(sim)).toEqual(["starving"]);
    expect(player.skills.endurance).toBe(1);
  });
});

describe("event", () => {
  it("perigo fere uma parte do corpo", () => {
    const player = emptyPlayer();
    const { sim, rng } = makeSim(player);
    rng.weights = ["hazard"];
    rng.picks = [HAZARDS[0], "leftLeg"];
    rng.ints = [10];
    sim.event();
    expect(player.pmc.health.leftLeg).toBe(55);
    expect(sim.events[0].text).toBe(`${HAZARDS[0].text}: Perna esquerda −10`);
    expect(player.skills.vitality).toBeCloseTo(0.5);
  });

  it("evento tranquilo", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.weights = ["quiet"];
    sim.event();
    expect(sim.events[0]).toMatchObject({
      kind: "quiet",
      text: QUIET_TEXTS[0],
    });
  });

  it("encontro com PMC", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.weights = ["pmc"];
    rng.chances = [true];
    sim.event();
    expect(kinds(sim)).toEqual(["encounter", "avoid"]);
    expect(sim.events[0].text).toBe("Avistou PMC de teste (colete classe 3)");
  });

  it("loot com olhar atento acha um segundo item", () => {
    const { sim, rng } = makeSim(armedPlayer().player);
    rng.chances = [true];
    sim.event();
    expect(sim.events.map((e) => e.text)).toEqual([
      "Encontrou Parafusos",
      "Encontrou Parafusos (olhar atento)",
    ]);
  });
});

describe("takeLoot", () => {
  it("loot que entra inteiro numa pilha conta, mas não vira item próprio", () => {
    const player = emptyPlayer();
    const own = give(player, "ammo_9mm", 30);
    const { sim } = makeSim(player);
    const loot = player.factory.create("ammo_9mm", 10);
    sim.takeLoot(loot);
    expect(own.count).toBe(40);
    expect(sim.found.has(loot)).toBe(false);
    expect(sim.gained.get("ammo_9mm")!.count).toBe(10);
    expect(sim.events[0].text).toBe("Encontrou Cartucho 9mm x10");
  });

  it("sem espaço e regra keepFirst: deixa o loot", () => {
    const player = emptyPlayer();
    for (let i = 0; i < 4; i++) give(player, "barter_goldchain");
    const { sim } = makeSim(player, { lootRule: "keepFirst" });
    sim.takeLoot(player.factory.create("barter_bolts"));
    expect(sim.events[0]).toEqual({
      t: 0,
      kind: "lootLeft",
      text: "Sem espaço: deixou Parafusos",
    });
    expect(sim.gained.size).toBe(0);
  });

  it("valuePerCell larga loot barato para guardar o valioso", () => {
    const player = emptyPlayer();
    const { sim } = makeSim(player);
    for (let i = 0; i < 4; i++) {
      sim.takeLoot(player.factory.create("barter_bolts"));
    }
    sim.events.length = 0;
    sim.takeLoot(player.factory.create("barter_goldchain"));
    expect(kinds(sim)).toEqual(["lootSwap", "loot"]);
    expect(sim.events[0].text).toBe("Largou Parafusos para abrir espaço");
    expect(sim.gained.get("barter_bolts")!.count).toBe(3);
    expect(sim.found.size).toBe(4);
  });
});

describe("selfCare", () => {
  it("usa o melhor remédio até sair da zona de perigo", () => {
    const { player } = armedPlayer();
    const kit = give(player, "med_kit");
    give(player, "med_bandage");
    player.pmc.health.thorax = 25;
    const { sim } = makeSim(player);
    sim.selfCare();
    expect(player.pmc.health.thorax).toBe(85);
    expect(kit.location).toBeNull();
    expect(sim.events.map((e) => e.text)).toEqual([
      "Usou Kit de primeiros socorros (+60 PV)",
    ]);
  });

  it("sem remédio não faz nada", () => {
    const player = emptyPlayer();
    player.pmc.health.thorax = 10;
    const { sim } = makeSim(player);
    sim.selfCare();
    expect(sim.events).toEqual([]);
  });

  it("não gasta remédio em partes destruídas", () => {
    const { player } = armedPlayer();
    give(player, "med_kit");
    for (const p of ["leftArm", "rightArm", "leftLeg", "rightLeg"] as const) {
      player.pmc.health[p] = 0;
    }
    const { sim } = makeSim(player);
    sim.selfCare();
    expect(sim.events).toEqual([]);
  });

  it("come quando a energia está baixa; sem água, continua com sede", () => {
    const player = emptyPlayer();
    give(player, "food_can");
    player.pmc.energy = 20;
    player.pmc.hydration = 20;
    const { sim } = makeSim(player);
    sim.selfCare();
    expect(player.pmc.energy).toBe(65);
    expect(sim.events.map((e) => e.text)).toEqual(["Consumiu Lata de carne"]);
  });

  it("bestConsumable escolhe o maior valor e ignora o resto", () => {
    const { player } = armedPlayer();
    give(player, "barter_bolts");
    give(player, "food_can");
    give(player, "med_bandage");
    give(player, "barter_bolts");
    const kit = give(player, "med_kit");
    const after = give(player, "med_bandage");
    expect(after.location).toMatchObject({
      grid: { owner: { def: { id: "rig_cargo" } } },
    });
    const { sim } = makeSim(player);
    expect(sim.bestConsumable("heal")).toBe(kit);
    expect(sim.bestConsumable("hydration")).toBeNull();
  });
});

describe("armas", () => {
  it("readyWeapon ignora armas sem munição", () => {
    const { player, pistol } = armedPlayer();
    const { sim } = makeSim(player);
    expect(sim.readyWeapon()).toBe(pistol);
    while (popRound(pistol.magazine!));
    expect(sim.readyWeapon()).toBeNull();
  });

  it("swapMagazine troca o vazio por um cheio do equipamento", () => {
    const { player, pistol } = armedPlayer();
    const empty = pistol.magazine!;
    while (popRound(empty));
    const spare = player.factory.create("mag_pk9");
    loadRounds(spare, player.factory.create("ammo_9mm", 12));
    give(player, "barter_bolts");
    const { equipment } = player.inventory;
    equipment.pockets[1].place(spare, 0, 0, false);
    const { sim } = makeSim(player);
    expect(sim.swapMagazine()).toBe(true);
    expect(pistol.magazine).toBe(spare);
    expect(spare.location).toEqual({ kind: "weapon", weapon: pistol });
    expect(equipment.pockets[1].has(empty)).toBe(true);
    expect(sim.events[0].text).toBe("Trocou o carregador de Pistola PK-9");
  });

  it("swapMagazine em arma sem carregador só encaixa", () => {
    const player = emptyPlayer();
    const pistol = player.factory.create("pistol_pk9");
    player.inventory.equipment.equip("holster", pistol);
    const { sim } = makeSim(player);
    expect(sim.swapMagazine()).toBe(false);
    const spare = give(player, "mag_pk9");
    loadRounds(spare, player.factory.create("ammo_9mm", 3));
    expect(sim.swapMagazine()).toBe(true);
    expect(pistol.magazine).toBe(spare);
  });

  it("swapMagazine sem armas não faz nada", () => {
    expect(makeSim(emptyPlayer()).sim.swapMagazine()).toBe(false);
  });

  it("carregador vazio maior que o espaço do novo fica para trás", () => {
    const base = (id: string, extra: Partial<ItemDef>): ItemDef => ({
      id,
      name: id,
      shortName: id,
      category: "magazine",
      width: 1,
      height: 1,
      basePrice: 1,
      ...extra,
    });
    const custom = new Catalog([
      base("gun", {
        category: "weapon",
        equipSlot: "pistol",
        stats: { caliber: "X" },
      }),
      base("big", { height: 2, stats: { caliber: "X", capacity: 5 } }),
      base("small", { stats: { caliber: "X", capacity: 5 } }),
      base("round", {
        category: "ammo",
        maxStack: 10,
        stats: { caliber: "X" },
      }),
    ]);
    const player = emptyPlayer(custom);
    const { factory } = player;
    const gun = factory.create("gun");
    const big = factory.create("big");
    attachMagazine(gun, big);
    player.inventory.equipment.equip("holster", gun);
    const small = factory.create("small");
    loadRounds(small, factory.create("round", 5));
    player.inventory.equipment.pockets[0].place(small, 0, 0, false);
    const { sim } = makeSim(player);
    expect(sim.swapMagazine()).toBe(true);
    expect(gun.magazine).toBe(small);
    expect(big.location).toBeNull();
  });

  it("topUpMagazines completa carregadores com munição solta", () => {
    const { player, pistol } = armedPlayer();
    for (let i = 0; i < 7; i++) popRound(pistol.magazine!);
    give(player, "barter_bolts");
    give(player, "ammo_545", 10);
    const ammo = give(player, "ammo_9mm", 30);
    const spare = give(player, "mag_pk9");
    const { sim } = makeSim(player);
    sim.topUpMagazines();
    expect(loadedRounds(pistol.magazine!)).toBe(12);
    expect(loadedRounds(spare)).toBe(12);
    expect(ammo.count).toBe(11);
    expect(sim.events[0].text).toBe("Recarregou 19 cartuchos");
    expect(player.skills.magDrills).toBe(9.5);
    sim.topUpMagazines();
    expect(sim.events).toHaveLength(1);
  });
});

describe("fight", () => {
  it("evitar o combate dá karma e XP de Furtividade", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.chances = [true];
    sim.fight("scav");
    expect(sim.events.map((e) => e.text)).toEqual([
      "Avistou Scav de teste",
      "Evitou Scav de teste sem ser visto",
    ]);
    expect(sim.karma).toBe(KARMA.avoid);
    expect(sim.player.skills.stealth).toBe(4);
  });

  it("abater um Scav tira karma", () => {
    const { player } = armedPlayer();
    const { sim, rng } = makeSim(player);
    rng.chances = [false, true, true, true];
    sim.fight("scav");
    expect(kinds(sim)).toEqual(["encounter", "hit", "kill"]);
    expect(sim.events[1].text).toBe(
      "2 disparo(s) com PK-9: 2 acerto(s) (−108)",
    );
    expect(sim.kills.scav).toBe(1);
    expect(sim.karma).toBe(KARMA.killScav);
    expect(player.skills.aim).toBe(2);
  });

  it("abater um PMC dá karma e o corpo pode ser revistado", () => {
    const { player } = armedPlayer();
    const enemies = {
      ...TEST_ENEMIES,
      pmc: { ...TEST_ENEMIES.pmc, health: 10 },
    };
    const { sim, rng } = makeSim(player, { enemies });
    rng.chances = [false, true, true, false, true];
    sim.fight("pmc");
    expect(sim.kills.pmc).toBe(1);
    expect(sim.karma).toBe(KARMA.killPmc);
    expect(sim.events.at(-1)!.text).toBe("Encontrou Parafusos no corpo");
  });

  it("depois de várias trocas sem vencedor, o inimigo recua", () => {
    const { player } = armedPlayer();
    const { sim } = makeSim(player);
    sim.fight("scav");
    const turns = kinds(sim).filter((k) => k === "wounded");
    expect(turns).toHaveLength(MAX_EXCHANGES);
    expect(sim.events.at(-1)!.text).toBe("Scav de teste recuou");
    expect(sim.events[1].text).toBe("Scav de teste errou");
    expect(sim.t).toBe(3);
  });

  it("sem munição: foge ou tenta fugir", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.chances = [false, true, false, false, true];
    sim.fight("scav");
    expect(sim.events.map((e) => e.text)).toEqual([
      "Avistou Scav de teste",
      "Sem munição, tentou fugir e não conseguiu",
      "Scav de teste errou",
      "Sem munição, fugiu de Scav de teste",
    ]);
  });

  it("arma vazia gasta o turno trocando o carregador", () => {
    const { player, pistol } = armedPlayer();
    while (popRound(pistol.magazine!));
    const spare = give(player, "mag_pk9");
    loadRounds(spare, player.factory.create("ammo_9mm", 12));
    const { sim } = makeSim(player);
    expect(sim.playerTurn(TEST_ENEMIES.scav, 0)).toBe(0);
    expect(pistol.magazine).toBe(spare);
  });

  it("o PMC morre no meio da troca", () => {
    const { player } = armedPlayer();
    const { sim, rng } = makeSim(player, { enemies: killer });
    rng.chances = [false, false, true];
    rng.weights = ["thorax"];
    sim.fight("scav");
    expect(sim.killedBy).toBe("Scav de teste");
    expect(kinds(sim)).toEqual(["encounter", "wounded"]);
  });
});

describe("enemyTurn", () => {
  it("capacete e colete reduzem; membros não têm proteção", () => {
    const player = emptyPlayer();
    player.inventory.equipment.equip(
      "helmet",
      player.factory.create("helmet_tk1"),
    );
    const { sim, rng } = makeSim(player);
    rng.chances = [true, true, true];
    rng.weights = ["head", "leftArm", "thorax"];
    sim.enemyTurn({ ...TEST_ENEMIES.scav, burst: 3 }, 1);
    expect(sim.events[0].text).toBe(
      "Scav de teste acertou: Cabeça −10, Braço esquerdo −20, Tórax −20",
    );
  });

  it("para de atirar quando o PMC morre", () => {
    const player = emptyPlayer();
    const { sim, rng } = makeSim(player);
    rng.defaultChance = true;
    rng.weights = ["head"];
    sim.enemyTurn({ ...killer.scav, burst: 3 }, 1);
    expect(sim.events[0].text).toBe("Scav de teste acertou: Cabeça −1000");
  });
});

describe("extração", () => {
  const exits = (extracts: (typeof TEST_MAP)["extracts"]) => ({
    map: { ...TEST_MAP, extracts },
  });

  it("canUse confere chave, pagamento e mochila", () => {
    const player = emptyPlayer();
    const { sim } = makeSim(player);
    const base = { id: "e", name: "E", risk: 0 };
    const key = {
      ...base,
      requirement: { kind: "key", item: "key_garage" },
    } as const;
    const pay = {
      ...base,
      requirement: { kind: "payment", item: "money_rub", amount: 7000 },
    } as const;
    const noBag = { ...base, requirement: { kind: "noBackpack" } } as const;
    expect(sim.canUse(base)).toBe(true);
    expect(sim.canUse(key)).toBe(false);
    expect(sim.canUse(pay)).toBe(false);
    expect(sim.canUse(noBag)).toBe(true);
    give(player, "key_garage");
    give(player, "money_rub", 5000);
    give(player, "money_rub", 2000);
    player.inventory.equipment.equip(
      "backpack",
      player.factory.create("backpack_sack"),
    );
    expect(sim.canUse(key)).toBe(true);
    expect(sim.canUse(pay)).toBe(true);
    expect(sim.canUse(noBag)).toBe(false);
  });

  it("pay tira o valor das pilhas em ordem", () => {
    const player = emptyPlayer();
    give(player, "barter_bolts");
    const [a, b, c] = [5000, 3000, 1000].map((n, i) => {
      const stack = player.factory.create("money_rub", n);
      player.inventory.equipment.pockets[i + 1].place(stack, 0, 0, false);
      return stack;
    });
    makeSim(player).sim.pay("money_rub", 7000);
    expect(a.location).toBeNull();
    expect(b.count).toBe(1000);
    expect(c.count).toBe(1000);
  });

  it("prefere a saída de menor risco que pode usar e paga a passagem", () => {
    const player = emptyPlayer();
    const money = give(player, "money_rub", 8000);
    const { sim } = makeSim(
      player,
      exits([
        { id: "a", name: "Aberta", risk: 0.2 },
        {
          id: "b",
          name: "Barco",
          risk: 0.05,
          requirement: { kind: "payment", item: "money_rub", amount: 7000 },
        },
      ]),
    );
    expect(sim.tryExtract()).toBe("extracted");
    expect(money.count).toBe(1000);
    expect(sim.events.map((e) => e.text)).toEqual([
      "Indo para a extração: Barco",
      "Pagou 7000 pela passagem",
      "Extraiu por Barco",
    ]);
    expect(sim.extract?.id).toBe("b");
  });

  it("tocaia na saída: sobrevive e extrai", () => {
    const { sim, rng } = makeSim(emptyPlayer());
    rng.chances = [true, true];
    expect(sim.tryExtract()).toBe("extracted");
    expect(kinds(sim)).toEqual([
      "extract",
      "encounter",
      "encounter",
      "avoid",
      "extract",
    ]);
  });

  it("tocaia na saída: morre", () => {
    const { sim, rng } = makeSim(emptyPlayer(), { enemies: killer });
    rng.chances = [true, false, false, true];
    rng.weights = ["scav", "head"];
    expect(sim.tryExtract()).toBe("killed");
    expect(sim.extract).toBeNull();
  });
});

describe("finish", () => {
  it("morte: o contêiner seguro e o loot dentro dele ficam", () => {
    const player = emptyPlayer();
    const secure = player.factory.create("secure_pouch");
    player.inventory.equipment.equip("secure", secure);
    const { sim } = makeSim(player);
    for (let i = 0; i < 5; i++) {
      sim.takeLoot(player.factory.create("barter_bolts"));
    }
    const { summary } = sim.finish("killed");
    expect(player.inventory.equipment.get("secure")).toBe(secure);
    expect(secure.grids[0].items()).toHaveLength(1);
    expect(summary.loot).toEqual([
      { def: "barter_bolts", name: "Parafusos", count: 1 },
    ]);
    expect(summary.lootValue).toBe(2500);
    expect(summary.lost).toEqual([
      { def: "barter_bolts", name: "Parafusos", count: 4 },
    ]);
    expect(totalHealth(player.pmc)).toBe(440);
  });

  it("tipos de loot que zeraram (todos largados) não aparecem", () => {
    const player = emptyPlayer();
    const { sim } = makeSim(player);
    const def = catalog.get("barter_bolts");
    sim.addGained(def, 1);
    sim.addGained(def, -1);
    expect(sim.finish("extracted").summary.loot).toEqual([]);
  });
});

describe("isCarried / statOf", () => {
  it("segue a cadeia até um slot ou bolso", () => {
    const { player, pistol } = armedPlayer();
    const { stash, equipment } = player.inventory;
    expect(isCarried(pistol, player)).toBe(true);
    expect(isCarried(pistol.magazine!, player)).toBe(true);
    const inRig = player.factory.create("barter_bolts");
    equipment.get("rig")!.grids[0].place(inRig, 0, 0, false);
    expect(isCarried(inRig, player)).toBe(true);
    const inPocket = give(player, "barter_bolts");
    expect(inPocket.location).toMatchObject({ grid: equipment.pockets[0] });
    expect(isCarried(inPocket, player)).toBe(true);
    const stashed = player.factory.create("barter_bolts");
    stash.place(stashed, 0, 0, false);
    expect(isCarried(stashed, player)).toBe(false);
    expect(isCarried(player.factory.create("barter_bolts"), player)).toBe(
      false,
    );
  });

  it("statOf devolve 0 quando falta", () => {
    expect(statOf(catalog.get("barter_bolts"), "damage")).toBe(0);
    expect(statOf(catalog.get("ammo_9mm"), "damage")).toBe(54);
  });
});
