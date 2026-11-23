import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import { SaveError, migrate } from "../../../src/core/save/migrations.ts";
import {
  AutoSaver,
  SAVE_KEY,
  browserStorage,
  loadGame,
  saveGame,
} from "../../../src/core/save/storage.ts";
import type { SaveStorage } from "../../../src/core/save/storage.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

function memory(
  initial: string | null = null,
): SaveStorage & { data: string | null } {
  const store = {
    data: initial,
    read: () => store.data,
    write: (d: string) => {
      store.data = d;
    },
    clear: () => {
      store.data = null;
    },
  };
  return store;
}

describe("migrate", () => {
  it("devolve o save da versão atual sem mudar", () => {
    const data = { version: SAVE_VERSION, x: 1 };
    expect(migrate(data)).toBe(data);
  });

  it("aplica as migrações em ordem até a versão atual", () => {
    const migrations = {
      1: (d: Record<string, unknown>) => ({ ...d, a: true }),
      2: (d: Record<string, unknown>) => ({ ...d, b: d.a }),
    };
    expect(migrate({ version: 1 }, migrations, 3)).toEqual({
      version: 3,
      a: true,
      b: true,
    });
  });

  it.each([
    [null, "Save inválido"],
    ["texto", "Save inválido"],
    [{}, "Save sem versão"],
    [{ version: 0 }, "Save sem versão"],
    [{ version: 1.5 }, "Save sem versão"],
    [{ version: "1" }, "Save sem versão"],
    [{ version: SAVE_VERSION + 1 }, "mais nova que a do jogo"],
  ])("rejeita %o", (raw, message) => {
    expect(() => migrate(raw)).toThrow(SaveError);
    expect(() => migrate(raw)).toThrow(message);
  });

  it("falha se faltar uma migração", () => {
    expect(() => migrate({ version: 1 }, {}, 2)).toThrow(
      "Falta a migração da versão 1",
    );
  });
});

describe("browserStorage", () => {
  it("lê, grava e apaga na chave do jogo", () => {
    const ls = {
      getItem: vi.fn(() => "x"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = browserStorage(undefined, ls);
    expect(storage.read()).toBe("x");
    storage.write("y");
    storage.clear();
    expect(ls.getItem).toHaveBeenCalledWith(SAVE_KEY);
    expect(ls.setItem).toHaveBeenCalledWith(SAVE_KEY, "y");
    expect(ls.removeItem).toHaveBeenCalledWith(SAVE_KEY);
  });

  it("erros do navegador não derrubam o jogo", () => {
    const boom = () => {
      throw new Error("bloqueado");
    };
    const storage = browserStorage("k", {
      getItem: boom,
      setItem: boom,
      removeItem: boom,
    });
    expect(storage.read()).toBeNull();
    expect(() => storage.write("x")).not.toThrow();
    expect(() => storage.clear()).not.toThrow();
  });

  it("usa o localStorage global por padrão", () => {
    const set = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: set,
      removeItem: () => {},
    });
    browserStorage().write("z");
    expect(set).toHaveBeenCalledWith(SAVE_KEY, "z");
    vi.unstubAllGlobals();
  });
});

describe("saveGame / loadGame", () => {
  it("grava e lê de volta o estado", () => {
    const clock = new ManualClock(77);
    const state = createNewPlayer(clock);
    state.pmc.energy = 12;
    const storage = memory();
    saveGame(state, storage, clock);
    expect(JSON.parse(storage.data!).savedAt).toBe(77);
    const loaded = loadGame(storage, catalog, clock)!;
    expect(loaded.warnings).toEqual([]);
    expect(loaded.state.pmc.energy).toBe(12);
  });

  it("sem save devolve null; save corrompido ou inválido lança SaveError", () => {
    const clock = new ManualClock();
    expect(loadGame(memory(), catalog, clock)).toBeNull();
    expect(() => loadGame(memory("{oops"), catalog, clock)).toThrow(
      "JSON inválido",
    );
    expect(() => loadGame(memory("{}"), catalog, clock)).toThrow(SaveError);
  });
});

describe("AutoSaver", () => {
  it("salva a cada intervalo", () => {
    const save = vi.fn();
    const auto = new AutoSaver(save, 1000);
    auto.update(600);
    expect(save).not.toHaveBeenCalled();
    auto.update(400);
    expect(save).toHaveBeenCalledOnce();
    auto.update(999);
    expect(save).toHaveBeenCalledOnce();
    auto.update(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(new AutoSaver(save).intervalMs).toBe(5000);
  });
});
