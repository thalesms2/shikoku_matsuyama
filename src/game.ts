// Registra o loader de arquivos de som
import "@pixi/sound";
import { Application, Assets } from "pixi.js";

import { assets } from "./assets.ts";
import { autoTick } from "./core/auto/auto.ts";
import type { AutoContext } from "./core/auto/types.ts";
import { systemClock } from "./core/clock.ts";
import type { Clock } from "./core/clock.ts";
import { fleaTick } from "./core/flea/flea.ts";
import { hideoutTick } from "./core/hideout/hideout.ts";
import type { Item } from "./core/inventory/item.ts";
import { catchUp, hasNews } from "./core/offline.ts";
import type { OfflineData } from "./core/offline.ts";
import { recordRaidQuests } from "./core/quests/quests.ts";
import type { QuestContext } from "./core/quests/types.ts";
import {
  AutoSaver,
  SAVE_KEY,
  browserStorage,
  saveGame,
} from "./core/save/storage.ts";
import { SETTINGS_KEY, loadSettings, saveSettings } from "./core/settings.ts";
import type { Settings } from "./core/settings.ts";
import { FLEA } from "./data/flea.ts";
import { HIDEOUT } from "./data/hideout.ts";
import { ITEM_DEFS } from "./data/items.ts";
import { ENEMIES, MAPS, mapById } from "./data/maps.ts";
import { loadOrCreatePlayer } from "./data/newGame.ts";
import { QUESTS } from "./data/quests.ts";
import { TRADERS } from "./data/traders.ts";
import { TUTORIAL } from "./data/tutorial.ts";
import { gameReady, initPlatform, setLoadingProgress } from "./platform.ts";
import { playSound, setVolume } from "./ui/audio.ts";
import { Button } from "./ui/components/Button.ts";
import { TutorialPanel } from "./ui/components/TutorialPanel.ts";
import { loadItemTextures } from "./ui/inventory/textures.ts";
import { SceneManager } from "./ui/SceneManager.ts";
import { AutoRaidScene, describeAutoRun } from "./ui/scenes/AutoRaidScene.ts";
import { CharacterScene } from "./ui/scenes/CharacterScene.ts";
import { EndingScene } from "./ui/scenes/EndingScene.ts";
import { FleaScene } from "./ui/scenes/FleaScene.ts";
import { HideoutScene } from "./ui/scenes/HideoutScene.ts";
import { InventoryScene } from "./ui/scenes/InventoryScene.ts";
import { LoadoutScene } from "./ui/scenes/LoadoutScene.ts";
import { OfflineScene } from "./ui/scenes/OfflineScene.ts";
import { QuestsScene } from "./ui/scenes/QuestsScene.ts";
import { RaidScene } from "./ui/scenes/RaidScene.ts";
import { RaidSetupScene } from "./ui/scenes/RaidSetupScene.ts";
import { SettingsScene } from "./ui/scenes/SettingsScene.ts";
import { TitleScene } from "./ui/scenes/TitleScene.ts";
import { TradersScene } from "./ui/scenes/TradersScene.ts";
import { theme } from "./ui/theme.ts";

/** Duração do fade entre telas (com as animações ligadas) */
export const FADE_MS = 200;

/** Intervalo do cálculo do esconderijo e do mercado com o jogo aberto */
export const HIDEOUT_TICK_MS = 1000;

/** Inicia a aplicação PixiJS dentro de `container` e mostra a tela inicial */
export async function startGame(
  container: HTMLElement,
  options: { clock?: Clock; storage?: Storage } = {},
) {
  const clock = options.clock ?? systemClock;
  const storage = browserStorage(SAVE_KEY, options.storage);
  const backup = browserStorage(`${SAVE_KEY}:backup`, options.storage);
  const settingsStorage = browserStorage(SETTINGS_KEY, options.storage);
  const settings = loadSettings(settingsStorage);
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
  // O botão direito abre o menu do jogo, não o do navegador
  app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  await Assets.load(assets, setLoadingProgress);
  await loadItemTextures(ITEM_DEFS);

  const scenes = new SceneManager(
    app.stage,
    app.screen.width,
    app.screen.height,
  );

  /** Aplica e guarda as configurações */
  const applySettings = (next: Settings) => {
    saveSettings(settingsStorage, next);
    setVolume(next.volume);
    scenes.fadeMs = next.animations ? FADE_MS : 0;
  };
  applySettings(settings);
  Button.feedback = () => playSound("sfx-press");

  app.renderer.on("resize", (width: number, height: number) =>
    scenes.resize(width, height),
  );
  app.ticker.add((ticker) => scenes.update(ticker.deltaMS));

  const { player, warnings, error } = loadOrCreatePlayer(
    storage,
    backup,
    clock,
  );
  if (error)
    console.warn(`Save não carregado, começando um jogo novo: ${error}`);
  for (const warning of warnings) console.warn(`Save: ${warning}`);

  // Tempo com o jogo fechado: esconderijo (obras, cura, comida) e vendas
  // dos anúncios do mercado; o resumo aparece depois do título
  const questContext: QuestContext = {
    quests: QUESTS,
    traders: TRADERS,
    maps: MAPS,
  };
  const autoContext: AutoContext = {
    maps: MAPS,
    enemies: ENEMIES,
    quests: questContext,
    hideout: HIDEOUT,
    shop: { traders: TRADERS, flea: FLEA },
  };
  // Raids automáticas primeiro: cada uma vê o esconderijo no seu momento
  const autoRaids = autoTick(player, autoContext, clock.now());
  const offlineData: OfflineData = {
    hideout: HIDEOUT,
    flea: FLEA,
    traders: TRADERS,
  };
  const offline = catchUp(player, offlineData, clock.now());
  let pendingReport = hasNews(offline) || autoRaids.length > 0 ? offline : null;
  const tick = () => {
    autoTick(player, autoContext, clock.now());
    hideoutTick(player, HIDEOUT, clock.now());
    fleaTick(player, FLEA, clock.now());
  };
  let hideoutElapsed = 0;
  app.ticker.add((ticker) => {
    hideoutElapsed += ticker.deltaMS;
    if (hideoutElapsed < HIDEOUT_TICK_MS) return;
    hideoutElapsed = 0;
    tick();
  });

  const save = () => saveGame(player, storage, clock);
  const autosave = new AutoSaver(save);
  app.ticker.add((ticker) => autosave.update(ticker.deltaMS));
  window.addEventListener("beforeunload", save);

  const showInventory = () =>
    scenes.change(
      new InventoryScene(player.inventory, {
        tooltipDelayMs: settings.tooltipDelayMs,
        tutorial:
          settings.tutorialStep < TUTORIAL.length
            ? new TutorialPanel(TUTORIAL, settings.tutorialStep, (step) => {
                settings.tutorialStep = step;
                applySettings(settings);
              })
            : undefined,
        player,
        onOpenCharacter: showCharacter,
        onOpenRaid: showRaidSetup,
        onOpenTraders: () => showTraders(),
        onSellItem: (item) => showTraders(item),
        onOpenQuests: showQuests,
        onOpenHideout: showHideout,
        onOpenFlea: showFlea,
      }),
    );
  const showFlea = () =>
    scenes.change(
      new FleaScene(player, {
        config: FLEA,
        clock,
        onBack: () => {
          save();
          showInventory();
        },
      }),
    );
  const showHideout = () =>
    scenes.change(
      new HideoutScene(player, {
        data: HIDEOUT,
        traders: TRADERS,
        clock,
        onBack: () => {
          save();
          showInventory();
        },
      }),
    );
  const showQuests = () =>
    scenes.change(
      new QuestsScene(player, {
        ctx: questContext,
        clock,
        onBack: () => {
          save();
          showInventory();
        },
        onEnding: () => {
          save();
          scenes.change(new EndingScene(player, showInventory));
        },
      }),
    );
  const showTraders = (sellItem?: Item) =>
    scenes.change(
      new TradersScene(player, {
        traders: TRADERS,
        quests: QUESTS,
        clock,
        sellItem,
        onBack: () => {
          save();
          showInventory();
        },
      }),
    );
  const showCharacter = () =>
    scenes.change(new CharacterScene(player, showInventory));
  const showRaidSetup = () =>
    scenes.change(
      new RaidSetupScene(player, {
        maps: MAPS,
        enemies: ENEMIES,
        clock,
        onStart: () => {
          // Quests avançam com o resultado (raids Scav não contam)
          recordRaidQuests(player, questContext, player.raid.active!);
          // Salva já com o resultado: recarregar não refaz a raid
          save();
          showRaid();
        },
        onBack: showInventory,
        onOpenLoadouts: showLoadouts,
        onOpenAuto: showAuto,
      }),
    );
  const showAuto = () =>
    scenes.change(
      new AutoRaidScene(player, {
        ctx: autoContext,
        clock,
        onBack: () => {
          save();
          showRaidSetup();
        },
        onViewRaid: () => showRaid(showAuto),
      }),
    );
  const showLoadouts = () =>
    scenes.change(
      new LoadoutScene(player, {
        shop: { traders: TRADERS, flea: FLEA },
        clock,
        onBack: () => {
          save();
          showRaidSetup();
        },
      }),
    );
  const showRaid = (after: () => void = showInventory) => {
    const active = player.raid.active!;
    scenes.change(
      new RaidScene(player, {
        clock,
        map: mapById(active.summary.map) ?? MAPS[0],
        speed: settings.raidSpeed,
        quests: questContext,
        onDone: () => {
          save();
          after();
        },
      }),
    );
  };
  /**
   * Primeiro o resumo do tempo fora (uma vez); depois, com uma raid em
   * andamento (jogo fechado no meio), volta para ela.
   */
  const showHome = () => {
    if (pendingReport) {
      const report = pendingReport;
      pendingReport = null;
      scenes.change(
        new OfflineScene(
          report,
          offlineData,
          player.factory.catalog,
          showHome,
          autoRaids.length > 0 ? [describeAutoRun(autoRaids)] : [],
        ),
      );
      return;
    }
    if (player.auto.running) showAuto();
    else if (player.raid.active) showRaid();
    else showInventory();
  };

  const showTitle = () => scenes.change(new TitleScene(showHome, showSettings));
  const showSettings = () =>
    scenes.change(
      new SettingsScene(settings, {
        onChange: applySettings,
        onBack: showTitle,
      }),
    );
  showTitle();

  gameReady(app);

  return { app, scenes, player, save };
}
