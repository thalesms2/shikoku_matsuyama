import { Container, Text } from "pixi.js";

import type { Clock } from "../../core/clock.ts";
import {
  collectIncome,
  collectProduction,
  currentLevel,
  effect,
  incomeAvailable,
  moduleLevel,
  nextModuleLevel,
  productionBlockers,
  buildDuration,
  recipeDuration,
  startProduction,
  startUpgrade,
  upgradeBlockers,
} from "../../core/hideout/hideout.ts";
import type {
  HideoutData,
  ItemAmount,
  ModuleDef,
  ModuleEffects,
  RecipeDef,
} from "../../core/hideout/types.ts";
import type { Catalog } from "../../core/inventory/item.ts";
import {
  MAX_ENERGY,
  MAX_HYDRATION,
  totalHealth,
  totalMaxHealth,
} from "../../core/pmc/pmc.ts";
import type { PlayerState } from "../../core/state.ts";
import type { TradeResult, TraderDef } from "../../core/trade/types.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";
import { ERROR_COLOR, OK_COLOR, formatMoney } from "./TradersScene.ts";

const WIDTH = 940;
const RIGHT = 230;
const ROWS_TOP = 300;
const ROW_HEIGHT = 34;
const CONTENT_HEIGHT = 560;
/** Intervalo de atualização dos textos (contagens) */
export const REFRESH_MS = 500;

const style = (extra: object = {}) => ({
  fill: theme.text,
  fontFamily: theme.fontFamily,
  fontSize: 13,
  ...extra,
});

/** Duração legível: `2h 30min`, `45min`, `20s` */
export function formatDuration(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Efeitos de um nível em texto */
export function describeEffects(effects: ModuleEffects, catalog: Catalog) {
  const parts: string[] = [];
  if (effects.stashRows) parts.push(`+${effects.stashRows} linhas no estoque`);
  if (effects.healPerMinute) parts.push(`cura ${effects.healPerMinute} PV/min`);
  if (effects.energyPerMinute) {
    parts.push(`+${effects.energyPerMinute} energia/min`);
  }
  if (effects.hydrationPerMinute) {
    parts.push(`+${effects.hydrationPerMinute} hidratação/min`);
  }
  if (effects.productionSpeed) {
    parts.push(
      `produções ${Math.round(effects.productionSpeed * 100)}% mais rápidas`,
    );
  }
  if (effects.incomePerHour) {
    parts.push(
      `${formatMoney(effects.incomePerHour, "money_rub", catalog)}/h (máx. ${formatMoney(effects.incomeCap ?? 0, "money_rub", catalog)})`,
    );
  }
  if (effects.scavCooldown) {
    parts.push(
      `espera da raid Scav −${Math.round(effects.scavCooldown * 100)}%`,
    );
  }
  if (effects.surgeryMinutes) {
    parts.push(`opera 1 parte destruída a cada ${effects.surgeryMinutes} min`);
  }
  return parts.length > 0 ? parts.join(", ") : "libera receitas";
}

/** Lista de itens: `Parafusos x2 + 30.000 ₽` (vazia: "nada") */
export function describeItems(items: readonly ItemAmount[], catalog: Catalog) {
  if (items.length === 0) return "nada";
  return items
    .map(({ item, count }) => {
      const def = catalog.get(item);
      if (def.category === "money") return formatMoney(count, item, catalog);
      return count > 1 ? `${def.name} x${count}` : def.name;
    })
    .join(" + ");
}

interface Row {
  label: string;
  action: string;
  enabled: boolean;
  run: () => void;
}

/**
 * Esconderijo: módulos com nível, efeitos, obra do próximo nível, produções
 * da oficina/cozinha e a renda da central. O tempo passa pelo `hideoutTick`
 * do jogo; aqui só se mostra e se age.
 */
export class HideoutScene implements Scene {
  readonly view = new Container({ label: "HideoutScene" });
  readonly content = new Container({ label: "content" });
  readonly backButton: Button;
  readonly pmcText: Text;
  readonly moduleButtons = new Map<string, Button>();
  readonly nameText: Text;
  readonly infoText: Text;
  readonly upgradeText: Text;
  readonly upgradeButton: Button;
  readonly rows = new Container({ label: "rows" });
  rowButtons: Button[] = [];
  readonly messageText: Text;
  module: ModuleDef;
  private elapsed = 0;

  constructor(
    readonly player: PlayerState,
    readonly options: {
      data: HideoutData;
      traders: readonly TraderDef[];
      clock: Clock;
      onBack: () => void;
    },
  ) {
    this.module = options.data.modules[0];
    const title = new Text({
      text: "Esconderijo",
      style: style({ fill: theme.accent, fontSize: 24, fontWeight: "bold" }),
    });
    this.pmcText = new Text({
      text: "",
      position: { x: RIGHT, y: 8 },
      style: style({ fill: theme.textMuted }),
    });
    this.backButton = new Button("Voltar ao inventário", options.onBack, 180);
    this.backButton.position.set(WIDTH - 180, 2);
    options.data.modules.forEach((def, i) => {
      const button = new Button(def.name, () => this.select(def), 200, 34);
      button.position.set(0, 50 + i * 44);
      this.moduleButtons.set(def.id, button);
      this.content.addChild(button);
    });
    this.nameText = new Text({
      text: "",
      position: { x: RIGHT, y: 48 },
      style: style({ fill: theme.accent, fontSize: 20, fontWeight: "bold" }),
    });
    this.infoText = new Text({
      text: "",
      position: { x: RIGHT, y: 78 },
      style: style({
        lineHeight: 18,
        wordWrap: true,
        wordWrapWidth: WIDTH - RIGHT,
      }),
    });
    this.upgradeText = new Text({
      text: "",
      position: { x: RIGHT, y: 178 },
      style: style({
        lineHeight: 18,
        wordWrap: true,
        wordWrapWidth: WIDTH - RIGHT - 180,
      }),
    });
    this.upgradeButton = new Button("", () => this.upgrade(), 160, 34);
    this.upgradeButton.position.set(WIDTH - 160, 178);
    this.rows.position.set(RIGHT, ROWS_TOP);
    this.messageText = new Text({
      text: "",
      position: { x: RIGHT, y: CONTENT_HEIGHT - 30 },
      style: style(),
    });
    this.content.addChild(
      title,
      this.pmcText,
      this.backButton,
      this.nameText,
      this.infoText,
      this.upgradeText,
      this.upgradeButton,
      this.rows,
      this.messageText,
    );
    this.view.addChild(this.content);
    this.refresh();
  }

  get data(): HideoutData {
    return this.options.data;
  }

  get now(): number {
    return this.options.clock.now();
  }

  get catalog(): Catalog {
    return this.player.factory.catalog;
  }

  select(def: ModuleDef): void {
    this.module = def;
    this.messageText.text = "";
    this.refresh();
  }

  upgrade(): TradeResult {
    const result = startUpgrade(
      this.player,
      this.data,
      this.options.traders,
      this.module.id,
      this.now,
    );
    return this.show(
      result,
      `Obra começou: nível ${result.ok ? result.amount : 0}`,
    );
  }

  produce(recipe: RecipeDef): TradeResult {
    return this.show(
      startProduction(this.player, this.data, recipe.id, this.now),
      "Produção começou",
    );
  }

  collect(): TradeResult {
    const result = collectProduction(
      this.player,
      this.data,
      this.module.id,
      this.now,
    );
    return this.show(result, "Produto guardado no estoque");
  }

  collectIncome(): TradeResult {
    const result = collectIncome(this.player, this.data, this.now);
    return this.show(
      result,
      result.ok
        ? `Coletou ${formatMoney(result.amount, "money_rub", this.catalog)}`
        : "",
    );
  }

  private show(result: TradeResult, okText: string): TradeResult {
    this.messageText.text = result.ok ? okText : result.reason;
    this.messageText.style.fill = result.ok ? OK_COLOR : ERROR_COLOR;
    this.refresh();
    return result;
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    if (this.elapsed < REFRESH_MS) return;
    this.elapsed = 0;
    this.refresh();
  }

  refresh(): void {
    const { pmc } = this.player;
    const state = this.player.hideout;
    const def = this.module;
    this.pmcText.text = `PMC: vida ${Math.round(totalHealth(pmc))}/${totalMaxHealth()} · energia ${Math.round(pmc.energy)}/${MAX_ENERGY} · hidratação ${Math.round(pmc.hydration)}/${MAX_HYDRATION}`;
    for (const [id, button] of this.moduleButtons) {
      const level = moduleLevel(state, id);
      const max = this.data.modules.find((m) => m.id === id)!.levels.length;
      button.text.text = `${this.data.modules.find((m) => m.id === id)!.name} ${level}/${max}`;
      button.alpha = id === def.id ? 1 : 0.6;
    }
    const level = moduleLevel(state, def.id);
    this.nameText.text = `${def.name} · nível ${level}/${def.levels.length}`;
    const current = currentLevel(state, def);
    this.infoText.text = [
      def.description,
      "",
      `Agora: ${current ? describeEffects(current.effects, this.catalog) : "não construído"}`,
    ].join("\n");

    this.refreshUpgrade(def);
    this.refreshRows(def);
  }

  private refreshUpgrade(def: ModuleDef): void {
    const state = this.player.hideout;
    const next = nextModuleLevel(state, def);
    const job = state.construction;
    const building = job?.module === def.id;
    const lines: string[] = [];
    if (building) {
      lines.push(
        `Em obra: nível ${job!.level}, termina em ${formatDuration(job!.endsAt - this.now)}`,
      );
    } else if (next) {
      lines.push(
        `Nível ${next.level}: ${describeEffects(next.effects, this.catalog)}`,
        `Custo: ${describeItems(next.cost, this.catalog)} · obra de ${formatDuration(buildDuration(next))}`,
      );
      const blockers = upgradeBlockers(
        this.player,
        this.data,
        this.options.traders,
        def,
        this.now,
      );
      if (blockers.length > 0) lines.push(`Falta: ${blockers.join("; ")}`);
    } else {
      lines.push("Nível máximo");
    }
    this.upgradeText.text = lines.join("\n");
    this.upgradeButton.visible = next !== null && !building;
    this.upgradeButton.text.text =
      moduleLevel(state, def.id) === 0 ? "Construir" : "Melhorar";
  }

  private refreshRows(def: ModuleDef): void {
    for (const child of this.rows.removeChildren()) child.destroy();
    this.rowButtons = [];
    const rows = [...this.incomeRows(def), ...this.recipeRows(def)];
    rows.forEach((row, i) => {
      const y = i * ROW_HEIGHT;
      const label = new Text({
        text: row.label,
        position: { x: 0, y: y + 6 },
        style: style({ fill: row.enabled ? theme.text : theme.textMuted }),
      });
      const button = new Button(row.action, row.run, 100, 26);
      button.position.set(WIDTH - RIGHT - 100, y);
      button.alpha = row.enabled ? 1 : 0.55;
      this.rows.addChild(label, button);
      this.rowButtons.push(button);
    });
  }

  private incomeRows(def: ModuleDef): Row[] {
    const state = this.player.hideout;
    const current = currentLevel(state, def);
    if (!current?.effects.incomePerHour) return [];
    const amount = incomeAvailable(state, this.data, this.now);
    const cap = effect(state, this.data, "incomeCap");
    return [
      {
        label: `Renda acumulada: ${formatMoney(amount, "money_rub", this.catalog)} de ${formatMoney(cap, "money_rub", this.catalog)}`,
        action: "Coletar",
        enabled: amount > 0,
        run: () => {
          this.collectIncome();
        },
      },
    ];
  }

  private recipeRows(def: ModuleDef): Row[] {
    const state = this.player.hideout;
    const job = state.productions[def.id];
    return this.data.recipes
      .filter((r) => r.module === def.id)
      .map((recipe) => {
        const base = `${describeItems(recipe.inputs, this.catalog)} → ${describeItems([recipe.output], this.catalog)} · ${formatDuration(recipeDuration(state, this.data, recipe))}`;
        if (job?.recipe === recipe.id) {
          const done = this.now >= job.endsAt;
          return {
            label: `${base} · ${done ? "pronto!" : `falta ${formatDuration(job.endsAt - this.now)}`}`,
            action: done ? "Retirar" : "Produzindo",
            enabled: done,
            run: () => {
              this.collect();
            },
          };
        }
        const locked = recipe.moduleLevel > moduleLevel(state, def.id);
        return {
          label: locked ? `${base} · exige nível ${recipe.moduleLevel}` : base,
          action: "Produzir",
          enabled:
            productionBlockers(this.player, this.data, recipe).length === 0,
          run: () => {
            this.produce(recipe);
          },
        };
      });
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
