import { describe, expect, it } from "vitest";

import { fullKnowledge } from "../../../src/core/matrix/plan.ts";
import { canUseExtract, runMatrixRaid } from "../../../src/core/matrix/raid.ts";
import { CONTAINERS } from "../../../src/data/containers.ts";
import { ScriptRng, emptyPlayer, give } from "../raid/raidFixtures.ts";
import { smallMap } from "./matrixFixtures.ts";

const FREE = { id: "exit", name: "Saída", x: 4, y: 1 };

function player() {
  const p = emptyPlayer();
  p.inventory.equipment.equip("rig", p.factory.create("rig_cargo"));
  return p;
}

describe("canUseExtract", () => {
  it("livre, chave, pagamento e sem mochila", () => {
    const p = player();
    const key = {
      ...FREE,
      requirement: { kind: "key" as const, item: "key_garage" },
    };
    const pay = {
      ...FREE,
      requirement: { kind: "payment" as const, item: "money_rub", amount: 100 },
    };
    const bag = { ...FREE, requirement: { kind: "noBackpack" as const } };
    expect(canUseExtract(FREE, p)).toBe(true);
    expect(canUseExtract(key, p)).toBe(false);
    expect(canUseExtract(pay, p)).toBe(false);
    expect(canUseExtract(bag, p)).toBe(true);
    give(p, "key_garage");
    give(p, "money_rub", 150);
    expect(canUseExtract(key, p)).toBe(true);
    expect(canUseExtract(pay, p)).toBe(true);
    p.inventory.equipment.equip("backpack", p.factory.create("backpack_sack"));
    expect(canUseExtract(bag, p)).toBe(false);
  });
});

describe("runMatrixRaid (movimento)", () => {
  it("entra pela esquerda, anda célula por célula e extrai, gastando por turno", () => {
    const map = smallMap([".....", ".....", "....."], [FREE]);
    const p = player();
    const rng = new ScriptRng();
    rng.ints = [1];
    const result = runMatrixRaid({
      player: p,
      map,
      strategy: "neutral",
      rng,
      containers: CONTAINERS,
    });
    expect(result.path[0]).toEqual([0, 1]);
    expect(result.path.at(-1)).toEqual([4, 1]);
    expect(result.turns).toBe(4);
    expect(result.outcome).toBe("extracted");
    expect(result.extract).toBe(FREE);
    expect(result.events.map((e) => e.kind)).toEqual(["start", "extract"]);
    expect(result.events[0].text).toBe("Entrou em Pequeno (Neutro)");
    expect(result.events[1]).toMatchObject({
      turn: 4,
      x: 4,
      y: 1,
      text: "Extraiu por Saída",
    });
    expect(p.pmc.energy).toBeCloseTo(100 - 0.4 * 4);
    expect(p.pmc.hydration).toBeCloseTo(100 - 0.5 * 4);
    expect(p.skills.endurance).toBeCloseTo(1);
  });

  it("visita os alvos (ponto de interesse ou contêiner) e paga a passagem", () => {
    const pois = [
      { id: "shop", name: "Loja", obvious: true, cells: [[1, 0] as const] },
    ];
    const pay = {
      id: "boat",
      name: "Barco",
      x: 2,
      y: 2,
      requirement: { kind: "payment" as const, item: "money_rub", amount: 100 },
    };
    const map = smallMap([".c...", ".....", "...s."], [FREE, pay], pois);
    const p = player();
    const money = give(p, "money_rub", 150);
    const rng = new ScriptRng();
    rng.ints = [1];
    const result = runMatrixRaid({
      player: p,
      map,
      strategy: "psycho",
      rng,
      containers: CONTAINERS,
    });
    const texts = result.events.map((e) => e.text);
    expect(texts).toContain("Chegou em Loja");
    expect(texts).toContain("Chegou a: Cofre");
    expect(result.extract).toBe(pay);
    expect(money.count).toBe(50);
  });

  it("sem extração conhecida, vai para a borda direita e procura", () => {
    const map = smallMap([".....", ".....", "....."], [{ ...FREE, y: 0 }]);
    const p = player();
    const rng = new ScriptRng();
    rng.ints = [2];
    const knowledge = { ...fullKnowledge(map), extracts: new Set<string>() };
    const result = runMatrixRaid({
      player: p,
      map,
      strategy: "neutral",
      rng,
      containers: CONTAINERS,
      knowledge,
    });
    expect(result.events.map((e) => e.kind)).toEqual([
      "start",
      "search",
      "extract",
    ]);
    expect(result.path).toContainEqual([4, 2]);
    expect(result.path.at(-1)).toEqual([4, 0]);
  });

  it("Agressivo vai ao contêiner raro; na busca, a extração mais perto da borda", () => {
    const map = smallMap(
      ["..c..", "...s.", "....."],
      [
        { ...FREE, id: "a", y: 0 },
        { ...FREE, id: "b", y: 2 },
      ],
    );
    const rng = new ScriptRng();
    rng.ints = [2];
    const aggressive = runMatrixRaid({
      player: player(),
      map,
      strategy: "aggressive",
      rng,
      containers: CONTAINERS,
    });
    expect(aggressive.events.map((e) => e.text)).toContain("Chegou a: Cofre");
    expect(aggressive.events.map((e) => e.text)).not.toContain(
      "Chegou a: Caixote",
    );
    const lost = new ScriptRng();
    lost.ints = [2];
    const search = runMatrixRaid({
      player: player(),
      map,
      strategy: "neutral",
      rng: lost,
      containers: CONTAINERS,
      knowledge: { ...fullKnowledge(map), extracts: new Set<string>() },
    });
    expect(search.extract.id).toBe("b");
  });
});

describe("runMatrixRaid: pagamento com duas pilhas", () => {
  it("usa a primeira pilha inteira e não mexe na segunda", () => {
    const pay = {
      id: "boat",
      name: "Barco",
      x: 1,
      y: 1,
      requirement: { kind: "payment" as const, item: "money_rub", amount: 100 },
    };
    const map = smallMap([".....", ".....", "....."], [FREE, pay]);
    const p = player();
    give(p, "key_garage");
    const first = p.factory.create("money_rub", 100);
    const second = p.factory.create("money_rub", 50);
    p.inventory.equipment.pockets[1].place(first, 0, 0);
    p.inventory.equipment.pockets[2].place(second, 0, 0);
    const rng = new ScriptRng();
    rng.ints = [1];
    const result = runMatrixRaid({
      player: p,
      map,
      strategy: "neutral",
      rng,
      containers: CONTAINERS,
    });
    expect(result.extract).toBe(pay);
    expect(first.location).toBeNull();
    expect(second.count).toBe(50);
  });
});
