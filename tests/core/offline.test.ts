import { describe, expect, it } from "vitest";

import { ManualClock } from "../../src/core/clock.ts";
import { OFFLINE_MIN_MS, catchUp, hasNews } from "../../src/core/offline.ts";
import type { OfflineReport } from "../../src/core/offline.ts";
import { traderState } from "../../src/core/trade/trade.ts";
import { FLEA } from "../../src/data/flea.ts";
import { HIDEOUT } from "../../src/data/hideout.ts";
import { createNewPlayer } from "../../src/data/newGame.ts";
import { TRADERS, traderById } from "../../src/data/traders.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DATA = { hideout: HIDEOUT, flea: FLEA, traders: TRADERS };

function listing(id: number, price: number) {
  const player = createNewPlayer(new ManualClock(0));
  const item = player.factory.create("food_can");
  return {
    player,
    entry: { id, item, price, listedAt: 0, expiresAt: FLEA.listingMs },
  };
}

describe("catchUp", () => {
  it("obras, produções, renda, cura, mercado, Scav e vendedores", () => {
    const { player, entry } = listing(1, 1_000_000);
    const { hideout, pmc } = player;
    hideout.modules.intel = 1;
    hideout.construction = { module: "medstation", level: 1, endsAt: 10 * MIN };
    hideout.productions = {
      workbench: { recipe: "ammo-9mm", endsAt: 20 * MIN },
      kitchen: { recipe: "boil-water", endsAt: 0 },
    };
    pmc.health.thorax = 10;
    player.flea.listings.push(entry);
    player.scav.readyAt = 30 * MIN;
    traderState(player.traders, traderById("colonel")!, 0);

    const report = catchUp(player, DATA, 13 * HOUR);
    expect(report).toEqual({
      awayMs: 13 * HOUR,
      constructions: [{ module: "medstation", level: 1 }],
      productions: ["ammo-9mm"],
      income: 18_000,
      health: 75,
      energy: 0,
      hydration: 0,
      fleaSold: 0,
      fleaEarned: 0,
      fleaExpired: 1,
      scavReady: true,
      restocked: ["colonel"],
    });
    expect(hasNews(report)).toBe(true);
    expect(hideout.lastTick).toBe(13 * HOUR);
    expect(hideout.modules.medstation).toBe(1);
  });

  it("vendas no mercado e renda que já estava no limite", () => {
    const { player, entry } = listing(1, 1);
    player.hideout.modules.intel = 1;
    player.hideout.incomeSince = -100 * HOUR;
    player.flea.listings.push(entry);
    const report = catchUp(player, DATA, HOUR);
    expect(report.fleaSold).toBe(1);
    expect(report.fleaEarned).toBe(1);
    expect(report.income).toBe(0);
    expect(report.scavReady).toBe(false);
    expect(report.restocked).toEqual([]);
    expect(report.constructions).toEqual([]);
  });

  it("obra que ainda não terminou não aparece", () => {
    const player = createNewPlayer(new ManualClock(0));
    player.hideout.construction = { module: "stash", level: 1, endsAt: HOUR };
    const report = catchUp(player, DATA, MIN);
    expect(report.constructions).toEqual([]);
    expect(hasNews(report)).toBe(false);
  });
});

describe("hasNews", () => {
  const empty: OfflineReport = {
    awayMs: OFFLINE_MIN_MS,
    constructions: [],
    productions: [],
    income: 0,
    health: 0,
    energy: 0,
    hydration: 0,
    fleaSold: 0,
    fleaEarned: 0,
    fleaExpired: 0,
    scavReady: false,
    restocked: [],
  };

  it.each<[string, Partial<OfflineReport>]>([
    ["obra", { constructions: [{ module: "x", level: 1 }] }],
    ["produção", { productions: ["x"] }],
    ["renda", { income: 1 }],
    ["vida", { health: 1 }],
    ["energia", { energy: 1 }],
    ["hidratação", { hydration: 1 }],
    ["venda", { fleaSold: 1 }],
    ["vencido", { fleaExpired: 1 }],
    ["Scav", { scavReady: true }],
    ["vendedor", { restocked: ["x"] }],
  ])("%s conta como novidade", (_, change) => {
    expect(hasNews(empty)).toBe(false);
    expect(hasNews({ ...empty, ...change })).toBe(true);
    expect(hasNews({ ...empty, ...change, awayMs: OFFLINE_MIN_MS - 1 })).toBe(
      false,
    );
  });
});
