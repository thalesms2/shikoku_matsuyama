import { Container, Text } from "pixi.js";

import type { Clock } from "../../core/clock.ts";
import type { Catalog } from "../../core/inventory/item.ts";
import {
  acceptQuest,
  completeQuest,
  deliverItems,
  missingRequirements,
  objectiveDone,
  questStatus,
} from "../../core/quests/quests.ts";
import type {
  QuestContext,
  QuestDef,
  QuestObjective,
  QuestStatus,
} from "../../core/quests/types.ts";
import { STRATEGIES } from "../../core/raid/strategy.ts";
import type { PlayerState } from "../../core/state.ts";
import type { TradeResult } from "../../core/trade/types.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";
import { ERROR_COLOR, OK_COLOR, formatMoney } from "./TradersScene.ts";

const WIDTH = 940;
const RIGHT = 310;
const OBJECTIVES_TOP = 196;
const OBJECTIVE_HEIGHT = 30;
const CONTENT_HEIGHT = 500;

const style = (extra: object = {}) => ({
  fill: theme.text,
  fontFamily: theme.fontFamily,
  fontSize: 13,
  ...extra,
});

export const STATUS_LABELS: Record<QuestStatus, string> = {
  locked: "bloqueada",
  available: "disponível",
  active: "ativa",
  ready: "entregar!",
  completed: "concluída",
};

/** Ordem da lista: prontas, ativas, disponíveis, bloqueadas, concluídas */
const STATUS_ORDER: QuestStatus[] = [
  "ready",
  "active",
  "available",
  "locked",
  "completed",
];

const named = (catalog: Catalog, item: string, count: number) => {
  const name = catalog.get(item).name;
  return count > 1 ? `${name} x${count}` : name;
};

/** Texto do objetivo */
export function describeObjective(
  objective: QuestObjective,
  catalog: Catalog,
  ctx: QuestContext,
): string {
  const map = (id?: string) => ctx.maps.find((m) => m.id === id);
  const onMap = (id?: string) => (id ? ` em ${map(id)!.name}` : "");
  switch (objective.kind) {
    case "deliver":
      return `Entregar ${named(catalog, objective.item, objective.count)}${objective.fir ? " (encontrados na raid)" : ""}`;
    case "find":
      return `Sair de uma raid com ${named(catalog, objective.item, objective.count)}${onMap(objective.map)}`;
    case "kill": {
      const target =
        objective.target === "scav" ? "Scav(s)" : "PMC(s) inimigo(s)";
      return `Abater ${objective.count} ${target}${onMap(objective.map)}`;
    }
    case "extract": {
      let text = "Extrair";
      if (objective.map) text += ` de ${map(objective.map)!.name}`;
      if (objective.extract) {
        const exit = map(objective.map)!.extracts.find(
          (e) => e.id === objective.extract,
        )!;
        text += ` pela saída ${exit.name}`;
      }
      if (objective.strategy) {
        text += ` com a estratégia ${STRATEGIES[objective.strategy].name}`;
      }
      return objective.count > 1 ? `${text} (${objective.count} vezes)` : text;
    }
  }
}

/** Recompensas em uma linha (inclui as ofertas que a quest libera) */
export function describeRewards(
  def: QuestDef,
  catalog: Catalog,
  ctx: QuestContext,
): string {
  const parts: string[] = [];
  if (def.rewards.xp) parts.push(`XP +${def.rewards.xp}`);
  for (const { item, count } of def.rewards.items ?? []) {
    parts.push(
      catalog.get(item).category === "money"
        ? formatMoney(count, item, catalog)
        : named(catalog, item, count),
    );
  }
  for (const { trader, amount } of def.rewards.reputation ?? []) {
    const name = ctx.traders.find((t) => t.id === trader)!.name;
    parts.push(`reputação +${amount.toFixed(2)} com ${name}`);
  }
  for (const trader of ctx.traders) {
    for (const offer of trader.offers.filter((o) => o.quest === def.id)) {
      parts.push(`libera ${catalog.get(offer.item).name} com ${trader.name}`);
    }
  }
  if (def.final) parts.push("a fuga da cidade");
  return parts.length > 0 ? parts.join(" · ") : "nenhuma";
}

/**
 * Quests: lista com o status de cada uma e a ficha da selecionada
 * (objetivos e progresso, requisitos, recompensas). Aceita, entrega itens e
 * conclui quests.
 */
export class QuestsScene implements Scene {
  readonly view = new Container({ label: "QuestsScene" });
  readonly content = new Container({ label: "content" });
  readonly backButton: Button;
  readonly list = new Container({ label: "list" });
  questButtons = new Map<string, Button>();
  readonly titleText: Text;
  readonly descriptionText: Text;
  readonly objectives = new Container({ label: "objectives" });
  /** Botões "Entregar" por índice de objetivo */
  deliverButtons = new Map<number, Button>();
  readonly detailsText: Text;
  readonly actionButton: Button;
  readonly messageText: Text;
  selected: QuestDef;

  constructor(
    readonly player: PlayerState,
    readonly options: {
      ctx: QuestContext;
      clock: Clock;
      onBack: () => void;
      /** Chamado ao concluir a quest final */
      onEnding?: () => void;
    },
  ) {
    const title = new Text({
      text: "Quests",
      style: style({ fill: theme.accent, fontSize: 24, fontWeight: "bold" }),
    });
    this.backButton = new Button("Voltar ao inventário", options.onBack, 180);
    this.backButton.position.set(WIDTH - 180, 2);
    this.list.position.set(0, 50);
    this.titleText = new Text({
      text: "",
      position: { x: RIGHT, y: 48 },
      style: style({ fill: theme.accent, fontSize: 20, fontWeight: "bold" }),
    });
    this.descriptionText = new Text({
      text: "",
      position: { x: RIGHT, y: 78 },
      style: style({
        lineHeight: 18,
        wordWrap: true,
        wordWrapWidth: WIDTH - RIGHT,
      }),
    });
    this.objectives.position.set(RIGHT, OBJECTIVES_TOP);
    this.detailsText = new Text({
      text: "",
      position: { x: RIGHT, y: OBJECTIVES_TOP + 3 * OBJECTIVE_HEIGHT + 12 },
      style: style({
        lineHeight: 19,
        wordWrap: true,
        wordWrapWidth: WIDTH - RIGHT,
      }),
    });
    this.actionButton = new Button("", () => this.act(), 160, 34);
    this.actionButton.position.set(WIDTH - 160, CONTENT_HEIGHT - 60);
    this.messageText = new Text({
      text: "",
      position: { x: RIGHT, y: CONTENT_HEIGHT - 52 },
      style: style(),
    });
    this.content.addChild(
      title,
      this.backButton,
      this.list,
      this.titleText,
      this.descriptionText,
      this.objectives,
      this.detailsText,
      this.actionButton,
      this.messageText,
    );
    this.view.addChild(this.content);
    this.selected = this.ordered()[0];
    this.refresh();
  }

  get ctx(): QuestContext {
    return this.options.ctx;
  }

  get now(): number {
    return this.options.clock.now();
  }

  status(def: QuestDef): QuestStatus {
    return questStatus(this.player, this.ctx, def, this.now);
  }

  /** Quests na ordem da lista (por status, depois a ordem dos dados) */
  ordered(): QuestDef[] {
    return STATUS_ORDER.flatMap((s) =>
      this.ctx.quests.filter((q) => this.status(q) === s),
    );
  }

  select(def: QuestDef): void {
    this.selected = def;
    this.messageText.text = "";
    this.refresh();
  }

  /** Aceitar (disponível) ou concluir (pronta) a quest selecionada */
  act(): TradeResult | null {
    const def = this.selected;
    const status = this.status(def);
    if (status === "available") {
      return this.show(
        acceptQuest(this.player, this.ctx, def.id, this.now),
        "Quest aceita",
      );
    }
    if (status === "ready") {
      const result = this.show(
        completeQuest(this.player, this.ctx, def.id, this.now),
        "Quest concluída",
      );
      if (result.ok && def.final) this.options.onEnding?.();
      if (result.ok && def.repeatable) {
        // A concluída some: seleciona a nova do mesmo vendedor
        this.selected = this.ordered().find(
          (q) => q.repeatable && q.trader === def.trader,
        )!;
        this.refresh();
      }
      return result;
    }
    return null;
  }

  deliver(index: number): TradeResult {
    const result = deliverItems(this.player, this.ctx, this.selected.id, index);
    return this.show(result, result.ok ? `Entregou ${result.amount}` : "");
  }

  private show(result: TradeResult, okText: string): TradeResult {
    this.messageText.text = result.ok ? okText : result.reason;
    this.messageText.style.fill = result.ok ? OK_COLOR : ERROR_COLOR;
    this.refresh();
    return result;
  }

  refresh(): void {
    const { catalog } = this.player.factory;
    for (const child of this.list.removeChildren()) child.destroy();
    this.questButtons = new Map();
    this.ordered().forEach((def, i) => {
      const button = new Button(
        `${def.name} · ${STATUS_LABELS[this.status(def)]}`,
        () => this.select(def),
        280,
        30,
      );
      button.position.set(0, i * 34);
      button.alpha = def === this.selected ? 1 : 0.6;
      this.list.addChild(button);
      this.questButtons.set(def.id, button);
    });

    const def = this.selected;
    const status = this.status(def);
    const trader = this.ctx.traders.find((t) => t.id === def.trader)!;
    this.titleText.text = def.name;
    this.descriptionText.text = `${trader.name}${def.main ? " · Cadeia principal" : ""}${def.repeatable ? " · Repetível" : ""} · ${STATUS_LABELS[status]}\n${def.description}`;

    for (const child of this.objectives.removeChildren()) child.destroy();
    this.deliverButtons = new Map();
    const progress = this.player.quests[def.id]?.progress ?? [];
    def.objectives.forEach((objective, i) => {
      const y = i * OBJECTIVE_HEIGHT;
      const value = Math.min(progress[i] ?? 0, objective.count);
      const done = objectiveDone(objective, value);
      const line = new Text({
        text: `${done ? "Feito" : `${value}/${objective.count}`} — ${describeObjective(objective, catalog, this.ctx)}`,
        position: { x: 0, y: y + 6 },
        style: style({ fill: done ? OK_COLOR : theme.text }),
      });
      this.objectives.addChild(line);
      if (objective.kind === "deliver" && status === "active" && !done) {
        const button = new Button("Entregar", () => this.deliver(i), 90, 26);
        button.position.set(WIDTH - RIGHT - 90, y);
        this.objectives.addChild(button);
        this.deliverButtons.set(i, button);
      }
    });

    const details: string[] = [];
    if (status === "locked") {
      details.push(
        `Requisitos: ${missingRequirements(this.player, this.ctx, def, this.now).join("; ")}`,
      );
    }
    details.push(`Recompensas: ${describeRewards(def, catalog, this.ctx)}`);
    this.detailsText.text = details.join("\n");

    const action =
      status === "available"
        ? "Aceitar"
        : status === "ready"
          ? "Concluir"
          : null;
    this.actionButton.visible = action !== null;
    this.actionButton.text.text = action ?? "";
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
