import { Container, Text } from "pixi.js";

import {
  MAX_AUTO_RAIDS,
  autoMap,
  autoTick,
  raidEndsAt,
  startAuto,
  stopAuto,
} from "../../core/auto/auto.ts";
import type {
  AutoContext,
  AutoEntry,
  AutoState,
} from "../../core/auto/types.ts";
import type { Clock } from "../../core/clock.ts";
import type { Catalog } from "../../core/inventory/item.ts";
import { totalHealth, totalMaxHealth } from "../../core/pmc/pmc.ts";
import { STRATEGIES } from "../../core/raid/strategy.ts";
import { STRATEGY_IDS } from "../../core/raid/types.ts";
import type { ActiveRaid, MapDef } from "../../core/raid/types.ts";
import type { PlayerState } from "../../core/state.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";
import { formatDuration } from "./HideoutScene.ts";
import { formatMoney } from "./TradersScene.ts";

const WIDTH = 940;
const RIGHT = 340;
const SETTING_WIDTH = 310;
const CONTENT_HEIGHT = 470;
/** Intervalo de atualização dos textos */
export const AUTO_REFRESH_MS = 500;
/** Opções do número de raids */
export const RAID_COUNTS = [1, 3, 5, 10, 20, MAX_AUTO_RAIDS];
/** Linhas do histórico mostradas */
export const AUTO_LOG_LINES = 10;

const OUTCOME_LABELS = {
  extracted: "Extraiu",
  killed: "Morreu",
  mia: "MIA",
} as const;

const style = (extra: object = {}) => ({
  fill: theme.text,
  fontFamily: theme.fontFamily,
  fontSize: 13,
  ...extra,
});

/** Próximo valor da lista (volta ao começo); valor fora da lista = o primeiro */
export function cycle<T>(values: readonly T[], current: T): T {
  return values[(values.indexOf(current) + 1) % values.length];
}

/** Uma linha do histórico */
export function describeEntry(
  entry: AutoEntry,
  maps: readonly MapDef[],
  catalog: Catalog,
): string {
  const map = maps.find((m) => m.id === entry.map)?.name ?? entry.map;
  const parts = [
    `#${entry.n} ${map} — ${OUTCOME_LABELS[entry.outcome]}`,
    `${Math.round(entry.minutes)} min`,
    `loot ${formatMoney(entry.lootValue, "money_rub", catalog)}`,
  ];
  if (entry.xp > 0) parts.push(`+${entry.xp} XP`);
  if (entry.kills > 0) parts.push(`${entry.kills} abate(s)`);
  return parts.join(" · ");
}

/** Totais do histórico */
export function describeTotals(log: readonly AutoEntry[], catalog: Catalog) {
  if (log.length === 0) return "Nenhuma raid nesta sequência";
  const extracted = log.filter((e) => e.outcome === "extracted").length;
  const loot = log.reduce((sum, e) => sum + e.lootValue, 0);
  const xp = log.reduce((sum, e) => sum + e.xp, 0);
  return `Extraiu ${extracted} de ${log.length} · loot ${formatMoney(loot, "money_rub", catalog)} · +${xp} XP`;
}

/** Linha do resumo do tempo fora: raids feitas com o jogo fechado */
export function describeAutoRun(entries: readonly AutoEntry[]): string {
  const extracted = entries.filter((e) => e.outcome === "extracted").length;
  return `Raids automáticas: ${entries.length} feita(s), extraiu ${extracted}`;
}

/** Situação da sequência agora */
export function describeAutoStatus(
  player: PlayerState,
  auto: AutoState,
  now: number,
): string {
  const active: ActiveRaid | null = player.raid.active;
  if (active && auto.current === active.startedAt) {
    const prefix = auto.running
      ? `Rodando: raid ${auto.done}/${auto.rules.maxRaids}`
      : "Última raid";
    return `${prefix} · em andamento, termina em ${formatDuration(raidEndsAt(active) - now)}`;
  }
  if (!auto.running) {
    return auto.stopReason ? `Parado: ${auto.stopReason}` : "Parado";
  }
  const head = `Rodando: ${auto.done}/${auto.rules.maxRaids} raids`;
  if (active) return `${head} · esperando você fechar a raid atual`;
  if (now < auto.nextAt) {
    return `${head} · próxima em ${formatDuration(auto.nextAt - now)}`;
  }
  const health = totalHealth(player.pmc) / totalMaxHealth();
  return health < auto.rules.minHealth
    ? `${head} · esperando a vida chegar a ${Math.round(auto.rules.minHealth * 100)}%`
    : `${head} · começando`;
}

/**
 * Raids automáticas: o jogador escolhe mapa, estratégia, loadout e regras
 * de parada; as raids seguem uma depois da outra (também com o jogo fechado).
 */
export class AutoRaidScene implements Scene {
  readonly view = new Container({ label: "AutoRaidScene" });
  readonly content = new Container({ label: "content" });
  readonly backButton: Button;
  readonly settings: Record<
    | "map"
    | "strategy"
    | "loadout"
    | "buy"
    | "count"
    | "health"
    | "lowHealth"
    | "death",
    Button
  >;
  readonly runButton: Button;
  readonly viewButton: Button;
  readonly statusText: Text;
  readonly totalsText: Text;
  readonly logText: Text;
  private elapsed = 0;

  constructor(
    readonly player: PlayerState,
    readonly options: {
      ctx: AutoContext;
      clock: Clock;
      onBack: () => void;
      /** Abre a raid em andamento */
      onViewRaid: () => void;
    },
  ) {
    const title = new Text({
      text: "Raids automáticas",
      style: style({ fill: theme.accent, fontSize: 24, fontWeight: "bold" }),
    });
    this.backButton = new Button("Voltar", options.onBack, 120);
    this.backButton.position.set(WIDTH - 120, 2);
    const rules = () => this.player.auto.rules;
    const setting = (i: number, change: () => void) => {
      const button = new Button(
        "",
        () => {
          change();
          this.refresh();
        },
        SETTING_WIDTH,
        30,
      );
      button.position.set(0, 50 + i * 38);
      return button;
    };
    const { maps } = options.ctx;
    this.settings = {
      map: setting(0, () => {
        rules().map = cycle(
          maps.map((m) => m.id),
          autoMap(rules(), maps).id,
        );
      }),
      strategy: setting(1, () => {
        rules().strategy = cycle(STRATEGY_IDS, rules().strategy);
      }),
      loadout: setting(2, () => {
        rules().loadout = cycle(
          [null, ...this.player.loadouts.map((l) => l.name)],
          rules().loadout,
        );
      }),
      buy: setting(3, () => {
        rules().buyMissing = !rules().buyMissing;
      }),
      count: setting(4, () => {
        rules().maxRaids = cycle(RAID_COUNTS, rules().maxRaids);
      }),
      health: setting(5, () => {
        const steps = [0, 0.3, 0.5, 0.6, 0.8, 0.9];
        rules().minHealth = cycle(steps, rules().minHealth);
      }),
      lowHealth: setting(6, () => {
        rules().lowHealth = rules().lowHealth === "wait" ? "stop" : "wait";
      }),
      death: setting(7, () => {
        rules().stopOnDeath = !rules().stopOnDeath;
      }),
    };
    this.runButton = new Button("", () => this.toggleRun(), 150, 36);
    this.runButton.position.set(0, 50 + 8 * 38 + 10);
    this.viewButton = new Button("Ver raid atual", options.onViewRaid, 150, 36);
    this.viewButton.position.set(160, 50 + 8 * 38 + 10);
    this.statusText = new Text({
      text: "",
      position: { x: RIGHT, y: 50 },
      style: style({ fontSize: 15, fontWeight: "bold" }),
    });
    this.totalsText = new Text({
      text: "",
      position: { x: RIGHT, y: 78 },
      style: style({ fill: theme.textMuted }),
    });
    this.logText = new Text({
      text: "",
      position: { x: RIGHT, y: 110 },
      style: style({ lineHeight: 20 }),
    });
    this.content.addChild(
      title,
      this.backButton,
      ...Object.values(this.settings),
      this.runButton,
      this.viewButton,
      this.statusText,
      this.totalsText,
      this.logText,
    );
    this.view.addChild(this.content);
    this.refresh();
  }

  get catalog(): Catalog {
    return this.player.factory.catalog;
  }

  toggleRun(): void {
    const now = this.options.clock.now();
    if (this.player.auto.running) {
      stopAuto(this.player, "Parado pelo jogador");
    } else {
      startAuto(this.player, now);
      autoTick(this.player, this.options.ctx, now);
    }
    this.refresh();
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    if (this.elapsed < AUTO_REFRESH_MS) return;
    this.elapsed = 0;
    this.refresh();
  }

  refresh(): void {
    const { auto } = this.player;
    const { rules } = auto;
    const { maps } = this.options.ctx;
    const yes = (v: boolean) => (v ? "sim" : "não");
    const labels: Record<keyof AutoRaidScene["settings"], string> = {
      map: `Mapa: ${autoMap(rules, maps).name}`,
      strategy: `Estratégia: ${STRATEGIES[rules.strategy].name}`,
      loadout: `Loadout: ${rules.loadout ?? "nenhum (como está)"}`,
      buy: `Comprar o que faltar: ${yes(rules.buyMissing)}`,
      count: `Raids na sequência: ${rules.maxRaids}`,
      health: `Vida mínima: ${Math.round(rules.minHealth * 100)}%`,
      lowHealth: `Com vida baixa: ${rules.lowHealth === "wait" ? "esperar curar" : "parar"}`,
      death: `Parar se morrer: ${yes(rules.stopOnDeath)}`,
    };
    for (const [key, button] of Object.entries(this.settings)) {
      button.text.text = labels[key as keyof typeof labels];
    }
    this.runButton.text.text = auto.running ? "Parar" : "Começar";
    this.viewButton.visible = this.player.raid.active !== null;
    this.statusText.text = describeAutoStatus(
      this.player,
      auto,
      this.options.clock.now(),
    );
    this.totalsText.text = describeTotals(auto.log, this.catalog);
    this.logText.text = auto.log
      .slice(0, AUTO_LOG_LINES)
      .map((e) => describeEntry(e, maps, this.catalog))
      .join("\n");
  }

  resize(width: number, height: number): void {
    const h = CONTENT_HEIGHT;
    const scale = Math.min(1.5, width / (WIDTH + 64), height / (h + 64));
    this.content.scale.set(scale);
    this.content.position.set(
      (width - WIDTH * scale) / 2,
      (height - h * scale) / 2,
    );
  }
}
