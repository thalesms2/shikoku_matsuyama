import { Container, Text } from "pixi.js";

import { RAID_SPEEDS, TOOLTIP_DELAYS, VOLUMES } from "../../core/settings.ts";
import type { Settings } from "../../core/settings.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";
import { cycle } from "./AutoRaidScene.ts";

const WIDTH = 420;
const HEIGHT = 330;

/** Texto de cada configuração */
export function settingLabels(settings: Settings) {
  return {
    volume: `Volume dos efeitos: ${Math.round(settings.volume * 100)}%`,
    tooltip: `Atraso do tooltip: ${settings.tooltipDelayMs} ms`,
    speed: `Velocidade da raid: x${settings.raidSpeed}`,
    animations: `Animações: ${settings.animations ? "ligadas" : "desligadas"}`,
  };
}

/**
 * Configurações do aparelho: volume, atraso do tooltip, velocidade inicial
 * da raid, animações e rever o tutorial. Cada mudança chama `onChange`.
 */
export class SettingsScene implements Scene {
  readonly view = new Container({ label: "SettingsScene" });
  readonly content = new Container({ label: "content" });
  readonly buttons: Record<
    "volume" | "tooltip" | "speed" | "animations",
    Button
  >;
  readonly tutorialButton: Button;
  readonly backButton: Button;
  readonly messageText: Text;

  constructor(
    readonly settings: Settings,
    readonly options: {
      onChange: (settings: Settings) => void;
      onBack: () => void;
    },
  ) {
    const title = new Text({
      text: "Configurações",
      style: {
        fill: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: 24,
        fontWeight: "bold",
      },
    });
    const make = (i: number, change: () => void) => {
      const button = new Button(
        "",
        () => {
          change();
          this.changed();
        },
        WIDTH,
        32,
      );
      button.position.set(0, 50 + i * 42);
      return button;
    };
    this.buttons = {
      volume: make(0, () => {
        settings.volume = cycle(VOLUMES, settings.volume as never);
      }),
      tooltip: make(1, () => {
        settings.tooltipDelayMs = cycle(
          TOOLTIP_DELAYS,
          settings.tooltipDelayMs as never,
        );
      }),
      speed: make(2, () => {
        settings.raidSpeed = cycle(RAID_SPEEDS, settings.raidSpeed as never);
      }),
      animations: make(3, () => {
        settings.animations = !settings.animations;
      }),
    };
    this.tutorialButton = make(4, () => {
      settings.tutorialStep = 0;
      this.messageText.text = "O tutorial aparece de novo no inventário";
    });
    this.tutorialButton.text.text = "Rever o tutorial";
    this.backButton = new Button("Voltar", options.onBack, 120, 32);
    this.backButton.position.set(WIDTH - 120, HEIGHT - 32);
    this.messageText = new Text({
      text: "",
      position: { x: 0, y: 50 + 5 * 42 + 4 },
      style: {
        fill: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 13,
      },
    });
    this.content.addChild(
      title,
      ...Object.values(this.buttons),
      this.tutorialButton,
      this.messageText,
      this.backButton,
    );
    this.view.addChild(this.content);
    this.refresh();
  }

  private changed(): void {
    this.options.onChange(this.settings);
    this.refresh();
  }

  refresh(): void {
    const labels = settingLabels(this.settings);
    for (const [key, button] of Object.entries(this.buttons)) {
      button.text.text = labels[key as keyof typeof labels];
    }
  }

  resize(width: number, height: number): void {
    const scale = Math.min(1.5, width / (WIDTH + 64), height / (HEIGHT + 64));
    this.content.scale.set(scale);
    this.content.position.set(
      (width - WIDTH * scale) / 2,
      (height - HEIGHT * scale) / 2,
    );
  }
}
