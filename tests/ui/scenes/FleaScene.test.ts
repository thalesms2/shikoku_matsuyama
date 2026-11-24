// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { fleaTick, listItem, marketDefs } from "../../../src/core/flea/flea.ts";
import { catalog } from "../../../src/data/items.ts";
import {
  FLEA_REFRESH_MS,
  FLEA_ROWS_PER_PAGE,
  FleaScene,
  describeFleaStatus,
  describeListed,
  describeListingRow,
  describeMarketRow,
  describeResult,
} from "../../../src/ui/scenes/FleaScene.ts";
import { ERROR_COLOR, OK_COLOR } from "../../../src/ui/scenes/TradersScene.ts";
import { HOUR, MIN, TEST_FLEA, market } from "../../core/flea/fleaFixtures.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

/** Sempre vende no primeiro sorteio */
const SURE = { ...TEST_FLEA, saleChance: 1 };

function setup(config = TEST_FLEA, width = 10, height = 10) {
  const m = market(width, height);
  const onBack = vi.fn();
  const scene = new FleaScene(m.player, {
    config,
    clock: m.clock,
    onBack,
  });
  const labels = () =>
    scene.rows.children
      .filter((c) => !("onPress" in c))
      .map((c) => (c as Text).text);
  return { ...m, scene, onBack, labels };
}

describe("textos do mercado", () => {
  it("linha de compra com a seta da tendência", () => {
    const ammo = catalog.get("ammo_9mm");
    expect(describeMarketRow(ammo, 2475, 1, TEST_FLEA, catalog)).toBe(
      `${ammo.name} x50 — 2.475 ₽ ▲`,
    );
    const bolts = catalog.get("barter_bolts");
    expect(describeMarketRow(bolts, 2750, -1, TEST_FLEA, catalog)).toBe(
      "Parafusos — 2.750 ₽ ▼",
    );
    expect(describeMarketRow(bolts, 2750, 0, TEST_FLEA, catalog)).toContain(
      "=",
    );
  });

  it("linha de anúncio: valor, preço, taxa e tempo", () => {
    const { put } = market();
    const can = put("food_can");
    const ok = { ok: true, amount: 1500 } as const;
    expect(describeListingRow(can, ok, 1, TEST_FLEA, catalog)).toEqual({
      label: `${can.def.name} — mercado 1.500 ₽ · pedir 1.500 ₽ · taxa 75 ₽ · vende em ~2min`,
      price: 1500,
    });
    expect(describeListingRow(can, ok, 2, TEST_FLEA, catalog).label).toContain(
      "não vende",
    );
    const ammo = put("ammo_9mm", 3);
    expect(
      describeListingRow(
        ammo,
        { ok: false, reason: "Motivo" },
        1,
        TEST_FLEA,
        catalog,
      ),
    ).toEqual({ label: `${ammo.def.name} x3 — Motivo`, price: 0 });
  });

  it("anúncios, resultados e situação", () => {
    const { player, put } = market();
    put("money_rub", 1000);
    const ammo = put("ammo_9mm", 10);
    listItem(player, TEST_FLEA, ammo, 500, 0);
    expect(describeListed(player.flea.listings[0], TEST_FLEA, catalog, 0)).toBe(
      `${ammo.def.name} x10 — 500 ₽ · vence em 10min`,
    );
    expect(
      describeResult(
        { kind: "sold", id: 1, def: "food_can", count: 2, price: 3000 },
        TEST_FLEA,
        catalog,
      ),
    ).toBe(`Vendido: ${catalog.get("food_can").name} x2 por 3.000 ₽`);
    expect(
      describeResult(
        { kind: "sold", id: 1, def: "sumiu", count: 1, price: 10 },
        TEST_FLEA,
        catalog,
      ),
    ).toBe("Vendido: sumiu por 10 ₽");
    expect(
      describeResult(
        { kind: "expired", id: 2, item: ammo },
        TEST_FLEA,
        catalog,
      ),
    ).toBe(`Venceu: ${ammo.def.name} x10 (volta ao estoque)`);
    expect(describeFleaStatus(player.flea, TEST_FLEA, 1, catalog)).toBe(
      "O mercado libera no nível 2 do PMC (você está no nível 1).",
    );
    expect(describeFleaStatus(player.flea, TEST_FLEA, 2, catalog)).toContain(
      "Anúncios: 1/2 · Vendidos: 0 (0 ₽) · Taxas pagas: 28 ₽ · Compras: 0 (0 ₽)",
    );
  });
});

describe("FleaScene", () => {
  it("aba Comprar: lista paginada, compra e recusa", () => {
    const { scene, put, labels, player } = setup(TEST_FLEA, 3, 1);
    const defs = marketDefs(catalog, TEST_FLEA);
    expect(labels()).toHaveLength(FLEA_ROWS_PER_PAGE);
    expect(labels()[0]).toContain(defs[0].name);
    expect(scene.prevButton.visible).toBe(true);
    expect(scene.lessButton.visible).toBe(false);
    expect(scene.rowButtons[0].alpha).toBeLessThan(1);
    scene.changePage(5);
    expect(scene.pageText.text).toBe(
      `${Math.ceil(defs.length / FLEA_ROWS_PER_PAGE)}/${Math.ceil(defs.length / FLEA_ROWS_PER_PAGE)}`,
    );
    scene.changePage(-9);
    expect(scene.page).toBe(0);

    put("money_rub", 400_000);
    scene.refresh();
    expect(scene.moneyText.text).toBe("Seu dinheiro: 400.000 ₽");
    const i = defs.findIndex((d) => d.id === "food_can");
    const page = Math.floor(i / FLEA_ROWS_PER_PAGE);
    scene.changePage(page);
    // a lista é recriada a cada ação: pega o botão de novo
    const row = () => scene.rowButtons[i % FLEA_ROWS_PER_PAGE];
    expect(row().alpha).toBe(1);
    tap(row());
    expect(scene.messageText.text).toBe(`Comprou ${defs[i].name}`);
    expect(scene.messageText.style.fill).toBe(OK_COLOR);
    tap(row());
    tap(row());
    expect(scene.messageText.text).toBe("Sem espaço no estoque");
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);
    expect(player.flea.stats.bought).toBe(2);
  });

  it("aba Vender: preço pedido, anunciar e vagas cheias", () => {
    const { scene, put, labels, player } = setup();
    put("money_rub", 10_000);
    const can = put("food_can");
    put("food_can");
    put("food_can");
    scene.selectTab("sell");
    expect(scene.lessButton.visible).toBe(true);
    expect(scene.ratioText.text).toBe("Pedir 100% do mercado");
    expect(labels()).toHaveLength(3);
    expect(labels()[0]).toContain("pedir 1.500 ₽");
    scene.changeRatio(2);
    expect(scene.ratioText.text).toBe("Pedir 110% do mercado");
    expect(labels()[0]).toContain("pedir 1.650 ₽");
    scene.changeRatio(-100);
    expect(scene.ratio).toBe(0.5);
    scene.changeRatio(100);
    expect(scene.ratio).toBe(TEST_FLEA.maxRatio);
    scene.changeRatio(-20);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe(
      `Anunciou ${can.def.name}; taxa de 75 ₽`,
    );
    expect(scene.listingsTab.text.text).toBe("Anúncios (1)");
    tap(scene.rowButtons[0]);
    expect(player.flea.listings).toHaveLength(2);
    expect(scene.rowButtons[0].alpha).toBeLessThan(1);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Todos os anúncios estão ocupados");
  });

  it("aba Anúncios: cancelar e retirar vendas", () => {
    const { scene, put, labels, player, clock } = setup(SURE);
    put("money_rub", 10_000);
    const a = put("food_can");
    const b = put("food_can");
    listItem(player, SURE, a, 1500, 0);
    listItem(player, SURE, b, 1500, 0);
    scene.selectTab("listings");
    expect(labels()).toHaveLength(2);
    expect(scene.rowButtons[0].text.text).toBe("Cancelar");
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe(
      "Anúncio cancelado; o item voltou ao estoque",
    );
    clock.advance(MIN);
    fleaTick(player, SURE, clock.now());
    scene.update(FLEA_REFRESH_MS - 1);
    expect(labels()[0]).toContain("vence em");
    scene.update(1);
    expect(labels()[0]).toContain("Vendido:");
    expect(scene.rowButtons[0].text.text).toBe("Retirar");
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Guardado no estoque");
    expect(labels()).toEqual([]);
    expect(scene.listingsTab.text.text).toBe("Anúncios");
  });

  it("bloqueado pelo nível: tudo apagado", () => {
    const { scene, player } = setup();
    player.pmc.xp = 0;
    scene.refresh();
    expect(scene.infoText.text).toContain("O mercado libera no nível 2");
    expect(scene.rowButtons.every((b) => b.alpha < 1)).toBe(true);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("O mercado libera no nível 2");
  });

  it("botões das abas, do preço e das páginas", () => {
    const { scene } = setup();
    tap(scene.nextButton);
    expect(scene.page).toBe(1);
    tap(scene.prevButton);
    expect(scene.page).toBe(0);
    tap(scene.sellTab);
    expect(scene.tab).toBe("sell");
    tap(scene.moreButton);
    expect(scene.ratio).toBeCloseTo(1.05);
    tap(scene.lessButton);
    expect(scene.ratio).toBe(1);
    tap(scene.listingsTab);
    expect(scene.tab).toBe("listings");
    tap(scene.buyTab);
    expect(scene.tab).toBe("buy");
  });

  it("voltar e redimensionar", () => {
    const { scene, onBack } = setup();
    tap(scene.backButton);
    expect(onBack).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
    scene.resize(502, 100000);
    expect(scene.content.scale.x).toBeCloseTo(0.5);
    // tempo passando não quebra nada
    scene.update(HOUR);
  });
});
