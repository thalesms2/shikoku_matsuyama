import { Container, Text } from "pixi.js";

import type { Clock } from "../../core/clock.ts";
import { effect } from "../../core/hideout/hideout.ts";
import type { HideoutData } from "../../core/hideout/types.ts";
import type { Catalog } from "../../core/inventory/item.ts";
import { raidWarnings, startRaid } from "../../core/raid/profile.ts";
import {
  scavModifiers,
  scavReadyIn,
  startScavRaid,
} from "../../core/raid/scav.ts";
import { STRATEGIES } from "../../core/raid/strategy.ts";
import { STRATEGY_IDS } from "../../core/raid/types.ts";
import type {
  EnemyDef,
  EnemyKind,
  ExtractDef,
  MapDef,
  RaidProfile,
  ScavLoadout,
  ScavProfile,
  StrategyId,
} from "../../core/raid/types.ts";
import type { PlayerState } from "../../core/state.ts";
import { HIDEOUT } from "../../data/hideout.ts";
import { SCAV_LOADOUT } from "../../data/scav.ts";
import { Button } from "../components/Button.ts";
import { formatPrice } from "../inventory/layout.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";

const COLUMN = 440;
const WIDTH = 880;
const BUTTON_WIDTH = 220;
export const WARNING_COLOR = 0xd9534f;
export const READY_COLOR = 0x6abf4b;

const style = (extra: object = {}) => ({
  fill: theme.text,
  fontFamily: theme.fontFamily,
  fontSize: 13,
  ...extra,
});

/** Texto da extração com o requisito, se houver */
export function describeExtract(extract: ExtractDef, catalog: Catalog): string {
  const req = extract.requirement;
  if (!req) return extract.name;
  if (req.kind === "noBackpack") return `${extract.name} (sem mochila)`;
  if (req.kind === "key") {
    return `${extract.name} (chave: ${catalog.get(req.item).name})`;
  }
  return `${extract.name} (pagar ${formatPrice(req.amount)})`;
}

/** Ficha do mapa: descrição, dificuldade, duração e extrações */
export function describeMap(map: MapDef, catalog: Catalog): string {
  return [
    map.description,
    "",
    `Dificuldade: ${map.difficulty}/5`,
    `Duração: ${map.duration} min`,
    `Extrações: ${map.extracts.map((e) => describeExtract(e, catalog)).join("; ")}`,
  ].join("\n");
}

/** Resumo das raids do jogador */
export function describeStats(profile: RaidProfile): string {
  const { stats, karma } = profile;
  const sign = karma > 0 ? "+" : "";
  return [
    `Raids: ${stats.raids} · Extrações: ${stats.extracted} · Mortes: ${stats.killed} · MIA: ${stats.mia}`,
    `Abates: ${stats.kills.scav} Scav, ${stats.kills.pmc} PMC · Karma: ${sign}${karma.toFixed(2)}`,
  ].join("\n");
}

/** Tempo de espera como `mm:ss` (arredonda o segundo para cima) */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Situação da raid Scav: espera, efeito do karma e estatísticas */
export function describeScav(
  scav: ScavProfile,
  karma: number,
  now: number,
): string {
  const wait = scavReadyIn(scav, now);
  const mods = scavModifiers(karma);
  const { stats } = scav;
  const sign = karma > 0 ? "+" : "";
  return [
    `Raid Scav (equipamento aleatório, o PMC não arrisca nada): ${wait > 0 ? `em espera, ${formatCountdown(wait)}` : "liberada"}`,
    `Karma ${sign}${karma.toFixed(2)}: Scavs amigáveis ${Math.round(mods.friendlyScav * 100)}% · tocaia ×${mods.extractRisk.toFixed(2)} · loot ×${mods.lootWeight.toFixed(2)}`,
    `Raids Scav: ${stats.raids} · Extrações: ${stats.extracted} · Mortes: ${stats.killed} · MIA: ${stats.mia}`,
  ].join("\n");
}

export const LOOT_RULE_LABELS = {
  valuePerCell: "Loot: priorizar valor por célula",
  keepFirst: "Loot: guardar o que achar primeiro",
} as const;

/** Tela de preparação: escolhe mapa, estratégia e regra de loot e entra na raid */
export class RaidSetupScene implements Scene {
  readonly view = new Container({ label: "RaidSetupScene" });
  readonly content = new Container({ label: "content" });
  readonly title: Text;
  readonly backButton: Button;
  loadoutsButton: Button | null = null;
  autoButton: Button | null = null;
  readonly mapButtons = new Map<string, Button>();
  readonly strategyButtons = new Map<StrategyId, Button>();
  readonly mapInfo: Text;
  readonly strategyInfo: Text;
  readonly lootRuleButton: Button;
  readonly warningsText: Text;
  readonly statsText: Text;
  readonly startButton: Button;
  readonly scavText: Text;
  readonly scavButton: Button;
  map: MapDef;
  strategy: StrategyId = "balanced";
  private readonly contentHeight: number;

  constructor(
    readonly player: PlayerState,
    readonly options: {
      maps: readonly MapDef[];
      enemies: Readonly<Record<EnemyKind, EnemyDef>>;
      clock: Clock;
      /** Tabelas do Scav (padrão: `SCAV_LOADOUT`) */
      scavLoadout?: ScavLoadout;
      /** Módulos do esconderijo, para o corte do cooldown (padrão: `HIDEOUT`) */
      hideout?: HideoutData;
      /** Chamado depois que a raid foi resolvida (com `player.raid.active`) */
      onStart: () => void;
      onBack: () => void;
      /** Abre os loadouts (botão ao lado de Voltar) */
      onOpenLoadouts?: () => void;
      /** Abre as raids automáticas (à esquerda de Loadouts) */
      onOpenAuto?: () => void;
    },
  ) {
    this.map = options.maps[0];
    this.title = new Text({
      text: "Preparar raid",
      style: style({ fill: theme.accent, fontSize: 24, fontWeight: "bold" }),
    });
    this.backButton = new Button("Voltar ao inventário", options.onBack, 180);
    this.backButton.position.set(WIDTH - 180, 2);
    this.content.addChild(this.title, this.backButton);
    if (options.onOpenLoadouts) {
      this.loadoutsButton = new Button("Loadouts", options.onOpenLoadouts);
      this.loadoutsButton.position.set(
        this.backButton.x - this.loadoutsButton.buttonWidth - 12,
        2,
      );
      this.content.addChild(this.loadoutsButton);
    }
    if (options.onOpenAuto) {
      this.autoButton = new Button("Automático", options.onOpenAuto);
      const right = this.loadoutsButton ?? this.backButton;
      this.autoButton.position.set(
        right.x - this.autoButton.buttonWidth - 12,
        2,
      );
      this.content.addChild(this.autoButton);
    }

    let y = 50;
    this.content.addChild(this.heading("Mapa", 0, y));
    this.content.addChild(this.heading("Estratégia", COLUMN, y));
    y += 26;
    let mapY = y;
    for (const map of options.maps) {
      const button = new Button(
        map.name,
        () => this.selectMap(map),
        BUTTON_WIDTH,
      );
      button.position.set(0, mapY);
      this.mapButtons.set(map.id, button);
      this.content.addChild(button);
      mapY += 36;
    }
    let strategyY = y;
    for (const id of STRATEGY_IDS) {
      const button = new Button(
        STRATEGIES[id].name,
        () => this.selectStrategy(id),
        BUTTON_WIDTH,
      );
      button.position.set(COLUMN, strategyY);
      this.strategyButtons.set(id, button);
      this.content.addChild(button);
      strategyY += 36;
    }

    this.mapInfo = new Text({
      text: "",
      position: { x: 0, y: mapY + 8 },
      style: style({
        wordWrap: true,
        wordWrapWidth: COLUMN - 40,
        lineHeight: 19,
      }),
    });
    this.strategyInfo = new Text({
      text: "",
      position: { x: COLUMN, y: strategyY + 8 },
      style: style({ wordWrap: true, wordWrapWidth: COLUMN - 40 }),
    });
    this.lootRuleButton = new Button(
      "",
      () => this.toggleLootRule(),
      BUTTON_WIDTH + 60,
    );
    this.lootRuleButton.position.set(COLUMN, strategyY + 60);
    this.warningsText = new Text({
      text: "",
      position: { x: COLUMN, y: strategyY + 110 },
      style: style({ lineHeight: 19 }),
    });
    this.statsText = new Text({
      text: "",
      position: { x: 0, y: mapY + 200 },
      style: style({ fill: theme.textMuted, lineHeight: 19 }),
    });
    this.startButton = new Button(
      "Entrar na raid",
      () => this.start(),
      180,
      36,
    );
    this.startButton.position.set(WIDTH - 180, mapY + 200);
    this.scavText = new Text({
      text: "",
      position: { x: 0, y: mapY + 262 },
      style: style({ lineHeight: 19 }),
    });
    this.scavButton = new Button(
      "Entrar como Scav",
      () => this.startScav(),
      180,
      36,
    );
    this.scavButton.position.set(WIDTH - 180, mapY + 270);
    this.content.addChild(this.scavText, this.scavButton);
    this.content.addChild(
      this.mapInfo,
      this.strategyInfo,
      this.lootRuleButton,
      this.warningsText,
      this.statsText,
      this.startButton,
    );
    this.contentHeight = mapY + 330;
    this.view.addChild(this.content);
    this.refresh();
  }

  private heading(text: string, x: number, y: number): Text {
    return new Text({
      text,
      position: { x, y },
      style: style({ fill: theme.accent, fontSize: 16 }),
    });
  }

  selectMap(map: MapDef): void {
    this.map = map;
    this.refresh();
  }

  selectStrategy(id: StrategyId): void {
    this.strategy = id;
    this.refresh();
  }

  toggleLootRule(): void {
    const raid = this.player.raid;
    raid.lootRule =
      raid.lootRule === "valuePerCell" ? "keepFirst" : "valuePerCell";
    this.refresh();
  }

  /** Resolve a raid com as escolhas atuais e avisa o jogo */
  start(): void {
    startRaid(
      this.player,
      this.map,
      this.strategy,
      this.options.enemies,
      this.options.clock,
    );
    this.options.onStart();
  }

  get scavReady(): boolean {
    return scavReadyIn(this.player.scav, this.options.clock.now()) === 0;
  }

  /** Raid Scav com o mapa e a estratégia escolhidos (só se estiver liberada) */
  startScav(): void {
    if (!this.scavReady) return;
    startScavRaid(
      this.player,
      this.map,
      this.strategy,
      this.options.enemies,
      this.options.scavLoadout ?? SCAV_LOADOUT,
      this.options.clock,
      effect(
        this.player.hideout,
        this.options.hideout ?? HIDEOUT,
        "scavCooldown",
      ),
    );
    this.options.onStart();
  }

  /** Atualiza a contagem do cooldown */
  update(): void {
    this.refreshScav();
  }

  refreshScav(): void {
    const text = describeScav(
      this.player.scav,
      this.player.raid.karma,
      this.options.clock.now(),
    );
    if (this.scavText.text !== text) this.scavText.text = text;
    this.scavButton.alpha = this.scavReady ? 1 : 0.55;
  }

  refresh(): void {
    const { catalog } = this.player.factory;
    for (const [id, button] of this.mapButtons) {
      button.alpha = id === this.map.id ? 1 : 0.55;
    }
    for (const [id, button] of this.strategyButtons) {
      button.alpha = id === this.strategy ? 1 : 0.55;
    }
    this.mapInfo.text = describeMap(this.map, catalog);
    this.strategyInfo.text = STRATEGIES[this.strategy].description;
    this.lootRuleButton.text.text = LOOT_RULE_LABELS[this.player.raid.lootRule];
    const warnings = raidWarnings(this.player);
    this.warningsText.text =
      warnings.length > 0
        ? warnings.map((w) => `⚠ ${w}`).join("\n")
        : "Pronto para a raid";
    this.warningsText.style.fill =
      warnings.length > 0 ? WARNING_COLOR : READY_COLOR;
    this.statsText.text = describeStats(this.player.raid);
    this.refreshScav();
  }

  resize(width: number, height: number): void {
    const h = this.contentHeight;
    const scale = Math.min(1.5, width / (WIDTH + 64), height / (h + 64));
    this.content.scale.set(scale);
    this.content.position.set(
      (width - WIDTH * scale) / 2,
      (height - h * scale) / 2,
    );
  }
}
