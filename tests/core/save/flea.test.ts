import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createFleaState, mix } from "../../../src/core/flea/flea.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import type { SaveData, SavedFlea } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const loadFull = (data: unknown, now = 9000) =>
  deserializeGame(migrate(data), catalog, new ManualClock(now));
const load = (data: unknown, now = 9000) => loadFull(data, now).state;

const saved = (at = 1) =>
  serializeGame(createNewPlayer(new ManualClock()), at) as SaveData;

describe("save v7: mercado", () => {
  it("SAVE_VERSION é pelo menos 7 e há migração para cada versão", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(7);
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v]).toBeTypeOf("function");
    }
  });

  it("migração 6 → 7 começa sem anúncios, a partir do savedAt", () => {
    const data = saved(700) as Partial<SaveData>;
    delete data.flea;
    const migrated = migrate({ ...data, version: 6 });
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.flea).toEqual(createFleaState(700));
    expect(MIGRATIONS[6]({ version: 6 }).flea).toEqual(createFleaState(0));
  });

  it("anúncios (com o item), resultados, pressão e estatísticas voltam", () => {
    const player = createNewPlayer(new ManualClock());
    const ammo = player.factory.create("ammo_9mm", 20);
    const bolts = player.factory.create("barter_bolts");
    bolts.fir = true;
    player.flea = {
      seed: 77,
      nextListing: 5,
      listings: [
        { id: 3, item: ammo, price: 900, listedAt: 10, expiresAt: 20 },
      ],
      results: [
        { kind: "sold", id: 1, def: "food_can", count: 1, price: 1400 },
        { kind: "expired", id: 2, item: bolts },
      ],
      pressure: { ammo_9mm: { value: -0.1, at: 5 } },
      lastCheck: 15,
      stats: { sold: 1, earned: 1400, fees: 80, bought: 2, spent: 3000 },
    };
    const data = serializeGame(player, 30);
    expect(data.flea!.listings[0].item).toEqual({
      uid: ammo.uid,
      def: "ammo_9mm",
      count: 20,
    });
    const state = load(JSON.parse(JSON.stringify(data)));
    const { flea } = state;
    expect(flea.seed).toBe(77);
    expect(flea.nextListing).toBe(5);
    expect(flea.pressure).toEqual(player.flea.pressure);
    expect(flea.stats).toEqual(player.flea.stats);
    expect(flea.lastCheck).toBe(15);
    const listing = flea.listings[0];
    expect(listing).toMatchObject({ id: 3, price: 900, listedAt: 10 });
    expect(listing.item).toMatchObject({ uid: ammo.uid, count: 20 });
    expect(listing.item.location).toBeNull();
    expect(flea.results[0]).toEqual(player.flea.results[0]);
    const expired = flea.results[1];
    expect(expired.kind === "expired" && expired.item.fir).toBe(true);
  });

  it("sem mercado no save, começa vazio", () => {
    const data = saved();
    delete data.flea;
    expect(load(data, 500).flea).toEqual(createFleaState(500));
  });

  it("dados inválidos são descartados ou voltam ao padrão", () => {
    const data = saved();
    const item = { uid: "z1", def: "food_can", count: 1 };
    const gone = { uid: "z2", def: "sumiu", count: 1 };
    const flea = {
      seed: 1.5,
      nextListing: "x",
      listings: [
        { id: 4, item, price: 100, listedAt: 0, expiresAt: 10 },
        { id: 1.5, item, price: 100, listedAt: 0, expiresAt: 10 },
        { id: 5, item, price: 0, listedAt: 0, expiresAt: 10 },
        { id: 6, item, price: 1.5, listedAt: 0, expiresAt: 10 },
        { id: 7, item, price: 100, listedAt: "a", expiresAt: 10 },
        { id: 8, item, price: 100, listedAt: 0, expiresAt: null },
        { id: 9, price: 100, listedAt: 0, expiresAt: 10 },
        { id: 10, item: gone, price: 100, listedAt: 0, expiresAt: 10 },
        null,
      ],
      results: [
        { kind: "sold", id: 11, def: "food_can", count: 1, price: 10 },
        { kind: "sold", id: 12, def: 3, count: 1, price: 10 },
        { kind: "sold", id: 13, def: "food_can", count: 1.5, price: 10 },
        { kind: "sold", id: 14, def: "food_can", count: 1, price: 0.5 },
        { kind: "sold", id: 15, def: "food_can", count: 1, price: 0 },
        { kind: "expired", id: 16, item: { ...item, uid: "z3" } },
        { kind: "expired", id: 17 },
        { kind: "expired", id: 18, item: gone },
        { kind: "outro", id: 19 },
        { kind: "sold", id: "20" },
        null,
      ],
      pressure: {
        ok: { value: 0.1, at: 3 },
        a: { value: "x", at: 3 },
        b: { value: 0.1 },
        c: null,
      },
      lastCheck: "ontem",
      stats: { sold: 2, earned: "muito" },
    };
    data.flea = flea as unknown as SavedFlea;
    const { state, warnings } = loadFull(data, 600);
    expect(state.flea.listings.map((l) => l.id)).toEqual([4]);
    expect(state.flea.results.map((r) => r.id)).toEqual([11, 16]);
    expect(state.flea.pressure).toEqual({ ok: { value: 0.1, at: 3 } });
    expect(state.flea.stats).toEqual({
      sold: 2,
      earned: 0,
      fees: 0,
      bought: 0,
      spent: 0,
    });
    expect(state.flea.seed).toBe(mix(600));
    expect(state.flea.nextListing).toBe(17);
    expect(state.flea.lastCheck).toBe(600);
    expect(warnings.filter((w) => w.includes("sumiu"))).toHaveLength(2);
  });

  it("campos de lista e de pressão faltando", () => {
    const data = saved();
    data.flea = { seed: 3, nextListing: 2 } as unknown as SavedFlea;
    const { flea } = load(data);
    expect(flea).toMatchObject({
      seed: 3,
      nextListing: 2,
      listings: [],
      results: [],
      pressure: {},
    });
    expect(flea.stats.sold).toBe(0);
  });
});
