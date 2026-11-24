import { fleaTick } from "./flea/flea.ts";
import type { FleaConfig } from "./flea/types.ts";
import { hideoutTick, incomeAvailable } from "./hideout/hideout.ts";
import type { HideoutData } from "./hideout/types.ts";
import { totalHealth } from "./pmc/pmc.ts";
import type { PlayerState } from "./state.ts";
import type { TraderDef } from "./trade/types.ts";

/** Ausência mínima para mostrar o resumo */
export const OFFLINE_MIN_MS = 60_000;

/** O que aconteceu entre o último cálculo e agora */
export interface OfflineReport {
  awayMs: number;
  /** Obras concluídas */
  constructions: { module: string; level: number }[];
  /** Receitas que ficaram prontas */
  productions: string[];
  /** Rublos a mais na renda acumulada da central */
  income: number;
  /** Pontos de vida, energia e hidratação recuperados */
  health: number;
  energy: number;
  hydration: number;
  fleaSold: number;
  fleaEarned: number;
  fleaExpired: number;
  /** A raid Scav ficou liberada */
  scavReady: boolean;
  /** Vendedores que repuseram o estoque */
  restocked: string[];
}

export interface OfflineData {
  readonly hideout: HideoutData;
  readonly flea: FleaConfig;
  readonly traders: readonly TraderDef[];
}

/**
 * Passa o tempo com o jogo fechado (esconderijo e mercado) e devolve o que
 * aconteceu desde o último cálculo (`hideout.lastTick`, salvo a cada tick).
 */
export function catchUp(
  player: PlayerState,
  data: OfflineData,
  now: number,
): OfflineReport {
  const since = player.hideout.lastTick;
  const within = (t: number) => t > since && t <= now;
  const { hideout, pmc } = player;
  const job = hideout.construction;
  const constructions =
    job && job.endsAt <= now ? [{ module: job.module, level: job.level }] : [];
  const productions = Object.values(hideout.productions)
    .filter((p) => within(p.endsAt))
    .map((p) => p.recipe);
  const incomeBefore = incomeAvailable(hideout, data.hideout, since);
  const before = {
    health: totalHealth(pmc),
    energy: pmc.energy,
    hydration: pmc.hydration,
  };

  hideoutTick(player, data.hideout, now);
  const results = fleaTick(player, data.flea, now);

  const sold = results.flatMap((r) => (r.kind === "sold" ? [r] : []));
  return {
    awayMs: Math.max(0, now - since),
    constructions,
    productions,
    income: Math.max(
      0,
      incomeAvailable(hideout, data.hideout, now) - incomeBefore,
    ),
    health: totalHealth(pmc) - before.health,
    energy: pmc.energy - before.energy,
    hydration: pmc.hydration - before.hydration,
    fleaSold: sold.length,
    fleaEarned: sold.reduce((sum, r) => sum + r.price, 0),
    fleaExpired: results.length - sold.length,
    scavReady: within(player.scav.readyAt),
    restocked: data.traders
      .filter((t) => {
        const state = player.traders[t.id];
        return state !== undefined && within(state.restockAt);
      })
      .map((t) => t.id),
  };
}

/** Vale mostrar o resumo: ausência longa e algo aconteceu */
export function hasNews(report: OfflineReport): boolean {
  if (report.awayMs < OFFLINE_MIN_MS) return false;
  return (
    report.constructions.length > 0 ||
    report.productions.length > 0 ||
    report.income > 0 ||
    report.health > 0 ||
    report.energy > 0 ||
    report.hydration > 0 ||
    report.fleaSold + report.fleaExpired > 0 ||
    report.scavReady ||
    report.restocked.length > 0
  );
}
