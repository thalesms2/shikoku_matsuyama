// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { OfflineReport } from "../../../src/core/offline.ts";
import { FLEA } from "../../../src/data/flea.ts";
import { HIDEOUT } from "../../../src/data/hideout.ts";
import { catalog } from "../../../src/data/items.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import { OfflineScene } from "../../../src/ui/scenes/OfflineScene.ts";

describe("OfflineScene: linhas a mais", () => {
  it("entram no fim da lista", () => {
    const report: OfflineReport = {
      awayMs: 60_000,
      constructions: [],
      productions: [],
      income: 0,
      health: 0,
      energy: 0,
      hydration: 0,
      fleaSold: 0,
      fleaEarned: 0,
      fleaExpired: 0,
      scavReady: true,
      restocked: [],
    };
    const scene = new OfflineScene(
      report,
      { hideout: HIDEOUT, flea: FLEA, traders: TRADERS },
      catalog,
      () => {},
      ["Raids automáticas: 2 feita(s), extraiu 2"],
    );
    expect(scene.body.text).toBe(
      "• A raid Scav está liberada\n• Raids automáticas: 2 feita(s), extraiu 2",
    );
  });
});
