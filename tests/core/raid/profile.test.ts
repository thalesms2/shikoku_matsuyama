import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import {
  MS_PER_RAID_MINUTE,
  createRaidProfile,
  eventsUntil,
  finishRaid,
  raidFinished,
  raidMinuteAt,
  raidWarnings,
  startRaid,
} from "../../../src/core/raid/profile.ts";
import { KARMA } from "../../../src/core/raid/strategy.ts";
import { ENEMIES, MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  TEST_ENEMIES,
  TEST_MAP,
  armedPlayer,
  emptyPlayer,
} from "./raidFixtures.ts";

describe("createRaidProfile", () => {
  it("karma 0, estatísticas zeradas, regra valuePerCell, sem raid", () => {
    expect(createRaidProfile(-1)).toEqual({
      karma: 0,
      stats: {
        raids: 0,
        extracted: 0,
        killed: 0,
        mia: 0,
        kills: { scav: 0, pmc: 0 },
      },
      lootRule: "valuePerCell",
      seed: 4294967295,
      active: null,
    });
  });

  it("jogador novo recebe a seed do relógio", () => {
    expect(createNewPlayer(new ManualClock(1234)).raid.seed).toBe(1234);
  });
});

describe("raidWarnings", () => {
  it("avisa sem arma carregada, colete, capacete ou com vida baixa", () => {
    const player = emptyPlayer();
    player.pmc.health.thorax = 30;
    expect(raidWarnings(player)).toEqual([
      "Nenhuma arma equipada com munição",
      "Sem colete balístico",
      "Sem capacete",
      "Cabeça ou tórax muito feridos",
    ]);
  });

  it("bem equipado, nenhum aviso", () => {
    const { player } = armedPlayer();
    const { equipment } = player.inventory;
    equipment.equip("armor", player.factory.create("armor_civil"));
    equipment.equip("helmet", player.factory.create("helmet_tk1"));
    expect(raidWarnings(player)).toEqual([]);
  });

  it("arma equipada sem munição não conta", () => {
    const player = emptyPlayer();
    player.inventory.equipment.equip(
      "primary",
      player.factory.create("rifle_vk74"),
    );
    expect(raidWarnings(player)).toContain("Nenhuma arma equipada com munição");
  });
});

describe("startRaid / finishRaid", () => {
  it("resolve a raid, atualiza estatísticas, karma e a seed", () => {
    const clock = new ManualClock(5000);
    const { player } = armedPlayer();
    player.raid.seed = 42;
    player.raid.karma = 9.99;
    const active = startRaid(player, TEST_MAP, "balanced", TEST_ENEMIES, clock);
    expect(player.raid.active).toBe(active);
    expect(active.startedAt).toBe(5000);
    expect(active.events[0].kind).toBe("start");
    expect(player.raid.seed).not.toBe(42);
    const { stats } = player.raid;
    expect(stats.raids).toBe(1);
    expect(stats[active.summary.outcome]).toBe(1);
    expect(stats.kills.scav).toBe(active.summary.kills.scav);
    expect(stats.kills.pmc).toBe(active.summary.kills.pmc);
    expect(player.raid.karma).toBeLessThanOrEqual(KARMA.max);
    finishRaid(player);
    expect(player.raid.active).toBeNull();
  });

  it("a mesma seed dá a mesma raid", () => {
    const run = () => {
      const player = createNewPlayer(new ManualClock(7));
      return startRaid(
        player,
        MAPS[2],
        "aggressive",
        ENEMIES,
        new ManualClock(),
      );
    };
    expect(run()).toEqual(run());
  });

  it("raids seguidas usam seeds diferentes", () => {
    const player = createNewPlayer(new ManualClock(7));
    const clock = new ManualClock();
    const a = startRaid(player, MAPS[0], "stealth", ENEMIES, clock);
    const b = startRaid(player, MAPS[0], "stealth", ENEMIES, clock);
    expect(a.events).not.toEqual(b.events);
    expect(player.raid.stats.raids).toBe(2);
  });
});

describe("reprodução do log", () => {
  const raid = {
    startedAt: 0,
    events: [
      { t: 0, kind: "start", text: "a" },
      { t: 4, kind: "loot", text: "b" },
      { t: 9, kind: "extract", text: "c" },
    ],
    summary: { minutes: 9 },
  } as never;

  it("minuto mostrado pelo tempo real", () => {
    expect(raidMinuteAt(MS_PER_RAID_MINUTE * 3)).toBe(3);
    expect(raidMinuteAt(-5)).toBe(0);
  });

  it("eventos até o minuto e fim do log", () => {
    expect(eventsUntil(raid, 4).map((e) => e.text)).toEqual(["a", "b"]);
    expect(raidFinished(raid, 8.9)).toBe(false);
    expect(raidFinished(raid, 9)).toBe(true);
  });
});
