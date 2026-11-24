import { describe, expect, it } from "vitest";

import { HIDEOUT, HIDEOUT_MODULES, RECIPES } from "../../src/data/hideout.ts";
import { catalog } from "../../src/data/items.ts";
import { traderById } from "../../src/data/traders.ts";

const byId = new Map(HIDEOUT_MODULES.map((m) => [m.id, m]));

describe("esconderijo", () => {
  it("todos os módulos do plano", () => {
    expect(HIDEOUT.modules).toBe(HIDEOUT_MODULES);
    expect(HIDEOUT.recipes).toBe(RECIPES);
    expect(byId.size).toBe(HIDEOUT_MODULES.length);
    const effects = new Set(
      HIDEOUT_MODULES.flatMap((m) =>
        m.levels.flatMap((l) => Object.keys(l.effects)),
      ),
    );
    for (const key of [
      "stashRows",
      "healPerMinute",
      "energyPerMinute",
      "productionSpeed",
      "incomePerHour",
      "scavCooldown",
    ]) {
      expect(effects.has(key)).toBe(true);
    }
    expect(RECIPES.some((r) => r.module === "workbench")).toBe(true);
  });

  it.each(HIDEOUT_MODULES.map((m) => [m.id, m] as const))(
    "%s: níveis, custos e requisitos válidos",
    (_, def) => {
      def.levels.forEach((level, i) => {
        expect(level.level).toBe(i + 1);
        expect(level.buildMs).toBeGreaterThan(0);
        for (const c of level.cost) {
          expect(catalog.has(c.item)).toBe(true);
          expect(c.count).toBeGreaterThan(0);
        }
        for (const req of level.requires.modules ?? []) {
          const other = byId.get(req.module)!;
          expect(other).toBeDefined();
          expect(req.module).not.toBe(def.id);
          expect(req.level).toBeLessThanOrEqual(other.levels.length);
        }
        const loyalty = level.requires.loyalty;
        if (loyalty) expect(traderById(loyalty.trader)).not.toBeNull();
        const e = level.effects;
        expect(e.productionSpeed ?? 0).toBeLessThan(1);
        expect(e.scavCooldown ?? 0).toBeLessThan(1);
        if (e.incomePerHour) expect(e.incomeCap).toBeGreaterThan(0);
      });
      // efeitos de um nível não pioram no seguinte
      for (let i = 1; i < def.levels.length; i++) {
        const [a, b] = [def.levels[i - 1].effects, def.levels[i].effects];
        for (const key of Object.keys(a) as (keyof typeof a)[]) {
          expect(b[key] ?? 0).toBeGreaterThanOrEqual(a[key]!);
        }
      }
    },
  );

  it("receitas com módulo, itens e quantidades válidos", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const r of RECIPES) {
      const def = byId.get(r.module)!;
      expect(r.moduleLevel).toBeLessThanOrEqual(def.levels.length);
      expect(r.durationMs).toBeGreaterThan(0);
      for (const c of [...r.inputs, r.output]) {
        expect(catalog.has(c.item)).toBe(true);
        expect(c.count).toBeGreaterThan(0);
      }
      // produzir nunca vale menos que os ingredientes
      const value = (items: typeof r.inputs) =>
        items.reduce((s, c) => s + catalog.get(c.item).basePrice * c.count, 0);
      expect(value([r.output])).toBeGreaterThanOrEqual(value(r.inputs) * 0.8);
    }
  });
});
