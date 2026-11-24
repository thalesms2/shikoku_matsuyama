import type { Clock } from "../clock.ts";
import { weaponRounds } from "../inventory/magazine.ts";
import { MAX_HEALTH, VITAL_PARTS } from "../pmc/pmc.ts";
import { Rng } from "../rng.ts";
import type { PlayerState } from "../state.ts";
import { simulateRaid } from "./simulate.ts";
import { clampKarma } from "./strategy.ts";
import type {
  ActiveRaid,
  EnemyDef,
  EnemyKind,
  MapDef,
  RaidEvent,
  RaidProfile,
  RaidStats,
  RaidSummary,
  ScavProfile,
  StrategyId,
} from "./types.ts";

/** Milissegundos reais por minuto de raid, na velocidade normal */
export const MS_PER_RAID_MINUTE = 2000;

export function createRaidStats(): RaidStats {
  return {
    raids: 0,
    extracted: 0,
    killed: 0,
    mia: 0,
    kills: { scav: 0, pmc: 0 },
  };
}

/** Conta uma raid nas estatísticas */
export function recordRaid(
  stats: RaidStats,
  summary: Pick<RaidSummary, "outcome" | "kills">,
): void {
  stats.raids++;
  stats[summary.outcome]++;
  stats.kills.scav += summary.kills.scav;
  stats.kills.pmc += summary.kills.pmc;
}

/** Raid Scav liberada desde o começo */
export function createScavProfile(): ScavProfile {
  return { readyAt: 0, stats: createRaidStats() };
}

export function createRaidProfile(seed: number): RaidProfile {
  return {
    karma: 0,
    stats: createRaidStats(),
    lootRule: "valuePerCell",
    seed: seed >>> 0,
    active: null,
  };
}

/** Avisos antes de entrar na raid (não impedem a entrada) */
export function raidWarnings(player: PlayerState): string[] {
  const { equipment } = player.inventory;
  const warnings: string[] = [];
  const armed = (["primary", "secondary", "holster"] as const).some((slot) => {
    const weapon = equipment.get(slot);
    return weapon !== null && weaponRounds(weapon) > 0;
  });
  if (!armed) warnings.push("Nenhuma arma equipada com munição");
  if (!equipment.get("armor")) warnings.push("Sem colete balístico");
  if (!equipment.get("helmet")) warnings.push("Sem capacete");
  if (VITAL_PARTS.some((p) => player.pmc.health[p] < MAX_HEALTH[p] / 2)) {
    warnings.push("Cabeça ou tórax muito feridos");
  }
  return warnings;
}

/**
 * Entra na raid: resolve a simulação inteira na hora (com a seed do perfil),
 * aplica o resultado ao jogador e guarda o log para ser mostrado em tempo
 * real. A seed muda a cada raid, então recarregar o jogo não muda o sorteio.
 */
export function startRaid(
  player: PlayerState,
  map: MapDef,
  strategy: StrategyId,
  enemies: Readonly<Record<EnemyKind, EnemyDef>>,
  clock: Clock,
): ActiveRaid {
  const profile = player.raid;
  const rng = new Rng(profile.seed);
  const { events, summary } = simulateRaid({
    player,
    map,
    strategy,
    enemies,
    rng,
    lootRule: profile.lootRule,
  });
  profile.seed = Math.floor(rng.next() * 2 ** 32);
  profile.karma = clampKarma(profile.karma + summary.karma);
  recordRaid(profile.stats, summary);
  profile.active = { startedAt: clock.now(), events, summary };
  return profile.active;
}

/** Minuto de raid mostrado `elapsedMs` depois do começo, na velocidade normal */
export function raidMinuteAt(elapsedMs: number): number {
  return Math.max(0, elapsedMs) / MS_PER_RAID_MINUTE;
}

/** Eventos que já aconteceram até o minuto `minute` */
export function eventsUntil(raid: ActiveRaid, minute: number): RaidEvent[] {
  return raid.events.filter((e) => e.t <= minute);
}

/** Se o log da raid já chegou ao fim no minuto `minute` */
export function raidFinished(raid: ActiveRaid, minute: number): boolean {
  return minute >= raid.summary.minutes;
}

/**
 * Fecha a tela de resultado: o jogador volta ao esconderijo. Com `raid`, só
 * fecha se ela ainda for a raid em andamento (uma raid automática mais nova
 * não é apagada por uma tela antiga).
 */
export function finishRaid(player: PlayerState, raid?: ActiveRaid): void {
  if (raid && player.raid.active !== raid) return;
  player.raid.active = null;
}
