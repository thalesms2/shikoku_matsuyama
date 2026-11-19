import { describe, expect, it, vi } from "vitest";

import {
  ManualClock,
  formatDuration,
  remaining,
  systemClock,
} from "../../src/core/clock.ts";

describe("systemClock", () => {
  it("usa Date.now", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    expect(systemClock.now()).toBe(1234);
  });
});

describe("ManualClock", () => {
  it("começa em 0 por padrão ou no valor dado", () => {
    expect(new ManualClock().now()).toBe(0);
    expect(new ManualClock(500).now()).toBe(500);
  });

  it("avança e pode ser definido", () => {
    const clock = new ManualClock(100);
    clock.advance(50);
    expect(clock.now()).toBe(150);
    clock.set(10);
    expect(clock.now()).toBe(10);
  });

  it("não volta no tempo", () => {
    expect(() => new ManualClock().advance(-1)).toThrow(RangeError);
  });
});

describe("remaining", () => {
  it("devolve o tempo restante, nunca negativo", () => {
    const clock = new ManualClock(1000);
    expect(remaining(clock, 1500)).toBe(500);
    expect(remaining(clock, 900)).toBe(0);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [-5000, "0s"],
    [999, "1s"],
    [9_000, "9s"],
    [125_000, "2m 05s"],
    [3_723_000, "1h 02m 03s"],
  ])("%i ms -> %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
