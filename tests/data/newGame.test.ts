import { describe, expect, it } from "vitest";

import { ManualClock } from "../../src/core/clock.ts";
import { MAX_HEALTH } from "../../src/core/pmc/pmc.ts";
import { saveGame } from "../../src/core/save/storage.ts";
import type { SaveStorage } from "../../src/core/save/storage.ts";
import { createNewPlayer, loadOrCreatePlayer } from "../../src/data/newGame.ts";

function memory(data: string | null = null) {
  const store: SaveStorage & { data: string | null } = {
    data,
    read: () => store.data,
    write: (d) => {
      store.data = d;
    },
    clear: () => {
      store.data = null;
    },
  };
  return store;
}

describe("createNewPlayer", () => {
  it("kit inicial, PMC nível 1, skills zeradas e nada carregando", () => {
    const player = createNewPlayer(new ManualClock());
    expect(player.inventory.equipment.get("backpack")).not.toBeNull();
    expect(player.pmc.health).toEqual(MAX_HEALTH);
    expect(player.pmc.xp).toBe(0);
    expect(Object.values(player.skills).every((xp) => xp === 0)).toBe(true);
    expect(player.loader.job).toBeNull();
  });
});

describe("loadOrCreatePlayer", () => {
  it("sem save começa um jogo novo", () => {
    const result = loadOrCreatePlayer(memory(), memory(), new ManualClock());
    expect(result.error).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.player.inventory.stash.items().length).toBeGreaterThan(0);
  });

  it("carrega o save existente", () => {
    const clock = new ManualClock();
    const storage = memory();
    const player = createNewPlayer(clock);
    player.pmc.name = "Salvo";
    saveGame(player, storage, clock);
    const result = loadOrCreatePlayer(storage, memory(), clock);
    expect(result.error).toBeNull();
    expect(result.player.pmc.name).toBe("Salvo");
  });

  it("save ilegível vai para o backup e começa um jogo novo", () => {
    const backup = memory();
    const result = loadOrCreatePlayer(
      memory("{quebrado"),
      backup,
      new ManualClock(),
    );
    expect(result.error).toContain("JSON inválido");
    expect(backup.data).toBe("{quebrado");
    expect(result.player.pmc.name).toBe("PMC");
  });

  it("erros inesperados ao montar o estado também caem no backup", () => {
    const clock = new ManualClock();
    const storage = memory();
    saveGame(createNewPlayer(clock), storage, clock);
    const data = JSON.parse(storage.data!);
    data.stash.width = 0;
    storage.data = JSON.stringify(data);
    const backup = memory();
    const result = loadOrCreatePlayer(storage, backup, clock);
    expect(result.error).toContain("1x1");
    expect(backup.data).toBe(storage.data);
  });
});
