import { describe, expect, it } from "vitest";

import {
  AUTO_GAP_MS,
  AUTO_LOG_SIZE,
  armed,
  autoMap,
  autoTick,
  createAutoState,
  raidEndsAt,
  startAuto,
  stopAuto,
} from "../../../src/core/auto/auto.ts";
import {
  MS_PER_RAID_MINUTE,
  startRaid,
} from "../../../src/core/raid/profile.ts";
import {
  DEADLY_MAP,
  SAFE_MAP,
  SHORT_MAP,
  autoCtx,
  autoPlayer,
} from "./autoFixtures.ts";

describe("raids automáticas: básico", () => {
  it("estado novo, mapa padrão e fim do log", () => {
    const state = createAutoState();
    expect(state.running).toBe(false);
    expect(state.rules).toMatchObject({ maxRaids: 5, lowHealth: "wait" });
    const maps = autoCtx().maps;
    expect(autoMap(state.rules, maps)).toBe(SAFE_MAP);
    expect(
      raidEndsAt({
        startedAt: 100,
        events: [],
        summary: { minutes: 3 } as never,
      }),
    ).toBe(100 + 3 * MS_PER_RAID_MINUTE);
  });

  it("parado não faz nada; parar guarda o motivo", () => {
    const { player } = autoPlayer();
    expect(autoTick(player, autoCtx(), 1000)).toEqual([]);
    expect(player.raid.active).toBeNull();
    stopAuto(player, "Motivo");
    expect(player.auto).toMatchObject({ running: false, stopReason: "Motivo" });
  });
});

describe("raids automáticas: sequência", () => {
  it("começa na hora, conta a quest e encadeia a próxima no fim do log", () => {
    const { player } = autoPlayer();
    player.quests.go = { status: "active", progress: [0] };
    player.auto.rules.maxRaids = 3;
    startAuto(player, 1000);
    const [first] = autoTick(player, autoCtx(), 1000);
    expect(first).toMatchObject({ n: 1, map: "safe", outcome: "extracted" });
    const raid = player.raid.active!;
    expect(raid.startedAt).toBe(1000);
    expect(player.auto.current).toBe(1000);
    expect(player.auto.nextAt).toBe(raidEndsAt(raid) + AUTO_GAP_MS);
    expect(player.quests.go.progress).toEqual([1]);
    expect(player.hideout.lastTick).toBe(1000);

    // antes do fim do log nada muda
    expect(autoTick(player, autoCtx(), raidEndsAt(raid) - 1)).toEqual([]);
    // no fim do log fecha; a próxima espera a pausa
    expect(autoTick(player, autoCtx(), raidEndsAt(raid))).toEqual([]);
    expect(player.raid.active).toBeNull();
    const next = player.auto.nextAt;
    expect(autoTick(player, autoCtx(), next)).toHaveLength(1);
    expect(player.raid.active!.startedAt).toBe(next);
  });

  it("com o jogo fechado, faz todas as raids em sequência e para no limite", () => {
    const { player } = autoPlayer();
    player.auto.rules.maxRaids = 3;
    startAuto(player, 0);
    const entries = autoTick(player, autoCtx(), 1e12);
    expect(entries.map((e) => e.n)).toEqual([1, 2, 3]);
    expect(player.auto).toMatchObject({
      running: false,
      done: 3,
      stopReason: "Concluiu 3 raid(s)",
      current: null,
    });
    expect(player.auto.log.map((e) => e.n)).toEqual([3, 2, 1]);
    // a última raid também foi fechada
    expect(player.raid.active).toBeNull();
    expect(player.raid.stats.raids).toBe(3);
  });

  it("parado no limite, a última raid ainda fecha sozinha no fim", () => {
    const { player } = autoPlayer();
    player.auto.rules.maxRaids = 1;
    startAuto(player, 0);
    autoTick(player, autoCtx(), 0);
    expect(player.auto.running).toBe(false);
    const raid = player.raid.active!;
    autoTick(player, autoCtx(), raidEndsAt(raid));
    expect(player.raid.active).toBeNull();
  });

  it("guarda só os últimos resultados", () => {
    const { player } = autoPlayer();
    player.auto.rules.maxRaids = AUTO_LOG_SIZE + 3;
    startAuto(player, 0);
    autoTick(player, autoCtx(), 1e13);
    expect(player.auto.log).toHaveLength(AUTO_LOG_SIZE);
    expect(player.auto.log[0].n).toBe(AUTO_LOG_SIZE + 3);
  });

  it("raid do jogador em andamento: espera ele fechar", () => {
    const { player } = autoPlayer();
    startRaid(player, SAFE_MAP, "balanced", autoCtx().enemies, {
      now: () => 0,
    });
    startAuto(player, 0);
    expect(autoTick(player, autoCtx(), 1e12)).toEqual([]);
    expect(player.raid.active!.startedAt).toBe(0);
    player.raid.active = null;
    // fechada a raid do jogador, faz as 5 raids padrão
    expect(autoTick(player, autoCtx(), 1e12)).toHaveLength(5);
  });
});

describe("raids automáticas: regras de parada", () => {
  it("morreu: para (ou continua e para sem arma)", () => {
    const { player } = autoPlayer("deadly");
    const ctx = autoCtx([SAFE_MAP, DEADLY_MAP]);
    startAuto(player, 0);
    const [entry] = autoTick(player, ctx, 0);
    expect(entry.outcome).toBe("killed");
    expect(player.auto.stopReason).toBe("O PMC morreu");

    const again = autoPlayer("deadly");
    again.player.auto.rules.stopOnDeath = false;
    startAuto(again.player, 0);
    autoTick(again.player, ctx, 1e12);
    expect(again.player.auto.done).toBe(1);
    expect(again.player.auto.stopReason).toBe(
      "Nenhuma arma equipada com munição",
    );
    expect(armed(again.player)).toBe(false);
  });

  it("MIA também para", () => {
    const { player } = autoPlayer("short");
    const ctx = autoCtx([SHORT_MAP]);
    startAuto(player, 0);
    autoTick(player, ctx, 0);
    expect(player.auto.stopReason).toBe("O PMC ficou MIA");
  });

  it("vida baixa: espera curar ou para", () => {
    const { player } = autoPlayer();
    player.auto.rules.minHealth = 0.9;
    player.pmc.health.thorax = 1;
    startAuto(player, 0);
    expect(autoTick(player, autoCtx(), 500)).toEqual([]);
    expect(player.auto).toMatchObject({ running: true, nextAt: 500 });
    player.pmc.health.thorax = 85;
    expect(autoTick(player, autoCtx(), 600)).toHaveLength(1);
    expect(player.raid.active!.startedAt).toBe(500);

    const other = autoPlayer();
    other.player.auto.rules.minHealth = 0.9;
    other.player.auto.rules.lowHealth = "stop";
    other.player.pmc.health.thorax = 1;
    startAuto(other.player, 0);
    autoTick(other.player, autoCtx(), 0);
    expect(other.player.auto.stopReason).toBe("Vida abaixo de 90%");
  });

  it("loadout: some, falta item, ou compra o que falta", () => {
    const { player } = autoPlayer();
    player.auto.rules.loadout = "L";
    startAuto(player, 0);
    autoTick(player, autoCtx(), 0);
    expect(player.auto.stopReason).toBe('O loadout "L" não existe mais');

    player.loadouts.push({
      name: "L",
      slots: {},
      magazines: {},
      carried: [
        { item: "ammo_9mm", count: 10 },
        { item: "sumiu", count: 1 },
      ],
    });
    startAuto(player, 0);
    autoTick(player, autoCtx(), 0);
    expect(player.auto.stopReason).toBe(
      `Faltou equipamento do loadout: ${player.factory.catalog.get("ammo_9mm").name}, sumiu`,
    );

    player.loadouts[0].carried = [{ item: "ammo_9mm", count: 10 }];
    player.auto.rules.buyMissing = true;
    const money = player.factory.create("money_rub", 10_000);
    player.inventory.stash.place(money, 0, 0, false);
    startAuto(player, 0);
    expect(autoTick(player, autoCtx(), 0)).toHaveLength(1);
  });

  it("sem buyMissing, monta do estoque", () => {
    const { player } = autoPlayer();
    player.auto.rules.loadout = "L";
    player.loadouts.push({ name: "L", slots: {}, magazines: {}, carried: [] });
    startAuto(player, 0);
    expect(autoTick(player, autoCtx(), 0)).toHaveLength(1);
  });

  it("sem arma com munição, não entra", () => {
    const { player, pistol } = autoPlayer();
    pistol.magazine!.rounds!.length = 0;
    startAuto(player, 0);
    autoTick(player, autoCtx(), 0);
    expect(player.auto.stopReason).toBe("Nenhuma arma equipada com munição");
  });
});
