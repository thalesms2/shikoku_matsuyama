import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import {
  attachMagazine,
  loadRounds,
  loadedRounds,
  weaponRounds,
} from "../../../src/core/inventory/magazine.ts";
import { autoPlace } from "../../../src/core/inventory/operations.ts";
import { createScavProfile } from "../../../src/core/raid/profile.ts";
import {
  SCAV_COOLDOWN_MS,
  createScav,
  rollScavEquipment,
  scavCooldownMs,
  scavModifiers,
  scavReadyIn,
  startScavRaid,
  transferToStash,
} from "../../../src/core/raid/scav.ts";
import type { EnemyDef, MapDef } from "../../../src/core/raid/types.ts";
import { Rng } from "../../../src/core/rng.ts";
import { ENEMIES } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { SCAV_LOADOUT } from "../../../src/data/scav.ts";
import { ScriptRng, TEST_MAP, emptyPlayer } from "./raidFixtures.ts";

describe("karma na raid Scav", () => {
  it("modificadores de −10 a 10", () => {
    expect(scavModifiers(0)).toEqual({
      friendlyScav: 0.6,
      extractRisk: 1,
      lootWeight: 1,
      lootQuality: 0,
    });
    const good = scavModifiers(10);
    expect(good.friendlyScav).toBe(1);
    expect(good.extractRisk).toBeCloseTo(0.5);
    expect(good.lootWeight).toBeCloseTo(1.3);
    expect(good.lootQuality).toBeCloseTo(0.5);
    const bad = scavModifiers(-10);
    expect(bad.friendlyScav).toBeCloseTo(0.2);
    expect(bad.extractRisk).toBeCloseTo(1.5);
    expect(bad.lootWeight).toBeCloseTo(0.7);
    expect(bad.lootQuality).toBeCloseTo(-0.5);
  });

  it("chance de Scav amigável fica entre 0 e 1", () => {
    expect(scavModifiers(-20).friendlyScav).toBe(0);
    expect(scavModifiers(20).friendlyScav).toBe(1);
  });

  it("cooldown: 20 min, karma muda até 25%, esconderijo corta uma fração", () => {
    expect(SCAV_COOLDOWN_MS).toBe(1_200_000);
    expect(scavCooldownMs(0)).toBe(1_200_000);
    expect(scavCooldownMs(10)).toBe(900_000);
    expect(scavCooldownMs(-10)).toBe(1_500_000);
    expect(scavCooldownMs(0, 0.5)).toBe(600_000);
    expect(scavCooldownMs(0, 2)).toBe(0);
    expect(scavCooldownMs(0, -1)).toBe(1_200_000);
  });

  it("tempo até liberar", () => {
    const profile = createScavProfile();
    expect(profile).toEqual({
      readyAt: 0,
      stats: {
        raids: 0,
        extracted: 0,
        killed: 0,
        mia: 0,
        kills: { scav: 0, pmc: 0 },
      },
    });
    expect(scavReadyIn(profile, 500)).toBe(0);
    profile.readyAt = 1000;
    expect(scavReadyIn(profile, 400)).toBe(600);
    expect(scavReadyIn(profile, 1000)).toBe(0);
  });
});

describe("rollScavEquipment", () => {
  const { factory } = emptyPlayer();

  it("sorteia peças, arma carregada, carregador extra, munição e itens", () => {
    const rng = new ScriptRng();
    const bandage = SCAV_LOADOUT.extras.find((e) => e.item === "med_bandage");
    rng.weights = [
      "rig_cargo",
      "backpack_sack",
      null,
      "helmet_tk1",
      SCAV_LOADOUT.weapons[1],
      bandage,
    ];
    // cartuchos, extras, cartuchos do extra, munição solta, itens, quantidade
    rng.ints = [20, 1, 30, 10, 1, 1];
    const eq = rollScavEquipment(SCAV_LOADOUT, rng, factory);
    expect(eq.get("rig")?.def.id).toBe("rig_cargo");
    expect(eq.get("backpack")?.def.id).toBe("backpack_sack");
    expect(eq.get("armor")).toBeNull();
    expect(eq.get("helmet")?.def.id).toBe("helmet_tk1");
    const rifle = eq.get("primary")!;
    expect(rifle.def.id).toBe("rifle_vk74");
    expect(weaponRounds(rifle)).toBe(20);
    const carried = eq.carryGrids().flatMap((g) => g.items());
    const spare = carried.find((i) => i.def.id === "mag_vk74")!;
    expect(loadedRounds(spare)).toBe(30);
    expect(carried.find((i) => i.def.id === "ammo_545")?.count).toBe(10);
    expect(carried.some((i) => i.def.id === "med_bandage")).toBe(true);
  });

  it("no mínimo: pistola com meio carregador e mais nada", () => {
    const eq = rollScavEquipment(SCAV_LOADOUT, new ScriptRng(), factory);
    expect(eq.equipped().map((i) => i.def.id)).toEqual(["pistol_pk9"]);
    expect(weaponRounds(eq.get("holster")!)).toBe(6);
    expect(eq.carryGrids().flatMap((g) => g.items())).toEqual([]);
  });

  it("o que não cabe nos bolsos fica de fora", () => {
    const rng = new ScriptRng();
    rng.weights = [null, null, null, null, SCAV_LOADOUT.weapons[1]];
    rng.ints = [15, 1, 30];
    const eq = rollScavEquipment(SCAV_LOADOUT, rng, factory);
    // carregador 1x2 não cabe em bolso 1x1
    expect(eq.carryGrids().flatMap((g) => g.items())).toEqual([]);
  });
});

describe("createScav", () => {
  it("equipamento novo, vida cheia, cópia das skills, mesma fábrica", () => {
    const clock = new ManualClock();
    const player = createNewPlayer(clock);
    player.skills.aim = 50;
    const scav = createScav(player, SCAV_LOADOUT, new Rng(5), clock);
    expect(scav.factory).toBe(player.factory);
    expect(scav.raid).toBe(player.raid);
    expect(scav.skills).toEqual(player.skills);
    expect(scav.skills).not.toBe(player.skills);
    expect(scav.loader).not.toBe(player.loader);
    expect(scav.pmc.name).toBe("Scav");
    expect(scav.inventory.equipment).not.toBe(player.inventory.equipment);
    expect(scav.inventory.equipment.equipped().length).toBeGreaterThan(0);
  });
});

describe("transferToStash", () => {
  function scavWithGear() {
    const { factory } = emptyPlayer();
    const eq = new Equipment();
    const rifle = factory.create("rifle_vk74");
    const mag = factory.create("mag_vk74");
    loadRounds(mag, factory.create("ammo_545", 30));
    attachMagazine(rifle, mag);
    eq.equip("primary", rifle);
    const rig = factory.create("rig_cargo");
    eq.equip("rig", rig);
    autoPlace(factory.create("ammo_9mm", 10), rig.grids);
    autoPlace(factory.create("barter_goldchain"), eq.pockets);
    return { factory, eq, rifle, rig };
  }

  it("tira tudo do Scav e guarda no estoque", () => {
    const { eq, rifle, rig } = scavWithGear();
    const stash = new Grid(10, 10);
    const result = transferToStash(eq, stash);
    expect(eq.equipped()).toEqual([]);
    expect(rig.grids.flatMap((g) => g.items())).toEqual([]);
    expect(stash.items()).toHaveLength(4);
    expect(rifle.magazine).not.toBeNull();
    expect(result.left).toEqual([]);
    expect(result.stored.map((s) => s.def).sort()).toEqual([
      "ammo_9mm",
      "barter_goldchain",
      "rifle_vk74",
      "rig_cargo",
    ]);
    // fuzil 32000 + carregador 1500 + 30 × 90, colete 7000, ouro, 10 × 45
    expect(result.storedValue).toBe(32000 + 1500 + 2700 + 7000 + 20000 + 450);
  });

  it("estoque pequeno: entra primeiro o que vale mais por célula", () => {
    const { eq } = scavWithGear();
    const result = transferToStash(eq, new Grid(1, 1));
    expect(result.stored).toEqual([
      { def: "barter_goldchain", name: "Corrente de ouro", count: 1 },
    ]);
    expect(result.left.map((s) => s.def).sort()).toEqual([
      "ammo_9mm",
      "rifle_vk74",
      "rig_cargo",
    ]);
  });

  it("pilha que entra só em parte", () => {
    const { factory } = emptyPlayer();
    const eq = new Equipment();
    autoPlace(factory.create("ammo_9mm", 10), eq.pockets);
    const stash = new Grid(1, 1);
    autoPlace(factory.create("ammo_9mm", 45), [stash]);
    const result = transferToStash(eq, stash);
    expect(result.stored).toEqual([
      { def: "ammo_9mm", name: "Cartucho 9mm", count: 5 },
    ]);
    expect(result.storedValue).toBe(225);
    expect(result.left).toEqual([
      { def: "ammo_9mm", name: "Cartucho 9mm", count: 5 },
    ]);
  });

  it("pilhas iguais aparecem somadas", () => {
    const { factory } = emptyPlayer();
    const eq = new Equipment();
    autoPlace(factory.create("ammo_9mm", 10), [eq.pockets[0]]);
    autoPlace(factory.create("ammo_9mm", 10), [eq.pockets[1]]);
    const result = transferToStash(eq, new Grid(5, 5));
    expect(result.stored).toEqual([
      { def: "ammo_9mm", name: "Cartucho 9mm", count: 20 },
    ]);
  });
});

describe("startScavRaid", () => {
  const SAFE_MAP: MapDef = { ...TEST_MAP, threats: { scav: 0, pmc: 0 } };
  const DEADLY: Record<"scav" | "pmc", EnemyDef> = {
    ...ENEMIES,
    pmc: {
      ...ENEMIES.pmc,
      health: 100000,
      accuracy: 1,
      damage: 10000,
      burst: 3,
    },
  };

  function setup() {
    const clock = new ManualClock(10_000);
    const player = createNewPlayer(clock);
    player.raid.seed = 42;
    return { clock, player };
  }

  it("extraiu: tudo do Scav vai para o estoque; o PMC não muda", () => {
    const { clock, player } = setup();
    player.raid.karma = 2;
    const holster = player.inventory.equipment.get("holster");
    const pmcBefore = structuredClone(player.pmc);
    const skillsBefore = { ...player.skills };
    const stashBefore = player.inventory.stash.items().length;
    const mag = player.inventory.stash
      .items()
      .find((i) => i.def.id === "mag_vk74")!;
    const ammo = player.inventory.stash
      .items()
      .find((i) => i.def.id === "ammo_545")!;
    player.loader.start({ kind: "load", magazine: mag, ammo });

    const active = startScavRaid(
      player,
      SAFE_MAP,
      "balanced",
      ENEMIES,
      SCAV_LOADOUT,
      clock,
    );
    const { summary } = active;
    expect(summary.outcome).toBe("extracted");
    expect(summary.scav!.stored.length).toBeGreaterThan(0);
    expect(summary.scav!.left).toEqual([]);
    expect(player.inventory.stash.items().length).toBeGreaterThan(stashBefore);
    expect(summary).toMatchObject({ xp: 0, skillXp: {}, karma: 0 });
    expect(active.startedAt).toBe(10_000);
    expect(player.raid.active).toBe(active);
    expect(player.raid.karma).toBe(2);
    expect(player.raid.stats.raids).toBe(0);
    expect(player.raid.seed).not.toBe(42);
    expect(player.scav.stats).toMatchObject({ raids: 1, extracted: 1 });
    expect(player.scav.readyAt).toBe(10_000 + scavCooldownMs(2));
    expect(player.inventory.equipment.get("holster")).toBe(holster);
    expect(player.pmc).toEqual(pmcBefore);
    expect(player.skills).toEqual(skillsBefore);
    expect(player.loader.job?.magazine).toBe(mag);
  });

  it("morreu: perde só o equipamento do Scav", () => {
    const { clock, player } = setup();
    const map: MapDef = { ...TEST_MAP, threats: { scav: 0, pmc: 5 } };
    const stashBefore = player.inventory.stash.items().length;
    const { summary } = startScavRaid(
      player,
      map,
      "aggressive",
      DEADLY,
      SCAV_LOADOUT,
      clock,
      0.5,
    );
    expect(summary.outcome).toBe("killed");
    expect(summary.lost.length).toBeGreaterThan(0);
    expect(summary.scav).toEqual({ stored: [], storedValue: 0, left: [] });
    expect(player.inventory.stash.items()).toHaveLength(stashBefore);
    expect(player.scav.stats).toMatchObject({ raids: 1, killed: 1 });
    expect(player.scav.readyAt).toBe(10_000 + SCAV_COOLDOWN_MS / 2);
  });

  it("em espera: não entra", () => {
    const { clock, player } = setup();
    player.scav.readyAt = 10_001;
    expect(() =>
      startScavRaid(player, SAFE_MAP, "balanced", ENEMIES, SCAV_LOADOUT, clock),
    ).toThrow("A raid Scav ainda está em espera");
    expect(player.scav.stats.raids).toBe(0);
    expect(player.raid.active).toBeNull();
  });
});
