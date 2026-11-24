import { Container, Rectangle, Text } from "pixi.js";

import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";

/**
 * Tela inicial com o nome do jogo. Com `onStart`, um clique começa o jogo;
 * com `onSettings`, um botão abre as configurações.
 */
export class TitleScene implements Scene {
  readonly view = new Container({ label: "TitleScene" });
  readonly title: Text;
  readonly subtitle: Text;
  readonly settingsButton: Button | null = null;
  private elapsed = 0;

  constructor(
    readonly onStart?: () => void,
    onSettings?: () => void,
  ) {
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
      text: onStart ? "Clique para começar" : "Em desenvolvimento",
      anchor: 0.5,
      style: {
        fill: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 22,
      },
    });
    this.view.addChild(this.title, this.subtitle);
    if (onStart) {
      this.view.eventMode = "static";
      this.view.cursor = "pointer";
      this.view.on("pointertap", () => onStart());
    }
    if (onSettings) {
      this.settingsButton = new Button("Configurações", onSettings, 160, 32);
      // O clique no botão não começa o jogo
      this.settingsButton.on(
        "pointertap",
        (e?: { stopPropagation?: () => void }) => e?.stopPropagation?.(),
      );
      this.view.addChild(this.settingsButton);
    }
  }

  resize(width: number, height: number): void {
    // Escala o título para caber em telas estreitas (64px cabe em ~800px)
    const scale = Math.min(1, width / 800);
    this.view.hitArea = new Rectangle(0, 0, width, height);
    this.title.scale.set(scale);
    this.subtitle.scale.set(scale);
    this.title.position.set(width / 2, height / 2 - 30 * scale);
    this.subtitle.position.set(width / 2, height / 2 + 40 * scale);
    this.settingsButton?.position.set(width / 2 - 80, height - 64);
  }

  /** Faz o subtítulo pulsar suavemente */
  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    this.subtitle.alpha = 0.6 + 0.4 * Math.sin(this.elapsed / 500);
  }
}
