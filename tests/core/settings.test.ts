import { describe, expect, it } from "vitest";

import {
  defaultSettings,
  loadSettings,
  saveSettings,
} from "../../src/core/settings.ts";

function memory(text: string | null = null) {
  let data = text;
  return {
    read: () => data,
    write: (value: string) => {
      data = value;
    },
    clear: () => {
      data = null;
    },
  };
}

describe("configurações", () => {
  it("padrão sem nada salvo, com JSON ilegível ou nulo", () => {
    expect(loadSettings(memory())).toEqual(defaultSettings());
    expect(loadSettings(memory("{x"))).toEqual(defaultSettings());
    expect(loadSettings(memory("null"))).toEqual(defaultSettings());
  });

  it("guarda e lê de volta", () => {
    const storage = memory();
    const settings = {
      volume: 0.25,
      tooltipDelayMs: 600,
      raidSpeed: 16,
      animations: false,
      tutorialStep: 3,
    };
    saveSettings(storage, settings);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it("valores inválidos voltam ao padrão", () => {
    const storage = memory(
      JSON.stringify({
        volume: 0.3,
        tooltipDelayMs: "300",
        raidSpeed: 2,
        animations: "não",
        tutorialStep: -1,
      }),
    );
    expect(loadSettings(storage)).toEqual(defaultSettings());
    expect(
      loadSettings(memory(JSON.stringify({ tutorialStep: 1.5 }))).tutorialStep,
    ).toBe(0);
  });
});
