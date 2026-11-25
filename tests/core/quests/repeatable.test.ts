import { afterEach, describe, expect, it } from "vitest";

import {
  CORE_DEFAULTS,
  coreBalance,
  resetCoreBalance,
  setCoreBalance,
} from "../../../src/core/balance.ts";
import { ManualClock } from "../../../src/core/clock.ts";
import {
  acceptQuest,
  completeQuest,
  progressAfterRaid,
  questStatus,
} from "../../../src/core/quests/quests.ts";
import {
  createRepeatableState,
  ensureRepeatables,
  repeatableDef,
  withRepeatables,
} from "../../../src/core/quests/repeatable.ts";
import type { QuestContext } from "../../../src/core/quests/types.ts";
import type { RaidSummary } from "../../../src/core/raid/types.ts";
import { countInStash } from "../../../src/core/trade/trade.ts";
import { catalog } from "../../../src/data/items.ts";
import { MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { TRADERS } from "../../../src/data/traders.ts";

const BASE: QuestContext = { quests: [], traders: TRADERS, maps: MAPS };

const SUMMARY: RaidSummary = {
  outcome: "extracted",
  map: "outskirts",
  strategy: "balanced",
  minutes: 20,
  kills: { scav: 100, pmc: 0 },
  loot: [],
  lootValue: 0,
  lost: [],
  xp: 0,
  skillXp: {},
  karma: 0,
  extract: "x",
  killedBy: null,
};

const player = (seed = 42) => {
  const p = createNewPlayer(new ManualClock());
  p.repeatable = createRepeatableState(seed);
  return p;
};

const tweak = (values: Partial<typeof CORE_DEFAULTS.repeatable>) => {
  const b = structuredClone(coreBalance());
  Object.assign(b.repeatable, values);
  setCoreBalance(b);
};

afterEach(() => {
  resetCoreBalance();
});

describe("quests repetíveis", () => {
  it("uma por vendedor, sempre igual para a mesma seed", () => {
    const a = ensureRepeatables(player(), BASE);
    const b = ensureRepeatables(player(), BASE);
    expect(a.map((o) => o.trader)).toEqual(TRADERS.map((t) => t.id));
    expect(a).toEqual(b);
    expect(a.map((o) => o.id)).toEqual(
      TRADERS.map((_, i) => `repeat-${i + 1}`),
    );
    const r = CORE_DEFAULTS.repeatable;
    for (const o of a) {
      expect(o.xp).toBe(o.objective.count * r.xpPerUnit);
      if (o.objective.kind === "kill") {
        expect(o.objective.count).toBeGreaterThanOrEqual(r.killMin);
        expect(o.objective.count).toBeLessThanOrEqual(r.killMax);
        expect(o.money).toBe(o.objective.count * r.moneyPerKill);
      } else {
        expect(["barter", "food", "medical"]).toContain(
          catalog.get(o.objective.item).category,
        );
        expect(o.objective.count).toBeLessThanOrEqual(r.findMax);
      }
    }
    // Já existindo, não sorteia de novo
    const p = player();
    const first = ensureRepeatables(p, BASE);
    const seed = p.repeatable.seed;
    expect(ensureRepeatables(p, BASE)).toEqual(first);
    expect(p.repeatable.seed).toBe(seed);
  });

  it("sorteia os dois tipos; itens só do loot dos mapas e das categorias com peso", () => {
    const kinds = new Set<string>();
    for (let s = 0; s < 30; s++) {
      for (const o of ensureRepeatables(player(s), BASE)) {
        kinds.add(o.objective.kind);
      }
    }
    expect(kinds).toEqual(new Set(["kill", "find"]));
    tweak({ killWeight: 0, barterWeight: 0, foodWeight: 0 });
    for (const o of ensureRepeatables(player(), BASE)) {
      expect(o.objective.kind).toBe("find");
      if (o.objective.kind === "find") {
        expect(catalog.get(o.objective.item).category).toBe("medical");
        expect(o.money).toBe(
          Math.round(
            catalog.get(o.objective.item).basePrice *
              o.objective.count *
              CORE_DEFAULTS.repeatable.findValueFactor,
          ),
        );
      }
    }
  });

  it("sem item possível ou sem peso, vira caçada; faixas inválidas são corrigidas", () => {
    tweak({ findWeight: 0 });
    expect(
      ensureRepeatables(player(), BASE).every(
        (o) => o.objective.kind === "kill",
      ),
    ).toBe(true);
    tweak({ killWeight: 0, barterWeight: 0, foodWeight: 0, medicalWeight: 0 });
    expect(
      ensureRepeatables(player(), BASE).every(
        (o) => o.objective.kind === "kill",
      ),
    ).toBe(true);
    tweak({ killWeight: 0, findWeight: 0, killMin: 0.2, killMax: 0 });
    expect(
      ensureRepeatables(player(), BASE).map((o) => o.objective.count),
    ).toEqual(TRADERS.map(() => 1));
    // Mapa com item fora do catálogo: ignorado
    const odd = {
      ...BASE,
      maps: [{ ...MAPS[0], loot: [{ item: "sumiu", weight: 1 }] }],
    };
    tweak({ killWeight: 1, findWeight: 1 });
    expect(
      ensureRepeatables(player(), odd).every(
        (o) => o.objective.kind === "kill",
      ),
    ).toBe(true);
  });

  it("descarta ofertas de vendedores que saíram do jogo", () => {
    const p = player();
    ensureRepeatables(p, BASE);
    const offers = ensureRepeatables(p, { ...BASE, traders: [TRADERS[1]] });
    expect(offers.map((o) => o.trader)).toEqual([TRADERS[1].id]);
  });

  it("QuestDef da oferta: textos, recompensas e a mesma instância", () => {
    const kill = repeatableDef(
      {
        id: "repeat-1",
        trader: "colonel",
        objective: { kind: "kill", target: "scav", count: 4 },
        money: 20000,
        xp: 600,
        reputation: 0.02,
      },
      catalog,
    );
    expect(kill).toMatchObject({
      id: "repeat-1",
      name: "Caçada: 4 Scavs",
      repeatable: true,
      requires: {},
      rewards: {
        xp: 600,
        items: [{ item: "money_rub", count: 20000 }],
        reputation: [{ trader: "colonel", amount: 0.02 }],
      },
    });
    const offer = {
      id: "repeat-2",
      trader: "doctor",
      objective: { kind: "find" as const, item: "med_kit", count: 2 },
      money: 1,
      xp: 1,
      reputation: 0,
    };
    const find = repeatableDef(offer, catalog);
    expect(find.name).toBe(`Encomenda: ${catalog.get("med_kit").name}`);
    expect(find.description).toContain(catalog.get("med_kit").name);
    expect(repeatableDef(offer, catalog)).toBe(find);
  });

  it("aceitar, avançar com a raid, concluir: recompensa e outra é gerada", () => {
    const p = player();
    const ctx = withRepeatables(p, BASE);
    expect(ctx.traders).toBe(TRADERS);
    expect(ctx.maps).toBe(MAPS);
    const def = ctx.quests[0];
    expect(ctx.quests[0]).toBe(def);
    expect(ctx.quests).toHaveLength(TRADERS.length);
    expect(acceptQuest(p, ctx, def.id, 0).ok).toBe(true);
    const objective = def.objectives[0];
    const summary: RaidSummary =
      objective.kind === "find"
        ? {
            ...SUMMARY,
            loot: [{ def: objective.item, name: "", count: 99 }],
          }
        : SUMMARY;
    expect(progressAfterRaid(p, ctx, summary)).toContain(def);
    expect(questStatus(p, ctx, def, 0)).toBe("ready");
    const money = countInStash(p.inventory.stash, "money_rub");
    expect(completeQuest(p, ctx, def.id, 0).ok).toBe(true);
    expect(countInStash(p.inventory.stash, "money_rub")).toBe(
      money + def.rewards.items![0].count,
    );
    expect(p.pmc.xp).toBe(def.rewards.xp);
    expect(p.quests[def.id]).toBeUndefined();
    const ids = ctx.quests.map((q) => q.id);
    expect(ids).not.toContain(def.id);
    expect(ids).toContain(`repeat-${TRADERS.length + 1}`);
    expect(ctx.quests.filter((q) => q.trader === def.trader)).toHaveLength(1);
  });
});
