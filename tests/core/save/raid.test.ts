import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { startRaid } from "../../../src/core/raid/profile.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import type { SaveData } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { loadGame, saveGame } from "../../../src/core/save/storage.ts";
import type { SaveStorage } from "../../../src/core/save/storage.ts";
import { catalog } from "../../../src/data/items.ts";
import { ENEMIES, MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const memory = (): SaveStorage & { data: string | null } => {
  const store = {
    data: null as string | null,
    read: () => store.data,
    write: (d: string) => {
      store.data = d;
    },
    clear: () => {
      store.data = null;
    },
  };
  return store;
};

/** Save no formato da versão 1 (sem o perfil de raid) */
function v1Save(clock: ManualClock): Record<string, unknown> {
  const data = serializeGame(createNewPlayer(clock), 777) as Partial<SaveData>;
  delete data.raid;
  return { ...data, version: 1 };
}

describe("save v2: perfil de raid", () => {
  it("SAVE_VERSION é pelo menos 2", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(2);
  });

  it("migração 1 → 2 cria o perfil com a seed do savedAt", () => {
    const migrated = migrate(v1Save(new ManualClock()));
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.raid).toMatchObject({ karma: 0, seed: 777, active: null });
    expect(MIGRATIONS[1]({ version: 1 }).raid).toMatchObject({ seed: 0 });
  });

  it("save v1 no armazenamento carrega com o perfil novo", () => {
    const clock = new ManualClock();
    const storage = memory();
    storage.write(JSON.stringify(v1Save(clock)));
    const loaded = loadGame(storage, catalog, clock)!;
    expect(loaded.warnings).toEqual([]);
    expect(loaded.state.raid.stats.raids).toBe(0);
    expect(loaded.state.raid.seed).toBe(777);
  });

  it("ida e volta preserva karma, estatísticas e a raid em andamento", () => {
    const clock = new ManualClock(1000);
    const player = createNewPlayer(clock);
    player.raid.lootRule = "keepFirst";
    startRaid(player, MAPS[0], "balanced", ENEMIES, clock);
    const storage = memory();
    saveGame(player, storage, clock);
    const loaded = loadGame(storage, catalog, clock)!.state;
    expect(loaded.raid).toEqual(player.raid);
    expect(loaded.raid).not.toBe(player.raid);
    expect(loaded.raid.active?.events.length).toBeGreaterThan(1);
  });

  it("campos que faltam ou inválidos voltam ao padrão", () => {
    const clock = new ManualClock(55);
    const data = serializeGame(createNewPlayer(clock), 0);
    const partial = {
      ...data,
      raid: {
        karma: -2,
        stats: { raids: 3, kills: { pmc: 1 } },
        lootRule: "inventada",
        seed: 9,
      },
    } as unknown as SaveData;
    const { state } = deserializeGame(partial, catalog, clock);
    expect(state.raid).toEqual({
      karma: -2,
      stats: {
        raids: 3,
        extracted: 0,
        killed: 0,
        mia: 0,
        kills: { scav: 0, pmc: 1 },
      },
      lootRule: "valuePerCell",
      seed: 9,
      active: null,
    });
    const noStats = { ...data, raid: { karma: 1 } } as unknown as SaveData;
    expect(
      deserializeGame(noStats, catalog, clock).state.raid.stats.raids,
    ).toBe(0);
    const none = { ...data, raid: undefined };
    expect(deserializeGame(none, catalog, clock).state.raid.seed).toBe(55);
  });
});
