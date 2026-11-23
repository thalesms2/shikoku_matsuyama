import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import {
  MS_PER_ROUND,
  MagazineLoader,
} from "../../../src/core/inventory/loading.ts";
import {
  loadRounds,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import { magSetup } from "./magFixtures.ts";

function setup() {
  const { make, factory } = magSetup();
  const clock = new ManualClock(0);
  const loader = new MagazineLoader(clock);
  return { make, factory, clock, loader };
}

describe("MagazineLoader", () => {
  it("meio segundo por cartucho por padrão e rejeita tempo inválido", () => {
    expect(MS_PER_ROUND).toBe(500);
    expect(() => new MagazineLoader(new ManualClock(), 0)).toThrow(RangeError);
  });

  it("sem trabalho não faz nada", () => {
    const { loader, make } = setup();
    expect(loader.job).toBeNull();
    expect(loader.progress()).toBeNull();
    expect(loader.advance()).toBe(0);
    expect(loader.isBusy(make("mag"))).toBe(false);
  });

  it("carrega um cartucho a cada intervalo, conforme o relógio", () => {
    const { loader, make, clock } = setup();
    const mag = make("mag");
    const ammo = make("fmj", 10);
    loader.start({ kind: "load", magazine: mag, ammo });
    expect(loader.isBusy(mag)).toBe(true);
    expect(loader.progress()).toEqual({ done: 0, total: 10 });
    clock.advance(499);
    expect(loader.advance()).toBe(0);
    clock.advance(1);
    expect(loader.advance()).toBe(1);
    clock.advance(1500);
    expect(loader.advance()).toBe(3);
    expect(loadedRounds(mag)).toBe(4);
    expect(ammo.count).toBe(6);
    expect(loader.progress()).toEqual({ done: 4, total: 10 });
  });

  it("recupera o atraso de uma vez (progresso idle) e termina sozinho", () => {
    const { loader, make, clock } = setup();
    const mag = make("mag");
    const ammo = make("fmj", 50);
    loader.start({ kind: "load", magazine: mag, ammo });
    clock.advance(60_000);
    expect(loader.advance()).toBe(30);
    expect(loadedRounds(mag)).toBe(30);
    expect(ammo.count).toBe(20);
    expect(loader.job).toBeNull();
  });

  it("termina quando a pilha de munição acaba", () => {
    const { loader, make, clock } = setup();
    const mag = make("mag");
    loader.start({ kind: "load", magazine: mag, ammo: make("fmj", 2) });
    clock.advance(5000);
    expect(loader.advance()).toBe(2);
    expect(loader.job).toBeNull();
  });

  it("termina se a munição foi gasta em outro lugar", () => {
    const { loader, make, clock } = setup();
    const mag = make("mag");
    const ammo = make("fmj", 5);
    loader.start({ kind: "load", magazine: mag, ammo });
    loadRounds(make("mag"), ammo);
    clock.advance(1000);
    expect(loader.advance()).toBe(0);
    expect(loader.job).toBeNull();
  });

  it("descarrega para as grades um cartucho por vez", () => {
    const { loader, make, factory, clock } = setup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 3));
    const grid = new Grid(2, 2);
    loader.start({
      kind: "unload",
      magazine: mag,
      factory,
      grids: () => [grid],
    });
    expect(loader.progress()).toEqual({ done: 0, total: 3 });
    clock.advance(1000);
    expect(loader.advance()).toBe(2);
    expect(grid.items()[0].count).toBe(2);
    clock.advance(1000);
    expect(loader.advance()).toBe(1);
    expect(loader.job).toBeNull();
  });

  it("para de descarregar quando não há espaço", () => {
    const { loader, make, factory, clock } = setup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 3));
    const grid = new Grid(1, 1);
    grid.place(make("rock"), 0, 0);
    loader.start({
      kind: "unload",
      magazine: mag,
      factory,
      grids: () => [grid],
    });
    clock.advance(5000);
    expect(loader.advance()).toBe(0);
    expect(loader.job).toBeNull();
    expect(loadedRounds(mag)).toBe(3);
  });

  it("start substitui o trabalho anterior e cancel para tudo", () => {
    const { loader, make } = setup();
    const a = make("mag");
    const b = make("mag");
    loader.start({ kind: "load", magazine: a, ammo: make("fmj", 5) });
    loader.start({ kind: "load", magazine: b, ammo: make("fmj", 5) });
    expect(loader.isBusy(a)).toBe(false);
    expect(loader.isBusy(b)).toBe(true);
    loader.cancel();
    expect(loader.job).toBeNull();
  });

  it("velocidade configurável (skill de manuseio de carregador)", () => {
    const { make, clock } = setup();
    const loader = new MagazineLoader(clock, 250);
    const mag = make("mag");
    loader.start({ kind: "load", magazine: mag, ammo: make("fmj", 10) });
    clock.advance(1000);
    expect(loader.advance()).toBe(4);
    loader.msPerRound = 100;
    expect(loader.msPerRound).toBe(100);
  });
});
