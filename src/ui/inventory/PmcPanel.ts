import { Container, Graphics, Text } from "pixi.js";

import {
  BODY_PARTS,
  MAX_ENERGY,
  MAX_HEALTH,
  MAX_HYDRATION,
  levelForXp,
  levelProgress,
  totalHealth,
  totalMaxHealth,
} from "../../core/pmc/pmc.ts";
import type { BodyPart, PmcState } from "../../core/pmc/pmc.ts";
import { theme } from "../theme.ts";

export const PANEL_WIDTH = 180;
const LINE = 14;
const BODY_TOP = 30;
const BODY_HEIGHT = 152;
const TEXT_X = 80;
const STATS_TOP = BODY_TOP + BODY_HEIGHT + 6;
const STAT_ROW = 18;

export const PART_OK = 0x6abf4b;
export const PART_HURT = 0xd9a441;
export const PART_CRITICAL = 0xd9534f;
export const PART_DESTROYED = 0x2a2c30;
export const ENERGY_COLOR = 0xd9a441;
export const HYDRATION_COLOR = 0x4a90d9;

/** Nomes curtos das partes, para caber no painel */
export const SHORT_PART_LABELS: Record<BodyPart, string> = {
  head: "Cabeça",
  thorax: "Tórax",
  stomach: "Estômago",
  leftArm: "Braço esq.",
  rightArm: "Braço dir.",
  leftLeg: "Perna esq.",
  rightLeg: "Perna dir.",
};

/** Retângulo de cada parte na silhueta (x, y, largura, altura) */
const SILHOUETTE: Record<BodyPart, readonly [number, number, number, number]> =
  {
    head: [26, 0, 20, 22],
    thorax: [18, 26, 36, 34],
    stomach: [20, 62, 32, 26],
    leftArm: [2, 26, 14, 58],
    rightArm: [56, 26, 14, 58],
    leftLeg: [20, 90, 15, 62],
    rightLeg: [37, 90, 15, 62],
  };

/** Cor da parte pela fração da vida: verde, amarelo, vermelho ou destruída */
export function partColor(hp: number, max: number): number {
  if (hp <= 0) return PART_DESTROYED;
  const f = hp / max;
  if (f > 0.6) return PART_OK;
  if (f > 0.35) return PART_HURT;
  return PART_CRITICAL;
}

const text = (fill: number, size = 11, bold = false) =>
  new Text({
    text: "",
    style: {
      fill,
      fontFamily: theme.fontFamily,
      fontSize: size,
      fontWeight: bold ? "bold" : "normal",
    },
  });

/**
 * Painel do PMC no inventário, no estilo de HUD: nível com barra de XP,
 * silhueta com a vida de cada parte (cor pela gravidade, destruída marcada),
 * a vida de cada parte em texto, vida total, energia e hidratação.
 */
export class PmcPanel extends Container {
  readonly levelText = text(theme.accent, 13, true);
  readonly xpText = text(theme.textMuted);
  readonly xpBar = new Graphics();
  readonly parts = new Map<BodyPart, Graphics>();
  /** Cor atual de cada parte (para os testes e a leitura) */
  readonly partColors = new Map<BodyPart, number>();
  readonly partTexts = new Map<BodyPart, Text>();
  readonly totalText = text(theme.text);
  readonly energyText = text(theme.text);
  readonly hydrationText = text(theme.text);
  readonly bars = new Graphics();

  constructor() {
    super({ label: "pmcPanel" });
    this.xpText.anchor.set(1, 0);
    this.xpText.position.set(PANEL_WIDTH, 2);
    this.xpBar.position.set(0, 20);
    this.addChild(this.levelText, this.xpText, this.xpBar, this.bars);
    BODY_PARTS.forEach((part, i) => {
      const shape = new Graphics();
      shape.position.set(0, BODY_TOP);
      this.parts.set(part, shape);
      const label = text(theme.textMuted);
      label.position.set(TEXT_X, BODY_TOP + 8 + i * (LINE + 6));
      this.partTexts.set(part, label);
      this.addChild(shape, label);
    });
    [this.totalText, this.energyText, this.hydrationText].forEach((t, i) => {
      t.position.set(0, STATS_TOP + i * STAT_ROW);
      this.addChild(t);
    });
  }

  /** Atualiza tudo a partir do PMC */
  refresh(pmc: PmcState): void {
    const level = levelForXp(pmc.xp);
    const progress = levelProgress(pmc.xp);
    const xpFraction =
      progress.needed > 0 ? progress.current / progress.needed : 1;
    this.levelText.text = `Nível ${level}`;
    this.xpText.text =
      progress.needed > 0
        ? `${progress.current}/${progress.needed} XP`
        : "máximo";
    this.xpBar
      .clear()
      .rect(0, 0, PANEL_WIDTH, 4)
      .fill({ color: 0x0d0f12 })
      .rect(0, 0, PANEL_WIDTH * xpFraction, 4)
      .fill({ color: theme.accent });

    for (const part of BODY_PARTS) {
      const hp = pmc.health[part];
      const max = MAX_HEALTH[part];
      const color = partColor(hp, max);
      const [x, y, w, h] = SILHOUETTE[part];
      const shape = this.parts.get(part)!.clear().roundRect(x, y, w, h, 4);
      if (hp <= 0) {
        // destruída: escura, com contorno vermelho e um X
        shape
          .fill({ color })
          .stroke({ width: 1, color: PART_CRITICAL })
          .moveTo(x + 2, y + 2)
          .lineTo(x + w - 2, y + h - 2)
          .moveTo(x + w - 2, y + 2)
          .lineTo(x + 2, y + h - 2)
          .stroke({ width: 1, color: PART_CRITICAL });
      } else {
        shape.fill({ color, alpha: 0.85 });
      }
      this.partColors.set(part, color);
      const label = this.partTexts.get(part)!;
      label.text = `${SHORT_PART_LABELS[part]} ${hp <= 0 ? "×" : `${Math.round(hp)}/${max}`}`;
      label.style.fill = hp <= 0 ? PART_CRITICAL : theme.textMuted;
    }

    const total = totalHealth(pmc);
    this.totalText.text = `Vida ${Math.round(total)}/${totalMaxHealth()}`;
    this.energyText.text = `Energia ${Math.round(pmc.energy)}/${MAX_ENERGY}`;
    this.hydrationText.text = `Hidratação ${Math.round(pmc.hydration)}/${MAX_HYDRATION}`;
    const bar = (row: number, fraction: number, color: number) => {
      const y = STATS_TOP + row * STAT_ROW + 14;
      this.bars
        .rect(0, y, PANEL_WIDTH, 3)
        .fill({ color: 0x0d0f12 })
        .rect(0, y, PANEL_WIDTH * Math.min(1, Math.max(0, fraction)), 3)
        .fill({ color });
    };
    this.bars.clear();
    bar(0, total / totalMaxHealth(), partColor(total, totalMaxHealth()));
    bar(1, pmc.energy / MAX_ENERGY, ENERGY_COLOR);
    bar(2, pmc.hydration / MAX_HYDRATION, HYDRATION_COLOR);
  }
}
