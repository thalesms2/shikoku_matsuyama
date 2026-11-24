import { describe, expect, it } from "vitest";

import type { QuestDef } from "../../src/core/quests/types.ts";
import { catalog } from "../../src/data/items.ts";
import { MAPS, mapById } from "../../src/data/maps.ts";
import { QUESTS } from "../../src/data/quests.ts";
import { TRADERS, traderById } from "../../src/data/traders.ts";

const byId = new Map(QUESTS.map((q) => [q.id, q]));

describe("quests", () => {
  it("ids únicos e vendedores existentes", () => {
    expect(byId.size).toBe(QUESTS.length);
    for (const quest of QUESTS) expect(traderById(quest.trader)).not.toBeNull();
  });

  it.each(QUESTS.map((q) => [q.id, q] as const))(
    "%s: objetivos, requisitos e recompensas válidos",
    (_, quest) => {
      expect(quest.objectives.length).toBeGreaterThan(0);
      expect(quest.objectives.length).toBeLessThanOrEqual(3);
      for (const o of quest.objectives) {
        expect(o.count).toBeGreaterThan(0);
        if (o.kind === "deliver" || o.kind === "find") {
          expect(catalog.has(o.item)).toBe(true);
        }
        if (o.kind !== "deliver" && o.map) {
          const map = mapById(o.map);
          expect(map).not.toBeNull();
          if (o.kind === "extract" && o.extract) {
            expect(map!.extracts.some((e) => e.id === o.extract)).toBe(true);
          }
        }
      }
      for (const id of quest.requires.quests ?? []) {
        // requisito vem antes na lista: sem ciclos
        expect(QUESTS.indexOf(byId.get(id)!)).toBeLessThan(
          QUESTS.indexOf(quest),
        );
      }
      const loyalty = quest.requires.loyalty;
      if (loyalty) {
        const trader = traderById(loyalty.trader)!;
        expect(loyalty.level).toBeLessThanOrEqual(trader.levels.length);
      }
      for (const r of quest.rewards.items ?? []) {
        expect(catalog.has(r.item)).toBe(true);
      }
      for (const r of quest.rewards.reputation ?? []) {
        expect(traderById(r.trader)).not.toBeNull();
      }
    },
  );

  it("cadeia principal: uma linha só, começando livre e terminando na final", () => {
    const main = QUESTS.filter((q) => q.main);
    const finals = QUESTS.filter((q) => q.final);
    expect(finals).toHaveLength(1);
    expect(finals[0].main).toBe(true);
    let current: QuestDef | undefined = main.find(
      (q) => (q.requires.quests ?? []).length === 0,
    );
    const chain: QuestDef[] = [];
    while (current) {
      chain.push(current);
      const id: string = current.id;
      current = main.find((q) => q.requires.quests?.includes(id));
    }
    expect(chain).toEqual(main);
    expect(chain.at(-1)).toBe(finals[0]);
  });

  it("a fuga sai pelo barco do Porto Velho", () => {
    const final = QUESTS.find((q) => q.final)!;
    expect(final.objectives).toContainEqual(
      expect.objectContaining({ map: "harbor", extract: "smuggler-boat" }),
    );
    expect(MAPS.some((m) => m.id === "harbor")).toBe(true);
  });

  it("ofertas presas a quests apontam para quests que existem", () => {
    const linked = TRADERS.flatMap((t) => t.offers.filter((o) => o.quest));
    expect(linked.length).toBeGreaterThan(0);
    for (const offer of linked) expect(byId.has(offer.quest!)).toBe(true);
  });
});
