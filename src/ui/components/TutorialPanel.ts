import { Container, Graphics, Text } from "pixi.js";

import type { TutorialStep } from "../../data/tutorial.ts";
import { theme } from "../theme.ts";
import { Button } from "./Button.ts";

export const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 190;
const MARGIN = 16;

/**
 * Painel do tutorial, no canto de baixo à direita da tela. "Próximo" avança
 * (no último passo, "Concluir"); "Pular" termina. `onStep` recebe o próximo
 * passo (igual ao número de passos = concluído).
 */
export class TutorialPanel extends Container {
  readonly background = new Graphics();
  readonly titleText: Text;
  readonly bodyText: Text;
  readonly stepText: Text;
  readonly nextButton: Button;
  readonly skipButton: Button;

  constructor(
    readonly steps: readonly TutorialStep[],
    public step: number,
    readonly onStep: (step: number) => void,
  ) {
    super({ label: "tutorial", eventMode: "static" });
    this.background
      .roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 6)
      .fill({ color: 0x1b1e22, alpha: 0.96 })
      .stroke({ width: 1, color: theme.accent });
    const style = {
      fill: theme.text,
      fontFamily: theme.fontFamily,
      fontSize: 13,
    };
    this.titleText = new Text({
      text: "",
      position: { x: 14, y: 12 },
      style: { ...style, fill: theme.accent, fontSize: 16, fontWeight: "bold" },
    });
    this.stepText = new Text({
      text: "",
      anchor: { x: 1, y: 0 },
      position: { x: PANEL_WIDTH - 14, y: 14 },
      style: { ...style, fill: theme.textMuted },
    });
    this.bodyText = new Text({
      text: "",
      position: { x: 14, y: 40 },
      style: {
        ...style,
        lineHeight: 18,
        wordWrap: true,
        wordWrapWidth: PANEL_WIDTH - 28,
      },
    });
    this.nextButton = new Button("Próximo", () => this.go(this.step + 1), 110);
    this.nextButton.position.set(PANEL_WIDTH - 124, PANEL_HEIGHT - 40);
    this.skipButton = new Button("Pular", () => this.go(steps.length), 90);
    this.skipButton.position.set(14, PANEL_HEIGHT - 40);
    this.addChild(
      this.background,
      this.titleText,
      this.stepText,
      this.bodyText,
      this.nextButton,
      this.skipButton,
    );
    this.refresh();
  }

  get done(): boolean {
    return this.step >= this.steps.length;
  }

  private go(step: number): void {
    this.step = Math.min(step, this.steps.length);
    this.onStep(this.step);
    this.refresh();
  }

  refresh(): void {
    this.visible = !this.done;
    if (this.done) return;
    const current = this.steps[this.step];
    this.titleText.text = current.title;
    this.bodyText.text = current.text;
    this.stepText.text = `${this.step + 1}/${this.steps.length}`;
    const last = this.step === this.steps.length - 1;
    this.nextButton.text.text = last ? "Concluir" : "Próximo";
  }

  /** Canto de baixo à direita da tela */
  layout(width: number, height: number): void {
    this.position.set(
      Math.max(MARGIN, width - PANEL_WIDTH - MARGIN),
      Math.max(MARGIN, height - PANEL_HEIGHT - MARGIN),
    );
  }
}
