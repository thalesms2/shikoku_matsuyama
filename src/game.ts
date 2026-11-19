// Registra o loader de arquivos de som
import "@pixi/sound";
import { Application, Assets } from "pixi.js";

import { assets } from "./assets.ts";
import { gameReady, initPlatform, setLoadingProgress } from "./platform.ts";
import { SceneManager } from "./ui/SceneManager.ts";
import { TitleScene } from "./ui/scenes/TitleScene.ts";
import { theme } from "./ui/theme.ts";

/** Inicia a aplicação PixiJS dentro de `container` e mostra a tela inicial */
export async function startGame(container: HTMLElement) {
  await initPlatform();

  const app = new Application();

  await app.init({
    background: theme.background,
    resizeTo: window,
    // Limitado a 2: em telas 3x a diferença é mínima e gasta menos memória
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
    antialias: true,
  });

  container.appendChild(app.canvas);

  await Assets.load(assets, setLoadingProgress);

  const scenes = new SceneManager(
    app.stage,
    app.screen.width,
    app.screen.height,
  );

  app.renderer.on("resize", (width: number, height: number) =>
    scenes.resize(width, height),
  );
  app.ticker.add((ticker) => scenes.update(ticker.deltaMS));

  scenes.change(new TitleScene());

  gameReady(app);

  return { app, scenes };
}
