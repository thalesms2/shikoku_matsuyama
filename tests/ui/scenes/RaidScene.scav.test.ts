// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import type { RaidSummary } from "../../../src/core/raid/types.ts";
import { MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  RaidScene,
  scavSummaryLines,
  summaryLines,
} from "../../../src/ui/scenes/RaidScene.ts";

const TRANSFER = {
  stored: [
    { def: "pistol_pk9", name: "Pistola PK-9", count: 1 },
    { def: "barter_bolts", name: "Parafusos", count: 2 },
  ],
  storedValue: 11500,
  left: [],
};

const SCAV: RaidSummary = {
  outcome: "extracted",
  map: "outskirts",
  strategy: "stealth",
  minutes: 18,
  kills: { scav: 0, pmc: 1 },
  loot: [{ def: "barter_bolts", name: "Parafusos", count: 2 }],
  lootValue: 5000,
  lost: [],
  xp: 0,
  skillXp: {},
  karma: 0,
  extract: "Estrada do Posto",
  killedBy: null,
  scav: TRANSFER,
};

describe("resumo da raid Scav", () => {
  it("extraiu: loot e o que foi para o estoque", () => {
    expect(summaryLines(SCAV)).toEqual([
      "Extração: Estrada do Posto",
      "Tempo: 18:00",
      "Abates: 0 Scav, 1 PMC",
      "Loot: Parafusos x2 (5.000 ₽)",
      "Levado ao estoque: Pistola PK-9, Parafusos x2 (11.500 ₽)",
      "Raid Scav: sem XP e sem mudança de karma",
    ]);
  });

  it("sem espaço no estoque", () => {
    const lines = scavSummaryLines(SCAV, {
      ...TRANSFER,
      left: [{ def: "food_can", name: "Lata de carne", count: 1 }],
    });
    expect(lines).toContain("Sem espaço no estoque: Lata de carne");
  });

  it("morreu ou MIA: o PMC não perde nada", () => {
    const dead = {
      ...SCAV,
      outcome: "killed" as const,
      killedBy: "um PMC inimigo",
      lost: [{ def: "pistol_pk9", name: "Pistola PK-9", count: 1 }],
      scav: { stored: [], storedValue: 0, left: [] },
    };
    expect(summaryLines(dead)).toEqual([
      "Morto por um PMC inimigo",
      "Tempo: 18:00",
      "Abates: 0 Scav, 1 PMC",
      "Perdido: Pistola PK-9",
      "O PMC não perdeu nada",
      "Raid Scav: sem XP e sem mudança de karma",
    ]);
    const mia = scavSummaryLines(
      { ...dead, outcome: "mia", killedBy: null },
      dead.scav,
    );
    expect(mia[0]).toBe("Tempo: 18:00");
  });

  it("cabeçalho mostra que é Scav", () => {
    const player = createNewPlayer(new ManualClock());
    player.raid.active = { startedAt: 0, events: [], summary: SCAV };
    const scene = new RaidScene(player, {
      clock: new ManualClock(0),
      map: MAPS[0],
      onDone: vi.fn(),
    });
    expect(scene.header.text).toBe("Periferia Norte · Scav · Furtivo");
    expect(scene.summaryText.text).toContain("Levado ao estoque");
  });
});
