import { hideoutTick } from "../hideout/hideout.ts";
import { weaponRounds } from "../inventory/magazine.ts";
import { applyLoadout, loadMagazines, quickEquip } from "../loadout/loadout.ts";
import type { LoadoutItem } from "../loadout/types.ts";
import { totalHealth, totalMaxHealth } from "../pmc/pmc.ts";
import { recordRaidQuests } from "../quests/quests.ts";
import { MS_PER_RAID_MINUTE, finishRaid, startRaid } from "../raid/profile.ts";
import type { ActiveRaid, MapDef } from "../raid/types.ts";
import type { PlayerState } from "../state.ts";
import type { AutoContext, AutoEntry, AutoRules, AutoState } from "./types.ts";

/** Pausa entre o fim do log de uma raid e o começo da próxima */
export const AUTO_GAP_MS = 5000;
/** Resultados guardados no histórico */
export const AUTO_LOG_SIZE = 20;
/** Máximo de raids numa sequência */
export const MAX_AUTO_RAIDS = 50;

export function createAutoRules(): AutoRules {
  return {
    map: "",
    strategy: "balanced",
    loadout: null,
    buyMissing: false,
    maxRaids: 5,
    minHealth: 0.6,
    lowHealth: "wait",
    stopOnDeath: true,
  };
}

export function createAutoState(): AutoState {
  return {
    rules: createAutoRules(),
    running: false,
    done: 0,
    nextAt: 0,
    current: null,
    log: [],
    stopReason: null,
  };
}

/** Quando o log da raid termina de ser mostrado */
export function raidEndsAt(raid: ActiveRaid): number {
  return raid.startedAt + raid.summary.minutes * MS_PER_RAID_MINUTE;
}

/** Mapa das regras (id inválido = o primeiro mapa) */
export function autoMap(rules: AutoRules, maps: readonly MapDef[]): MapDef {
  return maps.find((m) => m.id === rules.map) ?? maps[0];
}

/** Começa uma sequência nova com as regras atuais */
export function startAuto(player: PlayerState, now: number): void {
  const auto = player.auto;
  auto.running = true;
  auto.done = 0;
  auto.log = [];
  auto.stopReason = null;
  auto.nextAt = now;
}

export function stopAuto(player: PlayerState, reason: string): void {
  player.auto.running = false;
  player.auto.stopReason = reason;
}

/** Alguma arma vestida com munição no carregador */
export function armed(player: PlayerState): boolean {
  const { equipment } = player.inventory;
  return (["primary", "secondary", "holster"] as const).some((slot) => {
    const weapon = equipment.get(slot);
    return weapon !== null && weaponRounds(weapon) > 0;
  });
}

function names(player: PlayerState, items: readonly LoadoutItem[]): string {
  const { catalog } = player.factory;
  return items
    .map(({ item }) => (catalog.has(item) ? catalog.get(item).name : item))
    .join(", ");
}

/**
 * Confere as regras e monta o loadout antes de uma raid. Devolve o motivo de
 * parar, `"wait"` (vida baixa, esperando curar) ou `null` (pode entrar).
 */
function prepare(
  player: PlayerState,
  ctx: AutoContext,
  now: number,
): string | null {
  const { rules } = player.auto;
  const health = totalHealth(player.pmc) / totalMaxHealth();
  if (health < rules.minHealth) {
    return rules.lowHealth === "wait"
      ? "wait"
      : `Vida abaixo de ${Math.round(rules.minHealth * 100)}%`;
  }
  if (rules.loadout !== null) {
    const loadout = player.loadouts.find((l) => l.name === rules.loadout);
    if (!loadout) return `O loadout "${rules.loadout}" não existe mais`;
    const report = rules.buyMissing
      ? quickEquip(player, loadout, ctx.shop, now).apply
      : applyLoadout(player, loadout);
    const lacking = [...report.missing, ...report.noSpace];
    if (lacking.length > 0) {
      return `Faltou equipamento do loadout: ${names(player, lacking)}`;
    }
    loadMagazines(player, loadout);
  }
  if (!armed(player)) return "Nenhuma arma equipada com munição";
  return null;
}

/**
 * Faz andar a sequência até `now` (também o tempo com o jogo fechado): fecha
 * a raid automática cujo log terminou e começa a próxima no momento certo
 * (`nextAt`), com o esconderijo calculado até ali. Uma raid começada pelo
 * jogador fica até ele fechar. Devolve os resultados das raids começadas.
 */
export function autoTick(
  player: PlayerState,
  ctx: AutoContext,
  now: number,
): AutoEntry[] {
  const auto = player.auto;
  const started: AutoEntry[] = [];
  for (;;) {
    const active = player.raid.active;
    if (active) {
      if (auto.current !== active.startedAt || now < raidEndsAt(active)) break;
      finishRaid(player, active);
      auto.current = null;
    }
    if (!auto.running || now < auto.nextAt) break;
    const t = auto.nextAt;
    hideoutTick(player, ctx.hideout, t);
    const blocked = prepare(player, ctx, t);
    if (blocked === "wait") {
      auto.nextAt = now;
      break;
    }
    if (blocked !== null) {
      stopAuto(player, blocked);
      break;
    }
    const { rules } = auto;
    const raid = startRaid(
      player,
      autoMap(rules, ctx.maps),
      rules.strategy,
      ctx.enemies,
      { now: () => t },
    );
    recordRaidQuests(player, ctx.quests, raid);
    auto.done += 1;
    auto.current = raid.startedAt;
    auto.nextAt = raidEndsAt(raid) + AUTO_GAP_MS;
    const { summary } = raid;
    const entry: AutoEntry = {
      n: auto.done,
      map: summary.map,
      outcome: summary.outcome,
      minutes: summary.minutes,
      lootValue: summary.lootValue,
      xp: summary.xp,
      kills: summary.kills.scav + summary.kills.pmc,
    };
    auto.log = [entry, ...auto.log].slice(0, AUTO_LOG_SIZE);
    started.push(entry);
    if (rules.stopOnDeath && summary.outcome !== "extracted") {
      stopAuto(
        player,
        summary.outcome === "killed" ? "O PMC morreu" : "O PMC ficou MIA",
      );
    } else if (auto.done >= rules.maxRaids) {
      stopAuto(player, `Concluiu ${auto.done} raid(s)`);
    }
  }
  return started;
}
