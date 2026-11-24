import { Container, Graphics, Text } from "pixi.js";

import { theme } from "../theme.ts";

/** Cor do fundo com o ponteiro em cima */
export const HOVER_TINT = 0xb8c4d6;

/** Botão retangular simples com texto centralizado */
export class Button extends Container {
  /** Chamado em todo clique de botão (ex.: som), antes da ação */
  static feedback: (() => void) | null = null;

  readonly background = new Graphics();
  readonly text: Text;

  constructor(
    label: string,
    readonly onPress: () => void,
    readonly buttonWidth = 120,
    readonly buttonHeight = 28,
  ) {
    super({ label: `button:${label}`, eventMode: "static", cursor: "pointer" });
    this.background
      .roundRect(0, 0, buttonWidth, buttonHeight, 4)
      .fill({ color: 0x23262b })
      .stroke({ width: 1, color: theme.accent, alpha: 0.8 });
    this.text = new Text({
      text: label,
      anchor: 0.5,
      position: { x: buttonWidth / 2, y: buttonHeight / 2 },
      style: { fill: theme.text, fontFamily: theme.fontFamily, fontSize: 13 },
    });
    this.addChild(this.background, this.text);
    this.on("pointertap", () => {
      Button.feedback?.();
      this.onPress();
    });
    // Destaque com o ponteiro em cima (o alpha fica para "desativado")
    this.on("pointerover", () => {
      this.background.tint = HOVER_TINT;
    });
    this.on("pointerout", () => {
      this.background.tint = 0xffffff;
    });
  }
}
