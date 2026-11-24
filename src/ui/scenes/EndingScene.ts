import { Container, Text } from "pixi.js";

import { levelForXp } from "../../core/pmc/pmc.ts";
import type { PlayerState } from "../../core/state.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";

const WIDTH = 640;
const HEIGHT = 360;

/** Texto final com as estatísticas do jogador */
export function endingText(player: PlayerState): string {
  const { stats } = player.raid;
  return [
    "O barco do contrabandista se afasta do cais. Atrás de você, a cidade",
    "some na fumaça. Você saiu.",
    "",
    `PMC nível ${levelForXp(player.pmc.xp)}`,
    `Raids: ${stats.raids} · Extrações: ${stats.extracted} · Mortes: ${stats.killed} · MIA: ${stats.mia}`,
    `Abates: ${stats.kills.scav} Scav, ${stats.kills.pmc} PMC · Raids Scav: ${player.scav.stats.raids}`,
  ].join("\n");
}

/** Final do jogo, mostrado ao concluir a quest final */
export class EndingScene implements Scene {
  readonly view = new Container({ label: "EndingScene" });
  readonly content = new Container({ label: "content" });
  readonly continueButton: Button;

  constructor(player: PlayerState, onContinue: () => void) {
    const title = new Text({
      text: "VOCÊ ESCAPOU",
      style: {
        fill: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: 36,
        fontWeight: "bold",
      },
    });
    const text = new Text({
      text: endingText(player),
      position: { x: 0, y: 70 },
      style: {
        fill: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: 15,
        lineHeight: 24,
      },
    });
    this.continueButton = new Button("Continuar jogando", onContinue, 200, 36);
    this.continueButton.position.set(WIDTH - 200, HEIGHT - 36);
    this.content.addChild(title, text, this.continueButton);
    this.view.addChild(this.content);
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
