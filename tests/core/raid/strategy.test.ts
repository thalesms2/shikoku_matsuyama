import { describe, expect, it } from "vitest";

import {
  KARMA,
  STRATEGIES,
  clampKarma,
} from "../../../src/core/raid/strategy.ts";
import { STRATEGY_IDS } from "../../../src/core/raid/types.ts";

describe("estratégias", () => {
  it("todas existem, com id igual à chave e extração antes do fim", () => {
    for (const id of STRATEGY_IDS) {
      const s = STRATEGIES[id];
      expect(s.id).toBe(id);
      expect(s.extractAt[0]).toBeLessThan(s.extractAt[1]);
      expect(s.extractAt[1]).toBeLessThan(1);
    }
  });

  it("furtivo evita mais e acha menos; agressivo encontra mais e acha mais", () => {
    const { stealth, balanced, aggressive } = STRATEGIES;
    expect(stealth.avoid).toBeGreaterThan(balanced.avoid);
    expect(aggressive.avoid).toBe(0);
    expect(stealth.encounter).toBeLessThan(balanced.encounter);
    expect(aggressive.encounter).toBeGreaterThan(balanced.encounter);
    expect(stealth.loot).toBeLessThan(aggressive.loot);
  });
});

describe("clampKarma", () => {
  it("limita entre o mínimo e o máximo", () => {
    expect(clampKarma(3)).toBe(3);
    expect(clampKarma(99)).toBe(KARMA.max);
    expect(clampKarma(-99)).toBe(KARMA.min);
  });
});
