// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { traderState } from "../../../src/core/trade/trade.ts";
import type { TraderDef } from "../../../src/core/trade/types.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import {
  ERROR_COLOR,
  OK_COLOR,
  ROWS_PER_PAGE,
  TradersScene,
  describeLoyalty,
  describeOffer,
  describeSale,
  formatMoney,
} from "../../../src/ui/scenes/TradersScene.ts";
import {
  HOUR,
  TEST_TRADER,
  USD_TRADER,
  trader,
} from "../../core/trade/tradeFixtures.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

function setup(traders: readonly TraderDef[] = TRADERS, now = 0) {
  const clock = new ManualClock(now);
  const player = createNewPlayer(clock);
  const onBack = vi.fn();
  const scene = new TradersScene(player, { traders, clock, onBack });
  const labels = () =>
    scene.rows.children
      .filter((c) => !("onPress" in c))
      .map((c) => (c as Text).text);
  return { scene, player, clock, onBack, labels };
}

describe("textos", () => {
  const [L1, L2] = TEST_TRADER.levels;

  it("dinheiro com milhar e símbolo", () => {
    expect(formatMoney(150000, "money_rub", catalog)).toBe("150.000 ₽");
    expect(formatMoney(31, "money_usd", catalog)).toBe("31 $");
  });

  it("lealdade, próximo nível e reposição", () => {
    const state = traderState({}, TEST_TRADER, 0);
    const text = describeLoyalty(TEST_TRADER, state, L1, catalog, 0);
    expect(text).toBe(
      [
        "Só para testes.",
        "",
        "Lealdade: nível 1/2 · Reputação 0.00 · Negociado 0 ₽",
        "Próximo nível: PMC nível 2, reputação 0.10, 1.000 ₽ negociados",
        "Reposição do estoque em 60:00",
      ].join("\n"),
    );
    expect(describeLoyalty(TEST_TRADER, state, L2, catalog, 0)).toContain(
      "Lealdade máxima",
    );
  });

  it("ofertas: dinheiro, quantidade, troca e bloqueio", () => {
    const state = traderState({}, TEST_TRADER, 0);
    const offer = (id: string) => TEST_TRADER.offers.find((o) => o.id === id)!;
    expect(
      describeOffer(TEST_TRADER, offer("bolts"), state, L1, catalog),
    ).toEqual({
      label: "Parafusos — 3.750 ₽ — estoque 2/2",
      locked: false,
    });
    expect(
      describeOffer(TEST_TRADER, offer("ammo"), state, L1, catalog).label,
    ).toBe("Cartucho 9mm x50 — 3.375 ₽ — estoque 5/5");
    expect(
      describeOffer(TEST_TRADER, offer("gold"), state, L1, catalog).label,
    ).toBe("Corrente de ouro — troca: Parafusos x2 — estoque 1/1");
    const mixed = {
      ...offer("gold"),
      barter: [
        { item: "barter_gpu", count: 1 },
        { item: "barter_bolts", count: 3 },
      ],
    };
    expect(describeOffer(TEST_TRADER, mixed, state, L1, catalog).label).toBe(
      "Corrente de ouro — troca: Placa de vídeo + Parafusos x3 — estoque 1/1",
    );
    expect(describeOffer(USD_TRADER, offer("gpu"), state, L1, catalog)).toEqual(
      {
        label: "Placa de vídeo — 1.476 $ — exige nível 2",
        locked: true,
      },
    );
  });

  it("venda: preço ou motivo", () => {
    const { factory } = trader();
    expect(
      describeSale(
        factory.create("ammo_9mm", 3),
        { ok: true, amount: 67 },
        "money_rub",
        catalog,
      ),
    ).toBe("Cartucho 9mm x3 — 67 ₽");
    expect(
      describeSale(
        factory.create("barter_bolts"),
        { ok: false, reason: "Não" },
        "money_rub",
        catalog,
      ),
    ).toBe("Parafusos — Não");
  });
});

describe("TradersScene", () => {
  it("começa no primeiro vendedor, aba de compra, com o dinheiro do jogador", () => {
    const { scene, labels } = setup();
    expect(scene.trader).toBe(TRADERS[0]);
    expect(scene.nameText.text).toBe("Coronel Brás · Armas e munição");
    expect(scene.traderButtons.get("colonel")!.alpha).toBe(1);
    expect(scene.traderButtons.get("doctor")!.alpha).toBeLessThan(1);
    expect(scene.buyTab.alpha).toBe(1);
    expect(scene.moneyText.text).toBe("Seu dinheiro: 150.000 ₽ · 0 € · 0 $");
    expect(labels()).toHaveLength(TRADERS[0].offers.length);
    expect(scene.infoText.text).toContain("Lealdade: nível 1/3");
    expect(scene.prevButton.visible).toBe(false);
    // oferta bloqueada fica apagada
    const locked = TRADERS[0].offers.findIndex((o) => o.level > 1);
    expect(scene.rowButtons[locked].alpha).toBeLessThan(1);
    expect(scene.rowButtons[0].text.text).toBe("Comprar");
    expect(
      scene.rowButtons[TRADERS[0].offers.findIndex((o) => o.barter)].text.text,
    ).toBe("Trocar");
  });

  it("compra: mensagem verde, estoque e dinheiro atualizados", () => {
    const { scene, player, labels } = setup();
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Comprou Pistola PK-9");
    expect(scene.messageText.style.fill).toBe(OK_COLOR);
    expect(labels()[0]).toContain("estoque 2/3");
    expect(scene.moneyText.text).toContain("141.875 ₽");
    expect(player.traders.colonel.bought).toEqual({ pistol: 1 });
  });

  it("compra recusada: mensagem vermelha", () => {
    const { scene } = setup();
    const barter = TRADERS[0].offers.findIndex((o) => o.barter);
    tap(scene.rowButtons[barter]);
    expect(scene.messageText.text).toBe("Faltam itens para a troca");
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);
  });

  it("troca de vendedor e aba de venda", () => {
    const { scene, player, labels } = setup();
    tap(scene.traderButtons.get("doctor")!);
    expect(scene.trader.id).toBe("doctor");
    expect(scene.messageText.text).toBe("");
    tap(scene.sellTab);
    expect(scene.tab).toBe("sell");
    expect(scene.sellTab.alpha).toBe(1);
    // só o que a médica compra (remédios e comida), sem dinheiro
    const items = scene.saleItems();
    expect(items.length).toBeGreaterThan(0);
    expect(
      items.every((i) => ["medical", "food"].includes(i.def.category)),
    ).toBe(true);
    const first = items[0];
    expect(labels()[0]).toContain(first.def.name);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toMatch(/^Vendeu .+ por .+ ₽$/);
    expect(first.location).toBeNull();
    expect(player.traders.doctor.volume).toBeGreaterThan(0);
    tap(scene.buyTab);
    expect(scene.tab).toBe("buy");
  });

  it("venda recusada aparece apagada e com o motivo", () => {
    const { scene, player } = setup([
      { ...TEST_TRADER, buys: { backpack: 1 } },
    ]);
    const sack = player.factory.create("backpack_sack");
    player.inventory.stash.place(sack, 0, 11, false);
    sack.grids[0].place(player.factory.create("food_can"), 0, 0, false);
    tap(scene.sellTab);
    const row = scene.saleItems().indexOf(sack);
    expect(scene.rowButtons[row].alpha).toBeLessThan(1);
    tap(scene.rowButtons[row]);
    expect(scene.messageText.text).toBe("Esvazie antes de vender");
  });

  it("páginas", () => {
    const many: TraderDef = {
      ...TEST_TRADER,
      offers: Array.from({ length: ROWS_PER_PAGE + 3 }, (_, i) => ({
        id: `o${i}`,
        item: "barter_bolts",
        level: 1,
        stock: 1,
      })),
    };
    const { scene, labels } = setup([many]);
    expect(scene.pageText.text).toBe("1/2");
    expect(scene.nextButton.visible).toBe(true);
    expect(labels()).toHaveLength(ROWS_PER_PAGE);
    tap(scene.nextButton);
    expect(scene.page).toBe(1);
    expect(labels()).toHaveLength(3);
    tap(scene.nextButton);
    expect(scene.page).toBe(1);
    tap(scene.prevButton);
    tap(scene.prevButton);
    expect(scene.page).toBe(0);
  });

  it("update conta a reposição e repõe o estoque na hora", () => {
    const { scene, clock, labels } = setup();
    tap(scene.rowButtons[0]);
    expect(labels()[0]).toContain("estoque 2/3");
    clock.advance(HOUR - 1000);
    scene.update();
    expect(scene.infoText.text).toContain("Reposição do estoque em 00:01");
    clock.advance(1000);
    scene.update();
    expect(labels()[0]).toContain("estoque 3/3");
    expect(scene.infoText.text).toContain("Reposição do estoque em 60:00");
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
