import { describe, expect, it } from "vitest";

import { xpForLevel } from "../../../src/core/pmc/pmc.ts";
import {
  acceptQuest,
  completeQuest,
  deliverItems,
  missingRequirements,
  objectiveDone,
  progressAfterRaid,
  questById,
  questStatus,
} from "../../../src/core/quests/quests.ts";
import type { QuestContext, QuestDef } from "../../../src/core/quests/types.ts";
import type { RaidSummary } from "../../../src/core/raid/types.ts";
import { countInStash } from "../../../src/core/trade/trade.ts";
import { MAPS } from "../../../src/data/maps.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import { trader } from "../trade/tradeFixtures.ts";

const FIRST: QuestDef = {
  id: "first",
  name: "Primeira",
  trader: "doctor",
  description: "",
  requires: {},
  objectives: [{ kind: "deliver", item: "barter_bolts", count: 3 }],
  rewards: {
    xp: 500,
    items: [
      { item: "money_rub", count: 1000 },
      { item: "med_kit", count: 1 },
    ],
    reputation: [{ trader: "doctor", amount: 0.1 }],
  },
};

const SECOND: QuestDef = {
  id: "second",
  name: "Segunda",
  trader: "merchant",
  description: "",
  final: true,
  requires: {
    quests: ["first"],
    pmcLevel: 2,
    loyalty: { trader: "merchant", level: 2 },
  },
  objectives: [
    { kind: "extract", count: 2, map: "harbor", extract: "smuggler-boat" },
    { kind: "kill", target: "pmc", count: 2, map: "cement" },
    { kind: "find", item: "food_water", count: 2 },
    { kind: "extract", count: 1, strategy: "stealth" },
    { kind: "deliver", item: "barter_goldchain", count: 1, fir: true },
  ],
  rewards: {},
};

const CTX: QuestContext = {
  quests: [FIRST, SECOND],
  traders: TRADERS,
  maps: MAPS,
};

const SUMMARY: RaidSummary = {
  outcome: "extracted",
  map: "harbor",
  strategy: "balanced",
  minutes: 20,
  kills: { scav: 1, pmc: 1 },
  loot: [{ def: "food_water", name: "Garrafa de água", count: 1 }],
  lootValue: 1800,
  lost: [],
  xp: 0,
  skillXp: {},
  karma: 0,
  extract: "Barco do Contrabandista",
  killedBy: null,
};

describe("requisitos e status", () => {
  it("busca por id", () => {
    expect(questById(CTX, "first")).toBe(FIRST);
    expect(questById(CTX, "nada")).toBeNull();
  });

  it("requisitos que faltam e status", () => {
    const { player } = trader();
    expect(missingRequirements(player, CTX, FIRST, 0)).toEqual([]);
    expect(questStatus(player, CTX, FIRST, 0)).toBe("available");
    expect(missingRequirements(player, CTX, SECOND, 0)).toEqual([
      "PMC nível 2",
      'Concluir "Primeira"',
      "Lealdade nível 2 com Mercador Tito",
    ]);
    expect(questStatus(player, CTX, SECOND, 0)).toBe("locked");
    player.quests.first = { status: "completed", progress: [3] };
    player.pmc.xp = xpForLevel(5);
    player.traders.merchant = {
      reputation: 1,
      volume: 1e7,
      bought: {},
      restockAt: 0,
    };
    expect(questStatus(player, CTX, SECOND, 0)).toBe("available");
    expect(questStatus(player, CTX, FIRST, 0)).toBe("completed");
  });

  it("quest de outro jogo como requisito aparece pelo id", () => {
    const { player } = trader();
    const odd = { ...FIRST, requires: { quests: ["sumiu"] } };
    expect(missingRequirements(player, CTX, odd, 0)).toEqual([
      'Concluir "sumiu"',
    ]);
  });

  it("progresso salvo mais curto que os objetivos conta 0", () => {
    const { player } = trader();
    player.quests.first = { status: "active", progress: [] };
    expect(questStatus(player, CTX, FIRST, 0)).toBe("active");
  });

  it("objetivo cumprido", () => {
    expect(objectiveDone(FIRST.objectives[0], 2)).toBe(false);
    expect(objectiveDone(FIRST.objectives[0], 3)).toBe(true);
  });
});

describe("aceitar, entregar e concluir", () => {
  it("fluxo completo com recompensas", () => {
    const { player, put } = trader();
    expect(acceptQuest(player, CTX, "first", 0)).toEqual({
      ok: true,
      amount: 0,
    });
    expect(player.quests.first).toEqual({ status: "active", progress: [0] });
    expect(questStatus(player, CTX, FIRST, 0)).toBe("active");
    expect(acceptQuest(player, CTX, "first", 0)).toEqual({
      ok: false,
      reason: "A quest não está disponível",
    });
    expect(deliverItems(player, CTX, "first", 0)).toEqual({
      ok: false,
      reason: "Nenhum item para entregar",
    });
    put("barter_bolts");
    put("barter_bolts");
    expect(deliverItems(player, CTX, "first", 0)).toEqual({
      ok: true,
      amount: 2,
    });
    expect(completeQuest(player, CTX, "first", 0)).toEqual({
      ok: false,
      reason: "Os objetivos ainda não foram cumpridos",
    });
    for (let i = 0; i < 5; i++) put("barter_bolts");
    expect(deliverItems(player, CTX, "first", 0)).toEqual({
      ok: true,
      amount: 1,
    });
    expect(countInStash(player.inventory.stash, "barter_bolts")).toBe(4);
    expect(deliverItems(player, CTX, "first", 0)).toEqual({
      ok: false,
      reason: "Objetivo já cumprido",
    });
    expect(questStatus(player, CTX, FIRST, 0)).toBe("ready");
    expect(completeQuest(player, CTX, "first", 0)).toEqual({
      ok: true,
      amount: 0,
    });
    expect(player.quests.first.status).toBe("completed");
    expect(player.pmc.xp).toBe(500);
    expect(countInStash(player.inventory.stash, "money_rub")).toBe(1000);
    expect(countInStash(player.inventory.stash, "med_kit")).toBe(1);
    expect(player.traders.doctor.reputation).toBeCloseTo(0.1);
  });

  it("recompensas sem espaço: não conclui", () => {
    const { player, put } = trader(1, 1);
    player.quests.first = { status: "active", progress: [3] };
    put("barter_bolts");
    expect(completeQuest(player, CTX, "first", 0)).toEqual({
      ok: false,
      reason: "Sem espaço no estoque para as recompensas",
    });
    expect(player.quests.first.status).toBe("active");
    expect(player.pmc.xp).toBe(0);
  });

  it("quest sem recompensas", () => {
    const { player } = trader();
    player.quests.second = { status: "active", progress: [2, 2, 2, 1, 1] };
    expect(completeQuest(player, CTX, "second", 0).ok).toBe(true);
  });

  it("erros: quest inexistente, inativa, objetivo errado", () => {
    const { player } = trader();
    const no = (reason: string) => ({ ok: false, reason });
    expect(acceptQuest(player, CTX, "nada", 0)).toEqual(no("Quest não existe"));
    expect(completeQuest(player, CTX, "nada", 0)).toEqual(
      no("Quest não existe"),
    );
    expect(deliverItems(player, CTX, "nada", 0)).toEqual(
      no("A quest não está ativa"),
    );
    expect(deliverItems(player, CTX, "first", 0)).toEqual(
      no("A quest não está ativa"),
    );
    player.quests.second = { status: "active", progress: [0, 0, 0, 0, 0] };
    expect(deliverItems(player, CTX, "second", 0)).toEqual(
      no("Objetivo não é de entrega"),
    );
    expect(deliverItems(player, CTX, "second", 9)).toEqual(
      no("Objetivo não é de entrega"),
    );
  });

  it("entrega com `fir` só aceita itens encontrados na raid", () => {
    const { player, put } = trader();
    player.quests.second = { status: "active", progress: [0, 0, 0, 0] };
    put("barter_goldchain");
    expect(deliverItems(player, CTX, "second", 4)).toEqual({
      ok: false,
      reason: "Nenhum item encontrado na raid para entregar",
    });
    put("barter_goldchain").fir = true;
    // progresso salvo sem este objetivo começa em 0
    expect(deliverItems(player, CTX, "second", 4)).toEqual({
      ok: true,
      amount: 1,
    });
    expect(player.quests.second.progress[4]).toBe(1);
    expect(countInStash(player.inventory.stash, "barter_goldchain")).toBe(1);
  });
});

describe("progressAfterRaid", () => {
  const active = () => {
    const { player } = trader();
    player.quests.second = { status: "active", progress: [0, 0, 0, 0, 0] };
    return player;
  };

  it("extração pela saída certa, abates no mapa, itens encontrados", () => {
    const player = active();
    expect(progressAfterRaid(player, CTX, SUMMARY)).toEqual([SECOND]);
    // abates eram no Porto, não na Cimenteira; estratégia não era furtiva
    expect(player.quests.second.progress).toEqual([1, 0, 1, 0, 0]);
    progressAfterRaid(player, CTX, {
      ...SUMMARY,
      map: "cement",
      strategy: "stealth",
      kills: { scav: 0, pmc: 5 },
      loot: [
        { def: "food_water", name: "", count: 3 },
        { def: "food_can", name: "", count: 1 },
      ],
    });
    // limitado ao total de cada objetivo
    expect(player.quests.second.progress).toEqual([1, 2, 2, 1, 0]);
  });

  it("saída errada ou outro mapa não contam como extração", () => {
    const player = active();
    progressAfterRaid(player, CTX, { ...SUMMARY, extract: "Cais Sul" });
    expect(player.quests.second.progress[0]).toBe(0);
    progressAfterRaid(player, CTX, {
      ...SUMMARY,
      map: "sumiu",
      extract: "Barco do Contrabandista",
    });
    expect(player.quests.second.progress[0]).toBe(0);
  });

  it("morreu: só os abates contam", () => {
    const player = active();
    progressAfterRaid(player, CTX, {
      ...SUMMARY,
      map: "cement",
      outcome: "killed",
      strategy: "stealth",
    });
    expect(player.quests.second.progress).toEqual([0, 1, 0, 0, 0]);
  });

  it("raid Scav, quest concluída e sem mudança não avançam", () => {
    const player = active();
    const scav = { ...SUMMARY, scav: { stored: [], storedValue: 0, left: [] } };
    expect(progressAfterRaid(player, CTX, scav)).toEqual([]);
    player.quests.first = { status: "completed", progress: [0] };
    const nothing = {
      ...SUMMARY,
      outcome: "mia" as const,
      kills: { scav: 0, pmc: 0 },
    };
    expect(progressAfterRaid(player, CTX, nothing)).toEqual([]);
    expect(player.quests.first.progress).toEqual([0]);
  });

  it("progresso salvo sem o objetivo começa em 0", () => {
    const player = active();
    player.quests.second.progress = [];
    progressAfterRaid(player, CTX, SUMMARY);
    expect(player.quests.second.progress).toEqual([1, 0, 1, 0, 0]);
  });
});
