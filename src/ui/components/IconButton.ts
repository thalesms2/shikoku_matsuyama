import { Graphics, Text } from "pixi.js";

import { theme } from "../theme.ts";
import { Button } from "./Button.ts";

/** Azul dos botões de ícone */
export const ICON_BLUE = 0x2f6fd6;

/** Desenha o ícone dentro de um quadrado `size × size` */
export type IconDrawer = (g: Graphics, size: number) => void;

/** Ícone de "organizar": barras de tamanhos decrescentes */
export const sortIcon: IconDrawer = (g, size) => {
  const pad = size * 0.25;
  const bar = size * 0.1;
  const gap = (size - pad * 2 - bar * 3) / 2;
  [1, 0.7, 0.4].forEach((width, i) => {
    g.rect(pad, pad + i * (bar + gap), (size - pad * 2) * width, bar);
  });
  g.fill({ color: 0xffffff });
};

/**
 * Botão quadrado azul com um ícone. O texto de `hint` aparece embaixo do
 * botão com o ponteiro em cima.
 */
export class IconButton extends Button {
  readonly icon = new Graphics();
  readonly hint: Text;

  constructor(draw: IconDrawer, hint: string, onPress: () => void, size = 28) {
    super("", onPress, size, size);
    this.label = `icon:${hint}`;
    this.background
      .clear()
      .roundRect(0, 0, size, size, 4)
      .fill({ color: ICON_BLUE })
      .stroke({ width: 1, color: 0x9cc0ff, alpha: 0.8 });
    draw(this.icon, size);
    this.hint = new Text({
      text: hint,
      anchor: { x: 0.5, y: 0 },
      position: { x: size / 2, y: size + 4 },
      style: { fill: theme.text, fontFamily: theme.fontFamily, fontSize: 11 },
      visible: false,
    });
    this.addChild(this.icon, this.hint);
    this.on("pointerover", () => {
      this.hint.visible = true;
    });
    this.on("pointerout", () => {
      this.hint.visible = false;
    });
  }
}
