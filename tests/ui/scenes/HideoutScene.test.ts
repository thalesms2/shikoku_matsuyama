// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import {
  HideoutScene,
  REFRESH_MS,
  describeEffects,
  describeItems,
  formatDuration,
} from "../../../src/ui/scenes/HideoutScene.ts";
import { ERROR_COLOR, OK_COLOR } from "../../../src/ui/scenes/TradersScene.ts";
import { HOUR, MIN, TEST_HIDEOUT } from "../../core/hideout/hideoutFixtures.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

function setup() {
  const clock = new ManualClock(0);
  const player = createNewPlayer(clock);
  const onBack = vi.fn();
  const scene = new HideoutScene(player, {
    data: TEST_HIDEOUT,
    traders: TRADERS,
    clock,
    onBack,
  });
  const labels = () =>
    scene.rows.children
      .filter((c) => !("onPress" in c))
      .map((c) => (c as Text).text);
  const pick = (id: string) => tap(scene.moduleButtons.get(id)!);
  return { scene, player, clock, onBack, labels, pick };
}

describe("textos do esconderijo", () => {
  it("durações", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(20_500)).toBe("21s");
    expect(formatDuration(45 * MIN)).toBe("45min");
    expect(formatDuration(HOUR)).toBe("1h");
    expect(formatDuration(2.5 * HOUR)).toBe("2h 30min");
  });

  it("efeitos", () => {
    expect(
      describeEffects(
        {
          stashRows: 3,
          healPerMinute: 1,
          energyPerMinute: 0.5,
          hydrationPerMinute: 0.5,
          productionSpeed: 0.1,
          incomePerHour: 1500,
          incomeCap: 18000,
          scavCooldown: 0.15,
        },
        catalog,
      ),
    ).toBe(
      "+3 linhas no estoque, cura 1 PV/min, +0.5 energia/min, +0.5 hidratação/min, produções 10% mais rápidas, 1.500 ₽/h (máx. 18.000 ₽), espera da raid Scav −15%",
    );
    expect(describeEffects({ incomePerHour: 10 }, catalog)).toBe(
      "10 ₽/h (máx. 0 ₽)",
    );
    expect(describeEffects({}, catalog)).toBe("libera receitas");
  });

  it("itens", () => {
    expect(describeItems([], catalog)).toBe("nada");
    expect(
      describeItems(
        [
          { item: "barter_bolts", count: 2 },
          { item: "money_rub", count: 30000 },
          { item: "med_kit", count: 1 },
        ],
        catalog,
      ),
    ).toBe("Parafusos x2 + 30.000 ₽ + Kit de primeiros socorros");
  });
});

describe("HideoutScene", () => {
  it("começa no primeiro módulo, com a vida do PMC e os níveis", () => {
    const { scene, labels } = setup();
    expect(scene.module.id).toBe("power");
    expect(scene.nameText.text).toBe("Energia · nível 0/1");
    expect(scene.moduleButtons.get("power")!.text.text).toBe("Energia 0/1");
    expect(scene.moduleButtons.get("store")!.alpha).toBeLessThan(1);
    expect(scene.pmcText.text).toBe(
      "PMC: vida 440/440 · energia 100/100 · hidratação 100/100",
    );
    expect(scene.infoText.text).toContain("Agora: não construído");
    expect(scene.upgradeText.text).toContain(
      "Nível 1: produções 50% mais rápidas",
    );
    expect(scene.upgradeText.text).toContain("Custo: 1.000 ₽ · obra de 10min");
    expect(scene.upgradeButton.text.text).toBe("Construir");
    expect(labels()[0]).toBe("nada → Garrafa de água · 1h · exige nível 1");
    expect(scene.rowButtons[0].alpha).toBeLessThan(1);
  });

  it("obra: começa, mostra a contagem e termina pelo tick do jogo", () => {
    const { scene, player, clock } = setup();
    tap(scene.upgradeButton);
    expect(scene.messageText.text).toBe("Obra começou: nível 1");
    expect(scene.messageText.style.fill).toBe(OK_COLOR);
    expect(scene.upgradeButton.visible).toBe(false);
    expect(scene.upgradeText.text).toBe("Em obra: nível 1, termina em 10min");
    clock.advance(10 * MIN);
    player.hideout.modules.power = 1;
    player.hideout.construction = null;
    scene.update(REFRESH_MS - 1);
    expect(scene.nameText.text).toBe("Energia · nível 0/1");
    scene.update(1);
    expect(scene.nameText.text).toBe("Energia · nível 1/1");
    expect(scene.upgradeText.text).toBe("Nível máximo");
    expect(scene.upgradeButton.visible).toBe(false);
  });

  it("obra recusada e bloqueios listados", () => {
    const { scene, player, pick } = setup();
    player.hideout.modules.store = 1;
    pick("store");
    expect(scene.upgradeButton.text.text).toBe("Melhorar");
    expect(scene.upgradeText.text).toContain(
      "Falta: Energia nível 1; Lealdade nível 2 com Doutora Iara; PMC nível 3",
    );
    tap(scene.upgradeButton);
    expect(scene.messageText.text).toBe("Energia nível 1");
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);
    expect(scene.infoText.text).toContain("Agora: +2 linhas no estoque");
    // obra de outro módulo não mostra a contagem aqui
    player.hideout.construction = { module: "power", level: 1, endsAt: 1 };
    scene.refresh();
    expect(scene.upgradeButton.visible).toBe(true);
  });

  it("produção: começar, contagem, retirar", () => {
    const { scene, player, clock, labels } = setup();
    player.hideout.modules.power = 1;
    scene.refresh();
    expect(labels()[0]).toBe("nada → Garrafa de água · 30min");
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Produção começou");
    expect(labels()[0]).toBe("nada → Garrafa de água · 30min · falta 30min");
    expect(scene.rowButtons[0].text.text).toBe("Produzindo");
    expect(scene.rowButtons[0].alpha).toBeLessThan(1);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Ainda não terminou");
    // a outra receita do módulo fica bloqueada
    tap(scene.rowButtons[1]);
    expect(scene.messageText.text).toBe("Produção em andamento");
    clock.advance(30 * MIN);
    scene.refresh();
    expect(labels()[0]).toContain("pronto!");
    expect(scene.rowButtons[0].text.text).toBe("Retirar");
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Produto guardado no estoque");
    expect(player.hideout.productions).toEqual({});
  });

  it("receita de nível acima do módulo", () => {
    const { labels, pick } = setup();
    pick("store");
    expect(labels()[0]).toBe("nada → Parafusos · 1h · exige nível 2");
  });

  it("renda: acumula e coleta", () => {
    const { scene, player, clock, labels, pick } = setup();
    pick("radio");
    expect(labels()).toEqual([]);
    player.hideout.modules.radio = 1;
    scene.refresh();
    expect(labels()[0]).toBe("Renda acumulada: 0 ₽ de 3.000 ₽");
    expect(scene.rowButtons[0].alpha).toBeLessThan(1);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Nada para coletar");
    clock.advance(2 * HOUR);
    scene.refresh();
    expect(labels()[0]).toBe("Renda acumulada: 2.000 ₽ de 3.000 ₽");
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Coletou 2.000 ₽");
  });

  it("voltar e redimensionar", () => {
    const { scene, onBack } = setup();
    tap(scene.backButton);
    expect(onBack).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
    scene.resize(502, 100000);
    expect(scene.content.scale.x).toBeCloseTo(0.5);
  });
});
