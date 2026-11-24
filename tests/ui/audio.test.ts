import { beforeEach, describe, expect, it, vi } from "vitest";

const lib = vi.hoisted(() => ({
  fail: false,
  exists: vi.fn(() => true),
  play: vi.fn(),
}));

vi.mock("@pixi/sound", () => ({
  get sound() {
    if (lib.fail) throw new Error("sem módulo");
    return { exists: lib.exists, play: lib.play };
  },
}));

import { getVolume, playSound, setVolume } from "../../src/ui/audio.ts";

describe("efeitos sonoros", () => {
  beforeEach(() => {
    lib.fail = false;
    lib.exists.mockReturnValue(true);
    lib.play.mockReset();
    setVolume(0.5);
  });

  it("toca com o volume das configurações", () => {
    expect(getVolume()).toBe(0.5);
    playSound("sfx-press");
    expect(lib.play).toHaveBeenCalledWith("sfx-press", { volume: 0.5 });
  });

  it("sem volume, sem o som carregado ou sem o módulo, não toca", () => {
    setVolume(0);
    playSound("sfx-press");
    setVolume(1);
    lib.exists.mockReturnValue(false);
    playSound("sfx-press");
    lib.fail = true;
    playSound("sfx-press");
    expect(lib.play).not.toHaveBeenCalled();
  });

  it("erro do navegador ao tocar é ignorado", () => {
    lib.play.mockImplementation(() => {
      throw new Error("áudio bloqueado");
    });
    expect(() => playSound("sfx-press")).not.toThrow();
  });
});
