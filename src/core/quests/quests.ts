import { addPmcXp, levelForXp } from "../pmc/pmc.ts";
import type { ActiveRaid, QuestUpdate, RaidSummary } from "../raid/types.ts";
import type { PlayerState } from "../state.ts";
import {
  available,
  createStacks,
  loyaltyLevel,
  storeAll,
  take,
  traderState,
} from "../trade/trade.ts";
import type { TradeResult } from "../trade/types.ts";
import type {
  QuestContext,
  QuestDef,
  QuestObjective,
  QuestStatus,
} from "./types.ts";

export function questById(ctx: QuestContext, id: string): QuestDef | null {
  return ctx.quests.find((q) => q.id === id) ?? null;
}

/**
 * Requisitos que faltam para liberar a quest, em texto (vazio = liberada).
 * `now` serve para criar o estado do vendedor se ainda não existir.
 */
export function missingRequirements(
  player: PlayerState,
  ctx: QuestContext,
  def: QuestDef,
  now: number,
): string[] {
  const missing: string[] = [];
  const { pmcLevel, quests = [], loyalty } = def.requires;
  if (pmcLevel && levelForXp(player.pmc.xp) < pmcLevel) {
    missing.push(`PMC nível ${pmcLevel}`);
  }
  for (const id of quests) {
    if (player.quests[id]?.status !== "completed") {
      missing.push(`Concluir "${questById(ctx, id)?.name ?? id}"`);
    }
  }
  if (loyalty) {
    const trader = ctx.traders.find((t) => t.id === loyalty.trader)!;
    const state = traderState(player.traders, trader, now);
    if (loyaltyLevel(trader, state, player.pmc.xp).level < loyalty.level) {
      missing.push(`Lealdade nível ${loyalty.level} com ${trader.name}`);
    }
  }
  return missing;
}

export function objectiveDone(objective: QuestObjective, progress: number) {
  return progress >= objective.count;
}

export function questStatus(
  player: PlayerState,
  ctx: QuestContext,
  def: QuestDef,
  now: number,
): QuestStatus {
  const state = player.quests[def.id];
  if (state?.status === "completed") return "completed";
  if (state) {
    const done = def.objectives.every((o, i) =>
      objectiveDone(o, state.progress[i] ?? 0),
    );
    return done ? "ready" : "active";
  }
  return missingRequirements(player, ctx, def, now).length === 0
    ? "available"
    : "locked";
}

const fail = (reason: string): TradeResult => ({ ok: false, reason });

/** Aceita uma quest liberada */
export function acceptQuest(
  player: PlayerState,
  ctx: QuestContext,
  id: string,
  now: number,
): TradeResult {
  const def = questById(ctx, id);
  if (!def) return fail("Quest não existe");
  if (questStatus(player, ctx, def, now) !== "available") {
    return fail("A quest não está disponível");
  }
  player.quests[id] = {
    status: "active",
    progress: def.objectives.map(() => 0),
  };
  return { ok: true, amount: 0 };
}

/**
 * Entrega itens do estoque para um objetivo `deliver` (pode ser em partes).
 * Devolve quantas unidades foram entregues.
 */
export function deliverItems(
  player: PlayerState,
  ctx: QuestContext,
  id: string,
  index: number,
): TradeResult {
  const def = questById(ctx, id);
  const state = player.quests[id];
  if (!def || state?.status !== "active") return fail("A quest não está ativa");
  const objective = def.objectives[index];
  if (objective?.kind !== "deliver") return fail("Objetivo não é de entrega");
  const fir = objective.fir === true;
  // Quest salva antes de ganhar objetivos novos: o que falta começa em 0
  const done = state.progress[index] ?? 0;
  const missing = objective.count - done;
  if (missing <= 0) return fail("Objetivo já cumprido");
  const amount = Math.min(missing, available(player, objective.item, fir));
  if (amount === 0) {
    return fail(
      fir
        ? "Nenhum item encontrado na raid para entregar"
        : "Nenhum item para entregar",
    );
  }
  take(player, objective.item, amount, fir);
  state.progress[index] = done + amount;
  return { ok: true, amount };
}

/**
 * Entrega a quest com os objetivos cumpridos: itens no estoque (tudo ou
 * nada), XP do PMC e reputação com os vendedores.
 */
export function completeQuest(
  player: PlayerState,
  ctx: QuestContext,
  id: string,
  now: number,
): TradeResult {
  const def = questById(ctx, id);
  if (!def) return fail("Quest não existe");
  if (questStatus(player, ctx, def, now) !== "ready") {
    return fail("Os objetivos ainda não foram cumpridos");
  }
  const { catalog } = player.factory;
  const items = (def.rewards.items ?? []).flatMap((r) =>
    createStacks(player, catalog.get(r.item), r.count),
  );
  if (!storeAll(items, player.inventory.stash)) {
    return fail("Sem espaço no estoque para as recompensas");
  }
  if (def.rewards.xp) addPmcXp(player.pmc, def.rewards.xp);
  for (const { trader, amount } of def.rewards.reputation ?? []) {
    const traderDef = ctx.traders.find((t) => t.id === trader)!;
    traderState(player.traders, traderDef, now).reputation += amount;
  }
  player.quests[id].status = "completed";
  return { ok: true, amount: 0 };
}

/** Quanto a raid conta para o objetivo */
function raidProgress(
  objective: QuestObjective,
  summary: RaidSummary,
  ctx: QuestContext,
): number {
  if (objective.kind === "deliver") return 0;
  if (objective.map && objective.map !== summary.map) return 0;
  const extracted = summary.outcome === "extracted";
  switch (objective.kind) {
    case "kill":
      // Abates contam mesmo se o PMC morrer
      return summary.kills[objective.target];
    case "find":
      if (!extracted) return 0;
      return summary.loot
        .filter((l) => l.def === objective.item)
        .reduce((sum, l) => sum + l.count, 0);
    case "extract": {
      if (!extracted) return 0;
      if (objective.strategy && objective.strategy !== summary.strategy) {
        return 0;
      }
      if (objective.extract) {
        const map = ctx.maps.find((m) => m.id === summary.map);
        const exit = map?.extracts.find((e) => e.id === objective.extract);
        if (exit?.name !== summary.extract) return 0;
      }
      return 1;
    }
  }
}

/**
 * Soma o resultado da raid às quests (como `progressAfterRaid`) e guarda em
 * `raid.quests` o que avançou, para o resumo. Devolve a lista guardada.
 */
export function recordRaidQuests(
  player: PlayerState,
  ctx: QuestContext,
  raid: ActiveRaid,
): QuestUpdate[] {
  const before = new Map(
    Object.entries(player.quests).map(([id, s]) => [id, [...s.progress]]),
  );
  const updates = progressAfterRaid(player, ctx, raid.summary).map((def) => {
    const progress = player.quests[def.id]!.progress;
    const from = before.get(def.id)!;
    const objectives = def.objectives.flatMap((o, index) => {
      const old = from[index] ?? 0;
      const now = progress[index];
      return now > old ? [{ index, from: old, to: now, count: o.count }] : [];
    });
    const ready = def.objectives.every((o, i) => objectiveDone(o, progress[i]));
    return { quest: def.id, name: def.name, objectives, ready };
  });
  raid.quests = updates;
  return updates;
}

/**
 * Soma o resultado de uma raid do PMC às quests ativas (raids Scav não
 * contam). Devolve as quests que avançaram.
 */
export function progressAfterRaid(
  player: PlayerState,
  ctx: QuestContext,
  summary: RaidSummary,
): QuestDef[] {
  if (summary.scav) return [];
  const advanced: QuestDef[] = [];
  for (const def of ctx.quests) {
    const state = player.quests[def.id];
    if (state?.status !== "active") continue;
    let changed = false;
    def.objectives.forEach((objective, i) => {
      const current = state.progress[i] ?? 0;
      const gain = raidProgress(objective, summary, ctx);
      const next = Math.min(objective.count, current + gain);
      if (next > current) changed = true;
      state.progress[i] = next;
    });
    if (changed) advanced.push(def);
  }
  return advanced;
}
