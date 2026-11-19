import { Container, Text } from "pixi.js";

import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";

/** Tela inicial com o nome do jogo */
export class TitleScene implements Scene {
  readonly view = new Container({ label: "TitleScene" });
  readonly title: Text;
  readonly subtitle: Text;
  private elapsed = 0;

  constructor() {
    this.title = new Text({
      text: "ESCAPE FROM IDLE",
      anchor: 0.5,
      style: {
        fill: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: 64,
        fontWeight: "bold",
        letterSpacing: 6,
      },
    });
    this.subtitle = new Text({
      text: "Em desenvolvimento",
      anchor: 0.5,
      style: {
        fill: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 22,
      },
    });
    this.view.addChild(this.title, this.subtitle);
  }

  resize(width: number, height: number): void {
    // Escala o título para caber em telas estreitas (64px cabe em ~800px)
    const scale = Math.min(1, width / 800);
    this.title.scale.set(scale);
    this.subtitle.scale.set(scale);
    this.title.position.set(width / 2, height / 2 - 30 * scale);
    this.subtitle.position.set(width / 2, height / 2 + 40 * scale);
  }

  /** Faz o subtítulo pulsar suavemente */
  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    this.subtitle.alpha = 0.6 + 0.4 * Math.sin(this.elapsed / 500);
  }
}
