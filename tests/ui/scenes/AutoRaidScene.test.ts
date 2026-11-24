// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { raidEndsAt, startAuto } from "../../../src/core/auto/auto.ts";
import type { AutoEntry } from "../../../src/core/auto/types.ts";
import { ManualClock } from "../../../src/core/clock.ts";
import { startRaid } from "../../../src/core/raid/profile.ts";
import { catalog } from "../../../src/data/items.ts";
import {
  AUTO_REFRESH_MS,
  AutoRaidScene,
  RAID_COUNTS,
  cycle,
  describeAutoRun,
  describeAutoStatus,
  describeEntry,
  describeTotals,
} from "../../../src/ui/scenes/AutoRaidScene.ts";
import {
  DEADLY_MAP,
  SAFE_MAP,
  autoCtx,
  autoPlayer,
} from "../../core/auto/autoFixtures.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

const entry = (extra: Partial<AutoEntry> = {}): AutoEntry => ({
  n: 1,
  map: "safe",
  outcome: "extracted",
  minutes: 20.4,
  lootValue: 12_000,
  xp: 0,
  kills: 0,
  ...extra,
});

describe("textos das raids automáticas", () => {
  it("cycle passa para o próximo e volta ao começo", () => {
    expect(cycle([1, 2, 3], 1)).toBe(2);
    expect(cycle([1, 2, 3], 3)).toBe(1);
    expect(cycle([1, 2, 3], 9)).toBe(1);
  });

  it("linhas do histórico, totais e resumo", () => {
    const maps = [SAFE_MAP];
    expect(describeEntry(entry(), maps, catalog)).toBe(
      "#1 Seguro — Extraiu · 20 min · loot 12.000 ₽",
    );
    expect(
      describeEntry(
        entry({ map: "x", outcome: "killed", xp: 900, kills: 2 }),
        maps,
        catalog,
      ),
    ).toBe("#1 x — Morreu · 20 min · loot 12.000 ₽ · +900 XP · 2 abate(s)");
    expect(describeEntry(entry({ outcome: "mia" }), maps, catalog)).toContain(
      "MIA",
    );
    expect(describeTotals([], catalog)).toBe("Nenhuma raid nesta sequência");
    expect(
      describeTotals(
        [entry({ xp: 100 }), entry({ outcome: "killed", lootValue: 0 })],
        catalog,
      ),
    ).toBe("Extraiu 1 de 2 · loot 12.000 ₽ · +100 XP");
    expect(describeAutoRun([entry(), entry({ outcome: "killed" })])).toBe(
      "Raids automáticas: 2 feita(s), extraiu 1",
    );
  });

  it("situação: parada, rodando, esperando, em andamento", () => {
    const { player } = autoPlayer();
    const { auto } = player;
    expect(describeAutoStatus(player, auto, 0)).toBe("Parado");
    auto.stopReason = "O PMC morreu";
    expect(describeAutoStatus(player, auto, 0)).toBe("Parado: O PMC morreu");

    startAuto(player, 1000);
    expect(describeAutoStatus(player, auto, 1000)).toBe(
      "Rodando: 0/5 raids · começando",
    );
    auto.rules.minHealth = 0.9;
    player.pmc.health.thorax = 1;
    expect(describeAutoStatus(player, auto, 1000)).toBe(
      "Rodando: 0/5 raids · esperando a vida chegar a 90%",
    );
    auto.nextAt = 61_000;
    expect(describeAutoStatus(player, auto, 1000)).toBe(
      "Rodando: 0/5 raids · próxima em 1min",
    );

    const raid = startRaid(player, SAFE_MAP, "balanced", autoCtx().enemies, {
      now: () => 0,
    });
    expect(describeAutoStatus(player, auto, 0)).toBe(
      "Rodando: 0/5 raids · esperando você fechar a raid atual",
    );
    auto.current = raid.startedAt;
    auto.done = 1;
    expect(describeAutoStatus(player, auto, raidEndsAt(raid) - 30_000)).toBe(
      "Rodando: raid 1/5 · em andamento, termina em 30s",
    );
    auto.running = false;
    expect(describeAutoStatus(player, auto, raidEndsAt(raid) - 30_000)).toBe(
      "Última raid · em andamento, termina em 30s",
    );
  });
});

describe("AutoRaidScene", () => {
  function setup() {
    const { player } = autoPlayer();
    const clock = new ManualClock(1000);
    const onBack = vi.fn();
    const onViewRaid = vi.fn();
    const scene = new AutoRaidScene(player, {
      ctx: autoCtx([SAFE_MAP, DEADLY_MAP]),
      clock,
      onBack,
      onViewRaid,
    });
    return { player, clock, scene, onBack, onViewRaid };
  }

  it("as regras mudam pelos botões", () => {
    const { scene, player } = setup();
    const s = scene.settings;
    const { rules } = player.auto;
    expect(s.map.text.text).toBe("Mapa: Seguro");
    tap(s.map);
    expect(s.map.text.text).toBe("Mapa: Mortal");
    expect(s.strategy.text.text).toBe("Estratégia: Equilibrado");
    tap(s.strategy);
    expect(rules.strategy).toBe("aggressive");
    expect(s.loadout.text.text).toBe("Loadout: nenhum (como está)");
    player.loadouts.push({ name: "L", slots: {}, magazines: {}, carried: [] });
    tap(s.loadout);
    expect(s.loadout.text.text).toBe("Loadout: L");
    tap(s.loadout);
    expect(rules.loadout).toBeNull();
    expect(s.buy.text.text).toBe("Comprar o que faltar: não");
    tap(s.buy);
    expect(s.buy.text.text).toBe("Comprar o que faltar: sim");
    tap(s.count);
    expect(rules.maxRaids).toBe(RAID_COUNTS[3]);
    expect(s.count.text.text).toBe(`Raids na sequência: ${RAID_COUNTS[3]}`);
    tap(s.health);
    expect(s.health.text.text).toBe("Vida mínima: 30%");
    expect(s.lowHealth.text.text).toBe("Com vida baixa: esperar curar");
    tap(s.lowHealth);
    expect(s.lowHealth.text.text).toBe("Com vida baixa: parar");
    tap(s.lowHealth);
    expect(rules.lowHealth).toBe("wait");
    expect(s.death.text.text).toBe("Parar se morrer: sim");
    tap(s.death);
    expect(rules.stopOnDeath).toBe(false);
  });

  it("começar faz a primeira raid na hora; ver raid; parar", () => {
    const { scene, player, clock, onViewRaid } = setup();
    expect(scene.runButton.text.text).toBe("Começar");
    expect(scene.viewButton.visible).toBe(false);
    tap(scene.runButton);
    expect(player.raid.active?.startedAt).toBe(1000);
    expect(scene.runButton.text.text).toBe("Parar");
    expect(scene.statusText.text).toContain("Rodando: raid 1/5");
    expect(scene.logText.text).toContain("#1 Seguro");
    expect(scene.totalsText.text).toContain("de 1");
    tap(scene.viewButton);
    expect(onViewRaid).toHaveBeenCalledOnce();

    clock.advance(10_000);
    const before = scene.statusText.text;
    scene.update(AUTO_REFRESH_MS - 1);
    expect(scene.statusText.text).toBe(before);
    scene.update(1);
    expect(scene.statusText.text).not.toBe(before);

    tap(scene.runButton);
    expect(player.auto.stopReason).toBe("Parado pelo jogador");
    expect(scene.runButton.text.text).toBe("Começar");
  });

  it("voltar e redimensionar", () => {
    const { scene, onBack } = setup();
    tap(scene.backButton);
    expect(onBack).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
  });
});
