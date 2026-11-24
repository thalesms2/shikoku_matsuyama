// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { MS_PER_RAID_MINUTE } from "../../../src/core/raid/profile.ts";
import type {
  ActiveRaid,
  RaidEvent,
  RaidSummary,
} from "../../../src/core/raid/types.ts";
import { MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  OUTCOME_TITLES,
  RaidScene,
  SPEEDS,
  eventColor,
  formatRaidTime,
  summaryLines,
} from "../../../src/ui/scenes/RaidScene.ts";
import { theme } from "../../../src/ui/theme.ts";

const SUMMARY: RaidSummary = {
  outcome: "extracted",
  map: "outskirts",
  strategy: "balanced",
  minutes: 20,
  kills: { scav: 2, pmc: 1 },
  loot: [
    { def: "barter_bolts", name: "Parafusos", count: 3 },
    { def: "food_can", name: "Lata de carne", count: 1 },
  ],
  lootValue: 9000,
  lost: [],
  xp: 650,
  skillXp: { endurance: 10, aim: 3 },
  karma: -0.4,
  extract: "Estrada do Posto",
  killedBy: null,
};

function raidWith(events: RaidEvent[], summary: Partial<RaidSummary> = {}) {
  return {
    startedAt: 0,
    events,
    summary: { ...SUMMARY, ...summary },
  } satisfies ActiveRaid;
}

const EVENTS: RaidEvent[] = [
  { t: 0, kind: "start", text: "Entrou" },
  { t: 2, kind: "loot", text: "Encontrou Parafusos" },
  { t: 10, kind: "kill", text: "Abateu um Scav" },
  { t: 20, kind: "extract", text: "Extraiu" },
];

function setup(raid: ActiveRaid = raidWith(EVENTS), now = 0) {
  const player = createNewPlayer(new ManualClock());
  player.raid.active = raid;
  const onDone = vi.fn();
  const scene = new RaidScene(player, {
    clock: new ManualClock(now),
    map: MAPS[0],
    onDone,
  });
  const lines = () => scene.log.children.map((c) => (c as Text).text);
  return { scene, player, onDone, lines };
}

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

describe("formatação", () => {
  it("tempo como mm:ss", () => {
    expect(formatRaidTime(0)).toBe("00:00");
    expect(formatRaidTime(12.5)).toBe("12:30");
  });

  it("cores por tipo de evento", () => {
    expect(eventColor("loot")).toBe(0x6abf4b);
    expect(eventColor("wounded")).toBe(0xd9534f);
    expect(eventColor("encounter")).toBe(0xd9a441);
    expect(eventColor("extract")).toBe(theme.accent);
    expect(eventColor("quiet")).toBe(theme.text);
  });

  it("resumo de extração", () => {
    expect(summaryLines(SUMMARY)).toEqual([
      "Extração: Estrada do Posto",
      "Tempo: 20:00",
      "Abates: 2 Scav, 1 PMC",
      "Loot: Parafusos x3, Lata de carne (9.000 ₽)",
      "XP: +650",
      "Skills: Resistência +10, Mira +3",
      "Karma: -0.4",
    ]);
  });

  it("resumo de morte: quem matou, o que perdeu, sem XP", () => {
    const lines = summaryLines({
      ...SUMMARY,
      outcome: "killed",
      killedBy: "um PMC inimigo",
      loot: [],
      lootValue: 0,
      lost: [{ def: "pistol_pk9", name: "Pistola PK-9", count: 1 }],
      xp: 0,
      skillXp: {},
      karma: 0.1,
    });
    expect(lines).toEqual([
      "Morto por um PMC inimigo",
      "Tempo: 20:00",
      "Abates: 2 Scav, 1 PMC",
      "Loot salvo (contêiner seguro): nada (0 ₽)",
      "Perdido: Pistola PK-9",
      "XP: nenhum (só as skills ficam)",
      "Skills: nada",
      "Karma: +0.1",
    ]);
  });

  it("MIA não tem atirador", () => {
    const lines = summaryLines({ ...SUMMARY, outcome: "mia", karma: 0 });
    expect(lines[0]).toBe("Tempo: 20:00");
    expect(lines.at(-1)).toBe("Karma: 0");
  });
});

describe("RaidScene", () => {
  it("sem raid em andamento não abre", () => {
    const player = createNewPlayer(new ManualClock());
    expect(
      () =>
        new RaidScene(player, {
          clock: new ManualClock(),
          map: MAPS[0],
          onDone: () => {},
        }),
    ).toThrow("Não há raid em andamento");
  });

  it("continua de onde o relógio está (raid em andamento com o jogo fechado)", () => {
    const { scene, lines } = setup(raidWith(EVENTS), 3 * MS_PER_RAID_MINUTE);
    expect(scene.minute).toBe(3);
    expect(scene.header.text).toBe("Periferia Norte · Equilibrado");
    expect(scene.timeText.text).toBe("Tempo de raid: 03:00");
    expect(lines()).toEqual(["00:00  Entrou", "02:00  Encontrou Parafusos"]);
    expect(scene.summaryPanel.visible).toBe(false);
  });

  it("update avança no ritmo da velocidade escolhida", () => {
    const { scene, lines } = setup();
    scene.update(MS_PER_RAID_MINUTE * 2);
    expect(scene.minute).toBe(2);
    expect(lines()).toHaveLength(2);
    tap(scene.speedButtons[2]);
    expect(scene.speed).toBe(SPEEDS[2]);
    expect(scene.speedButtons[2].alpha).toBe(1);
    expect(scene.speedButtons[0].alpha).toBeLessThan(1);
    scene.update(MS_PER_RAID_MINUTE / 2);
    expect(scene.minute).toBe(10);
    expect(lines()).toHaveLength(3);
  });

  it("chegando ao fim mostra o resumo e para de avançar", () => {
    const { scene } = setup();
    scene.update(MS_PER_RAID_MINUTE * 25);
    expect(scene.finished).toBe(true);
    expect(scene.timeText.text).toBe("Tempo de raid: 20:00");
    expect(scene.summaryPanel.visible).toBe(true);
    expect(scene.summaryTitle.text).toBe(OUTCOME_TITLES.extracted);
    expect(scene.summaryText.text).toContain("XP: +650");
    expect(scene.skipButton.visible).toBe(false);
    expect(scene.speedButtons.every((b) => !b.visible)).toBe(true);
    const minute = scene.minute;
    scene.update(1000);
    expect(scene.minute).toBe(minute);
  });

  it("Pular mostra tudo; o botão alterna entre resumo e log", () => {
    const { scene, lines } = setup();
    expect(scene.toggleButton.visible).toBe(false);
    tap(scene.skipButton);
    expect(lines()).toHaveLength(4);
    expect(scene.toggleButton.visible).toBe(true);
    tap(scene.toggleButton);
    expect(scene.summaryPanel.visible).toBe(false);
    expect(scene.toggleButton.text.text).toBe("Ver resumo");
    tap(scene.toggleButton);
    expect(scene.summaryPanel.visible).toBe(true);
    expect(scene.toggleButton.text.text).toBe("Ver log");
  });

  it("título vermelho para morte", () => {
    const { scene } = setup(raidWith(EVENTS, { outcome: "killed" }));
    expect(scene.summaryTitle.text).toBe(OUTCOME_TITLES.killed);
    expect(scene.summaryTitle.style.fill).toBe(0xd9534f);
  });

  it("o log mostra só as últimas linhas", () => {
    const many: RaidEvent[] = Array.from({ length: 30 }, (_, i) => ({
      t: i,
      kind: "quiet",
      text: `evento ${i}`,
    }));
    const { scene, lines } = setup(raidWith(many, { minutes: 29 }));
    scene.skip();
    expect(lines()).toHaveLength(16);
    expect(lines()[0]).toBe("14:00  evento 14");
  });

  it("voltar libera o perfil e avisa o jogo", () => {
    const { scene, player, onDone } = setup();
    scene.skip();
    tap(scene.doneButton);
    expect(player.raid.active).toBeNull();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("resize escala e centraliza", () => {
    const { scene } = setup();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
    scene.resize(412, 100000);
    expect(scene.content.scale.x).toBeCloseTo(0.5);
    expect(scene.content.x).toBeCloseTo((412 - 760 * 0.5) / 2);
  });
});
