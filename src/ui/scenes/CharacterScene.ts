import { Container, Graphics, Text } from "pixi.js";

import {
  BODY_PARTS,
  BODY_PART_LABELS,
  MAX_ENERGY,
  MAX_HEALTH,
  MAX_HYDRATION,
  levelForXp,
  levelProgress,
  totalHealth,
  totalMaxHealth,
} from "../../core/pmc/pmc.ts";
import {
  SKILLS,
  SKILL_INFO,
  skillBonus,
  skillLevel,
  skillProgress,
} from "../../core/pmc/skills.ts";
import type { PlayerState } from "../../core/state.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";

const BAR_WIDTH = 220;
const SKILL_BAR_WIDTH = 320;
const BAR_HEIGHT = 10;
const ROW = 30;
const COLUMN = 420;

export const HEALTH_COLOR = 0x6abf4b;
export const HEALTH_LOW_COLOR = 0xd9534f;
export const ENERGY_COLOR = 0xd9a441;
export const HYDRATION_COLOR = 0x4a90d9;
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

const round = (n: number) => Math.round(n);

/** Tela do personagem: nível, vida por parte do corpo, energia, hidratação e skills */
export class CharacterScene implements Scene {
  readonly view = new Container({ label: "CharacterScene" });
  readonly content = new Container({ label: "content" });
  readonly title: Text;
  readonly levelBar = new StatBar("Nível");
  readonly totalBar = new StatBar("Vida total");
  readonly partBars = new Map<string, StatBar>();
  readonly energyBar = new StatBar("Energia");
  readonly hydrationBar = new StatBar("Hidratação");
  readonly skillBars = new Map<string, StatBar>();
  readonly backButton: Button;
  private contentHeight = 0;

  constructor(
    readonly player: PlayerState,
    onBack: () => void,
  ) {
    this.title = new Text({
      text: player.pmc.name,
      style: {
        fill: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: 24,
        fontWeight: "bold",
      },
    });
    this.backButton = new Button("Voltar ao inventário", onBack, 180);
    this.backButton.position.set(COLUMN * 2 - 180, 2);
    this.content.addChild(this.title, this.backButton);

    let y = 50;
    const place = (bar: StatBar, x: number) => {
      bar.position.set(x, y);
      this.content.addChild(bar);
      y += ROW;
    };
    place(this.levelBar, 0);
    place(this.totalBar, 0);
    y += 10;
    for (const part of BODY_PARTS) {
      const bar = new StatBar(BODY_PART_LABELS[part]);
      this.partBars.set(part, bar);
      place(bar, 0);
    }
    y += 10;
    place(this.energyBar, 0);
    place(this.hydrationBar, 0);
    const leftHeight = y;

    y = 50;
    const heading = new Text({
      text: "Skills",
      position: { x: COLUMN, y },
      style: { fill: theme.accent, fontFamily: theme.fontFamily, fontSize: 16 },
    });
    this.content.addChild(heading);
    y += ROW;
    for (const id of SKILLS) {
      const bar = new StatBar(SKILL_INFO[id].name, SKILL_BAR_WIDTH);
      this.skillBars.set(id, bar);
      place(bar, COLUMN);
    }
    this.contentHeight = Math.max(leftHeight, y);

    this.view.addChild(this.content);
    this.refresh();
  }

  /** Atualiza todas as barras a partir do estado do jogador */
  refresh(): void {
    const { pmc, skills } = this.player;
    const level = levelForXp(pmc.xp);
    const progress = levelProgress(pmc.xp);
    this.levelBar.set(
      progress.needed > 0
        ? `${level} · ${progress.current}/${progress.needed} XP`
        : `${level} (máximo)`,
      progress.needed > 0 ? progress.current / progress.needed : 1,
      XP_COLOR,
    );
    const total = totalHealth(pmc);
    this.totalBar.set(
      `${round(total)}/${totalMaxHealth()}`,
      total / totalMaxHealth(),
      HEALTH_COLOR,
    );
    for (const part of BODY_PARTS) {
      const hp = pmc.health[part];
      const max = MAX_HEALTH[part];
      this.partBars
        .get(part)!
        .set(
          hp <= 0 ? "destruída" : `${round(hp)}/${max}`,
          hp / max,
          hp / max < 0.35 ? HEALTH_LOW_COLOR : HEALTH_COLOR,
        );
    }
    this.energyBar.set(
      `${round(pmc.energy)}/${MAX_ENERGY}`,
      pmc.energy / MAX_ENERGY,
      ENERGY_COLOR,
    );
    this.hydrationBar.set(
      `${round(pmc.hydration)}/${MAX_HYDRATION}`,
      pmc.hydration / MAX_HYDRATION,
      HYDRATION_COLOR,
    );
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
    const w = COLUMN * 2;
    const h = this.contentHeight;
    const scale = Math.min(1.5, width / (w + 64), height / (h + 64));
    this.content.scale.set(scale);
    this.content.position.set(
      (width - w * scale) / 2,
      (height - h * scale) / 2,
    );
  }
}
