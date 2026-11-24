import { Container, Graphics, Text } from "pixi.js";

import type { Clock } from "../../core/clock.ts";
import { SKILL_INFO } from "../../core/pmc/skills.ts";
import type { SkillId } from "../../core/pmc/skills.ts";
import {
  MS_PER_RAID_MINUTE,
  eventsUntil,
  finishRaid,
  raidFinished,
  raidMinuteAt,
} from "../../core/raid/profile.ts";
import { STRATEGIES } from "../../core/raid/strategy.ts";
import type {
  ActiveRaid,
  ItemSummary,
  MapDef,
  RaidEventKind,
  RaidOutcome,
  RaidSummary,
  ScavTransfer,
} from "../../core/raid/types.ts";
import type { PlayerState } from "../../core/state.ts";
import { Button } from "../components/Button.ts";
import { formatPrice } from "../inventory/layout.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";

const WIDTH = 760;
const LOG_LINES = 16;
const LINE_HEIGHT = 20;
const LOG_TOP = 80;
export const SPEEDS = [1, 4, 16] as const;

const GOOD = 0x6abf4b;
const BAD = 0xd9534f;
const WARN = 0xd9a441;

/** Cor de cada tipo de evento no log */
export function eventColor(kind: RaidEventKind): number {
  switch (kind) {
    case "loot":
    case "kill":
    case "avoid":
    case "heal":
      return GOOD;
    case "wounded":
    case "death":
    case "mia":
    case "starving":
    case "hazard":
      return BAD;
    case "encounter":
    case "lootSwap":
    case "lootLeft":
    case "flee":
      return WARN;
    case "extract":
    case "start":
      return theme.accent;
    default:
      return theme.text;
  }
}

/** Minuto da raid como `mm:ss` */
export function formatRaidTime(minute: number): string {
  const total = Math.floor(minute * 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export const OUTCOME_TITLES: Record<RaidOutcome, string> = {
  extracted: "EXTRAIU",
  killed: "MORTO EM COMBATE",
  mia: "DESAPARECIDO (MIA)",
};

const listItems = (items: readonly ItemSummary[]) =>
  items.length > 0
    ? items
        .map((i) => (i.count > 1 ? `${i.name} x${i.count}` : i.name))
        .join(", ")
    : "nada";

/** Linhas do resumo da raid Scav */
export function scavSummaryLines(
  summary: RaidSummary,
  transfer: ScavTransfer,
): string[] {
  const lines: string[] = [];
  if (summary.outcome === "extracted")
    lines.push(`Extração: ${summary.extract}`);
  else if (summary.killedBy) lines.push(`Morto por ${summary.killedBy}`);
  lines.push(`Tempo: ${formatRaidTime(summary.minutes)}`);
  lines.push(`Abates: ${summary.kills.scav} Scav, ${summary.kills.pmc} PMC`);
  if (summary.outcome === "extracted") {
    lines.push(
      `Loot: ${listItems(summary.loot)} (${formatPrice(summary.lootValue)})`,
    );
    lines.push(
      `Levado ao estoque: ${listItems(transfer.stored)} (${formatPrice(transfer.storedValue)})`,
    );
    if (transfer.left.length > 0) {
      lines.push(`Sem espaço no estoque: ${listItems(transfer.left)}`);
    }
  } else {
    lines.push(`Perdido: ${listItems(summary.lost)}`);
    lines.push("O PMC não perdeu nada");
  }
  lines.push("Raid Scav: sem XP e sem mudança de karma");
  return lines;
}

/** Linhas do resumo pós-raid */
export function summaryLines(summary: RaidSummary): string[] {
  if (summary.scav) return scavSummaryLines(summary, summary.scav);
  const lines: string[] = [];
  if (summary.outcome === "extracted")
    lines.push(`Extração: ${summary.extract}`);
  else if (summary.killedBy) lines.push(`Morto por ${summary.killedBy}`);
  lines.push(`Tempo: ${formatRaidTime(summary.minutes)}`);
  lines.push(`Abates: ${summary.kills.scav} Scav, ${summary.kills.pmc} PMC`);
  lines.push(
    `${summary.outcome === "extracted" ? "Loot" : "Loot salvo (contêiner seguro)"}: ${listItems(summary.loot)} (${formatPrice(summary.lootValue)})`,
  );
  if (summary.outcome !== "extracted") {
    lines.push(`Perdido: ${listItems(summary.lost)}`);
  }
  lines.push(
    summary.outcome === "extracted"
      ? `XP: +${summary.xp}`
      : "XP: nenhum (só as skills ficam)",
  );
  const skills = (Object.entries(summary.skillXp) as [SkillId, number][]).map(
    ([id, xp]) => `${SKILL_INFO[id].name} +${xp}`,
  );
  lines.push(`Skills: ${skills.length > 0 ? skills.join(", ") : "nada"}`);
  const sign = summary.karma > 0 ? "+" : "";
  lines.push(`Karma: ${sign}${summary.karma}`);
  return lines;
}

/**
 * Raid em andamento: mostra o log no ritmo do relógio (a raid já foi
 * resolvida; aqui só é revelada), com velocidades e "Pular", e o resumo no
 * fim. Ao fechar o resumo o perfil é liberado para a próxima raid.
 */
export class RaidScene implements Scene {
  readonly view = new Container({ label: "RaidScene" });
  readonly content = new Container({ label: "content" });
  readonly raid: ActiveRaid;
  readonly header: Text;
  readonly timeText: Text;
  readonly log = new Container({ label: "log" });
  readonly speedButtons: Button[];
  readonly skipButton: Button;
  readonly summaryPanel = new Container({ label: "summary" });
  readonly summaryTitle: Text;
  readonly summaryText: Text;
  readonly doneButton: Button;
  /** Depois do fim: alterna entre o resumo e o log completo */
  readonly toggleButton: Button;
  showLog = false;
  minute: number;
  speed: number = SPEEDS[0];
  private shown = -1;

  constructor(
    readonly player: PlayerState,
    readonly options: {
      clock: Clock;
      map: MapDef;
      onDone: () => void;
    },
  ) {
    const raid = player.raid.active;
    if (!raid) throw new Error("Não há raid em andamento");
    this.raid = raid;
    this.minute = raidMinuteAt(options.clock.now() - raid.startedAt);

    this.header = new Text({
      text: [
        options.map.name,
        ...(raid.summary.scav ? ["Scav"] : []),
        STRATEGIES[raid.summary.strategy].name,
      ].join(" · "),
      style: {
        fill: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: 22,
        fontWeight: "bold",
      },
    });
    this.timeText = new Text({
      text: "",
      position: { x: 0, y: 36 },
      style: {
        fill: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 14,
      },
    });
    const logBg = new Graphics()
      .rect(0, 0, WIDTH, LOG_LINES * LINE_HEIGHT + 16)
      .fill({ color: 0x0d0f12 });
    logBg.position.set(0, LOG_TOP - 8);
    this.log.position.set(12, LOG_TOP);

    this.speedButtons = SPEEDS.map((speed, i) => {
      const button = new Button(`x${speed}`, () => this.setSpeed(speed), 56);
      button.position.set(WIDTH - 300 + i * 64, 30);
      return button;
    });
    this.skipButton = new Button("Pular", () => this.skip(), 100);
    this.skipButton.position.set(WIDTH - 100, 30);

    this.summaryTitle = new Text({
      text: OUTCOME_TITLES[raid.summary.outcome],
      style: {
        fill: raid.summary.outcome === "extracted" ? GOOD : BAD,
        fontFamily: theme.fontFamily,
        fontSize: 26,
        fontWeight: "bold",
      },
    });
    this.summaryText = new Text({
      text: summaryLines(raid.summary).join("\n"),
      position: { x: 0, y: 40 },
      style: {
        fill: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: 14,
        lineHeight: 22,
        wordWrap: true,
        wordWrapWidth: WIDTH - 220,
      },
    });
    this.doneButton = new Button(
      "Voltar ao esconderijo",
      () => this.done(),
      200,
      36,
    );
    this.doneButton.position.set(WIDTH - 200, 0);
    const panelBg = new Graphics()
      .rect(-16, -16, WIDTH + 32, LOG_LINES * LINE_HEIGHT + 32)
      .fill({ color: theme.background })
      .stroke({ width: 1, color: theme.accent, alpha: 0.6 });
    this.summaryPanel.addChild(
      panelBg,
      this.summaryTitle,
      this.summaryText,
      this.doneButton,
    );
    this.summaryPanel.position.set(0, LOG_TOP);
    this.toggleButton = new Button("Ver log", () => this.toggleLog(), 120);
    this.toggleButton.position.set(WIDTH - 120, 30);
    this.summaryPanel.visible = false;

    this.content.addChild(
      this.header,
      this.timeText,
      logBg,
      this.log,
      ...this.speedButtons,
      this.skipButton,
      this.summaryPanel,
      this.toggleButton,
    );
    this.view.addChild(this.content);
    this.refresh();
  }

  get finished(): boolean {
    return raidFinished(this.raid, this.minute);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.refresh();
  }

  /** Mostra o log inteiro e o resumo */
  skip(): void {
    this.minute = this.raid.summary.minutes;
    this.refresh();
  }

  toggleLog(): void {
    this.showLog = !this.showLog;
    this.refresh();
  }

  done(): void {
    finishRaid(this.player, this.raid);
    this.options.onDone();
  }

  update(deltaMs: number): void {
    if (this.finished) return;
    this.minute += (deltaMs * this.speed) / MS_PER_RAID_MINUTE;
    this.refresh();
  }

  refresh(): void {
    const minute = Math.min(this.minute, this.raid.summary.minutes);
    this.timeText.text = `Tempo de raid: ${formatRaidTime(minute)}`;
    this.speedButtons.forEach((button, i) => {
      button.alpha = SPEEDS[i] === this.speed ? 1 : 0.55;
    });
    const events = eventsUntil(this.raid, minute);
    if (events.length !== this.shown) {
      this.shown = events.length;
      for (const child of this.log.removeChildren()) child.destroy();
      events.slice(-LOG_LINES).forEach((event, i) => {
        this.log.addChild(
          new Text({
            text: `${formatRaidTime(event.t)}  ${event.text}`,
            position: { x: 0, y: i * LINE_HEIGHT },
            style: {
              fill: eventColor(event.kind),
              fontFamily: theme.fontFamily,
              fontSize: 14,
            },
          }),
        );
      });
    }
    const finished = this.finished;
    this.summaryPanel.visible = finished && !this.showLog;
    this.toggleButton.visible = finished;
    this.toggleButton.text.text = this.showLog ? "Ver resumo" : "Ver log";
    for (const button of [...this.speedButtons, this.skipButton]) {
      button.visible = !finished;
    }
  }

  resize(width: number, height: number): void {
    const h = LOG_TOP + LOG_LINES * LINE_HEIGHT + 40;
    const scale = Math.min(1.5, width / (WIDTH + 64), height / (h + 64));
    this.content.scale.set(scale);
    this.content.position.set(
      (width - WIDTH * scale) / 2,
      (height - h * scale) / 2,
    );
  }
}
