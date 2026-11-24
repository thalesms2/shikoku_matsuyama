// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { describe, expect, it } from "vitest";

import { catalog } from "../../../src/data/items.ts";
import {
  ERROR_COLOR,
  OK_COLOR,
  TradersScene,
  describeRepair,
} from "../../../src/ui/scenes/TradersScene.ts";
import { TEST_TRADER, trader } from "../../core/trade/tradeFixtures.ts";

const REPAIRER = { ...TEST_TRADER, id: "fix", repairRate: 0.5 };

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

describe("TradersScene: conserto", () => {
  it("linha com durabilidade e preço (ou o motivo)", () => {
    const { factory } = trader();
    const armor = factory.create("armor_civil");
    armor.durability = 10.2;
    expect(
      describeRepair(armor, { ok: true, amount: 4500 }, "money_rub", catalog),
    ).toBe(`${armor.def.name} — 11/40 — 4.500 ₽`);
    expect(
      describeRepair(
        armor,
        { ok: false, reason: "Motivo" },
        "money_rub",
        catalog,
      ),
    ).toBe(`${armor.def.name} — 11/40 — Motivo`);
  });

  it("aba só nos vendedores que consertam; conserta e volta para Comprar", () => {
    const { player, put, clock } = trader();
    const armor = put("armor_civil");
    armor.durability = 20;
    const scene = new TradersScene(player, {
      traders: [REPAIRER, TEST_TRADER],
      clock,
      onBack: () => {},
    });
    expect(scene.repairTab.visible).toBe(true);
    tap(scene.repairTab);
    expect(scene.tab).toBe("repair");
    const label = () => (scene.rows.children[0] as Text).text;
    expect(label()).toContain("20/40");
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Dinheiro insuficiente");
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);
    put("money_rub", 10_000);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe(
      `Consertou ${armor.def.name} por 3.000 ₽`,
    );
    expect(scene.messageText.style.fill).toBe(OK_COLOR);
    expect(scene.rowButtons).toHaveLength(0);

    scene.selectTrader(TEST_TRADER);
    expect(scene.repairTab.visible).toBe(false);
    expect(scene.tab).toBe("buy");
    scene.selectTab("sell");
    scene.selectTrader(REPAIRER);
    expect(scene.tab).toBe("sell");
  });
});
