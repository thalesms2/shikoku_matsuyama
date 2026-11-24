import { Container, Graphics, Text } from "pixi.js";

import {
  SKILLS,
  SKILL_CATEGORY_NAMES,
  SKILL_INFO,
  skillBonus,
  skillLevel,
  skillProgress,
  skillsIn,
} from "../../core/pmc/skills.ts";
import type { SkillCategory } from "../../core/pmc/skills.ts";
import type { PlayerState } from "../../core/state.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";

const BAR_WIDTH = 220;
const SKILL_BAR_WIDTH = 340;
const BAR_HEIGHT = 10;
const ROW = 28;
const HEADING = 26;
const GROUP_GAP = 12;
const COLUMN = 400;
const WIDTH = COLUMN + SKILL_BAR_WIDTH;

/** Categorias de cada coluna da tela */
export const SKILL_COLUMNS: readonly (readonly SkillCategory[])[] = [
  ["physical", "practical"],
  ["combat", "mental"],
];

export const XP_COLOR = theme.accent;

/** Uma linha com rótulo, valor e barra de progresso */
export class StatBar extends Container {
  readonly labelText: Text;
  readonly value: Text;
  readonly bar = new Graphics();

  constructor(
    label: string,
    readonly barWidth = BAR_WIDTH,
  ) {
    super();
    const style = {
      fill: theme.text,
      fontFamily: theme.fontFamily,
      fontSize: 13,
    };
    this.labelText = new Text({ text: label, style });
    this.value = new Text({
      text: "",
      anchor: { x: 1, y: 0 },
      position: { x: barWidth, y: 0 },
      style: { ...style, fill: theme.textMuted },
    });
    this.bar.position.set(0, 17);
    this.addChild(this.labelText, this.value, this.bar);
  }

  /** Atualiza o texto e a barra; `fraction` entre 0 e 1 */
  set(value: string, fraction: number, color: number): void {
    const f = Math.min(1, Math.max(0, fraction));
    this.value.text = value;
    this.bar
      .clear()
      .rect(0, 0, this.barWidth, BAR_HEIGHT)
      .fill({ color: 0x0d0f12 })
      .rect(0, 0, this.barWidth * f, BAR_HEIGHT)
      .fill({ color });
  }
}

/**
 * Tela de Skills: nível, bônus e progresso de cada skill, agrupadas pelas
 * quatro categorias. Vida, nível do PMC,
 * energia e hidratação ficam no painel do inventário (`PmcPanel`).
 */
export class SkillsScene implements Scene {
  readonly view = new Container({ label: "SkillsScene" });
  readonly content = new Container({ label: "content" });
  readonly title: Text;
  readonly skillBars = new Map<string, StatBar>();
  readonly categoryTitles = new Map<SkillCategory, Text>();
  readonly backButton: Button;
  private contentHeight = 0;

  constructor(
    readonly player: PlayerState,
    onBack: () => void,
  ) {
    this.title = new Text({
      text: "Skills",
      style: {
        fill: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: 24,
        fontWeight: "bold",
      },
    });
    this.backButton = new Button("Voltar ao inventário", onBack, 180);
    this.backButton.position.set(WIDTH - 180, 2);
    this.content.addChild(this.title, this.backButton);

    // Duas colunas: Físicas e Práticas à esquerda, Combate e Mentais à direita
    let height = 0;
    SKILL_COLUMNS.forEach((categories, column) => {
      const x = column * COLUMN;
      let y = 50;
      for (const category of categories) {
        const heading = new Text({
          text: SKILL_CATEGORY_NAMES[category],
          position: { x, y },
          style: {
            fill: theme.accent,
            fontFamily: theme.fontFamily,
            fontSize: 16,
            fontWeight: "bold",
          },
        });
        this.categoryTitles.set(category, heading);
        this.content.addChild(heading);
        y += HEADING;
        for (const id of skillsIn(category)) {
          const bar = new StatBar(SKILL_INFO[id].name, SKILL_BAR_WIDTH);
          bar.position.set(x, y);
          this.skillBars.set(id, bar);
          this.content.addChild(bar);
          y += ROW;
        }
        y += GROUP_GAP;
      }
      height = Math.max(height, y);
    });
    this.contentHeight = height;

    this.view.addChild(this.content);
    this.refresh();
  }

  /** Atualiza as barras a partir das skills do jogador */
  refresh(): void {
    const { skills } = this.player;
    for (const id of SKILLS) {
      const xp = skills[id];
      const p = skillProgress(xp);
      const bonus = Math.round(skillBonus(skills, id) * 100);
      this.skillBars
        .get(id)!
        .set(
          `nível ${skillLevel(xp)} · +${bonus}%`,
          p.needed > 0 ? p.current / p.needed : 1,
          XP_COLOR,
        );
    }
  }

  resize(width: number, height: number): void {
    const w = WIDTH;
    const h = this.contentHeight;
    const scale = Math.min(1.5, width / (w + 64), height / (h + 64));
    this.content.scale.set(scale);
    this.content.position.set(
      (width - w * scale) / 2,
      (height - h * scale) / 2,
    );
  }
}
