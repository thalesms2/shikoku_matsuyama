// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { traderState } from "../../../src/core/trade/trade.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { QUESTS } from "../../../src/data/quests.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import {
  TradersScene,
  describeOffer,
} from "../../../src/ui/scenes/TradersScene.ts";
import { TEST_TRADER } from "../../core/trade/tradeFixtures.ts";

describe("TradersScene: ofertas presas a quests", () => {
  it("texto da oferta bloqueada por quest", () => {
    const state = traderState({}, TEST_TRADER, 0);
    const offer = TEST_TRADER.offers[0];
    const [L1] = TEST_TRADER.levels;
    expect(
      describeOffer(TEST_TRADER, offer, state, L1, catalog, "Limpeza"),
    ).toEqual({
      label: 'Parafusos — 3.750 ₽ — exige a quest "Limpeza"',
      locked: true,
    });
    // nível bloqueado aparece primeiro
    const high = { ...offer, level: 2 };
    expect(
      describeOffer(TEST_TRADER, high, state, L1, catalog, "Limpeza").label,
    ).toContain("exige nível 2");
  });

  function rowFor(scene: TradersScene, id: string) {
    const index = scene.trader.offers.findIndex((o) => o.id === id);
    const labels = scene.rows.children.filter((c) => !("onPress" in c));
    return {
      label: (labels[index] as Text).text,
      button: scene.rowButtons[index],
    };
  }

  it("mostra o nome da quest e libera quando ela é concluída", () => {
    const player = createNewPlayer(new ManualClock());
    const scene = new TradersScene(player, {
      traders: TRADERS,
      quests: QUESTS,
      clock: new ManualClock(),
      onBack: vi.fn(),
    });
    let row = rowFor(scene, "rifle-cleanup");
    expect(row.label).toContain('exige a quest "Limpeza"');
    expect(row.button.alpha).toBeLessThan(1);
    player.quests.cleanup = { status: "completed", progress: [5] };
    scene.refresh();
    row = rowFor(scene, "rifle-cleanup");
    expect(row.label).toContain("estoque 1/1");
    expect(row.button.alpha).toBe(1);
  });

  it("sem a lista de quests, mostra o id", () => {
    const player = createNewPlayer(new ManualClock());
    const scene = new TradersScene(player, {
      traders: TRADERS,
      clock: new ManualClock(),
      onBack: vi.fn(),
    });
    expect(rowFor(scene, "rifle-cleanup").label).toContain(
      'exige a quest "cleanup"',
    );
  });
});
