import { describe, expect, it } from "vitest";

import { Rng } from "../../src/core/rng.ts";

describe("Rng", () => {
  it("gera a mesma sequência para a mesma seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("gera sequências diferentes para seeds diferentes", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("next fica sempre em [0, 1)", () => {
    const rng = new Rng(123);
    for (let i = 0; i < 10_000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it("salva e restaura o estado", () => {
    const rng = new Rng(7);
    rng.next();
    const saved = rng.getState();
    const expected = [rng.next(), rng.next(), rng.next()];
    rng.setState(saved);
    expect([rng.next(), rng.next(), rng.next()]).toEqual(expected);
  });

  it("normaliza seeds negativas e fracionárias para uint32", () => {
    expect(new Rng(-1).getState()).toBe(0xffffffff);
    const rng = new Rng(0);
    rng.setState(-1);
    expect(rng.getState()).toBe(0xffffffff);
  });

  describe("int", () => {
    it("fica dentro do intervalo inclusivo e alcança as pontas", () => {
      const rng = new Rng(99);
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const n = rng.int(1, 6);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(6);
        seen.add(n);
      }
      expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("aceita intervalo de um único valor", () => {
      expect(new Rng(1).int(5, 5)).toBe(5);
    });

    it.each([
      [3, 1],
      [0.5, 2],
      [0, 2.5],
    ])("rejeita intervalo inválido [%s, %s]", (min, max) => {
      expect(() => new Rng(1).int(min, max)).toThrow(RangeError);
    });
  });

  describe("chance", () => {
    it("nunca é verdadeiro com p = 0 e sempre com p = 1", () => {
      const rng = new Rng(5);
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(0)).toBe(false);
        expect(rng.chance(1)).toBe(true);
      }
    });

    it("aproxima a probabilidade pedida", () => {
      const rng = new Rng(2024);
      let hits = 0;
      for (let i = 0; i < 10_000; i++) if (rng.chance(0.3)) hits++;
      expect(hits / 10_000).toBeCloseTo(0.3, 1);
    });
  });

  describe("pick", () => {
    it("devolve um elemento da lista", () => {
      const rng = new Rng(3);
      const items = ["a", "b", "c"];
      for (let i = 0; i < 50; i++) expect(items).toContain(rng.pick(items));
    });

    it("rejeita lista vazia", () => {
      expect(() => new Rng(1).pick([])).toThrow(RangeError);
    });
  });

  describe("weighted", () => {
    it("respeita os pesos e ignora pesos zero ou negativos", () => {
      const rng = new Rng(8);
      const counts = { a: 0, b: 0, zero: 0, neg: 0 };
      const entries = [
        { value: "zero" as const, weight: 0 },
        { value: "a" as const, weight: 1 },
        { value: "neg" as const, weight: -5 },
        { value: "b" as const, weight: 3 },
      ];
      for (let i = 0; i < 8000; i++) counts[rng.weighted(entries)]++;
      expect(counts.zero).toBe(0);
      expect(counts.neg).toBe(0);
      expect(counts.a / 8000).toBeCloseTo(0.25, 1);
      expect(counts.b / 8000).toBeCloseTo(0.75, 1);
    });

    it("com um único peso positivo sempre devolve ele", () => {
      const rng = new Rng(1);
      expect(rng.weighted([{ value: "x", weight: 2 }])).toBe("x");
    });

    it("rejeita listas sem peso positivo", () => {
      const rng = new Rng(1);
      expect(() => rng.weighted([])).toThrow(RangeError);
      expect(() => rng.weighted([{ value: 1, weight: 0 }])).toThrow(RangeError);
    });
  });
});
