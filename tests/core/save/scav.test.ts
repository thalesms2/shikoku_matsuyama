import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createScavProfile } from "../../../src/core/raid/profile.ts";
import { startScavRaid } from "../../../src/core/raid/scav.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import type { SaveData } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { ENEMIES, MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { SCAV_LOADOUT } from "../../../src/data/scav.ts";

/** Save no formato da versão 2 (sem o perfil Scav) */
function v2Save(clock: ManualClock): Record<string, unknown> {
  const data = serializeGame(createNewPlayer(clock), 5) as Partial<SaveData>;
  delete data.scav;
  return { ...data, version: 2 };
}

const load = (data: unknown, clock = new ManualClock()) =>
  deserializeGame(migrate(data), catalog, clock).state;

describe("save v3: raid Scav", () => {
  it("SAVE_VERSION é pelo menos 3 e há migração para cada versão", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(3);
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v]).toBeTypeOf("function");
    }
  });

  it("migração 2 → 3 libera a raid Scav", () => {
    const migrated = migrate(v2Save(new ManualClock()));
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.scav).toEqual(createScavProfile());
    expect(MIGRATIONS[2]({ version: 2 }).scav).toEqual(createScavProfile());
  });

  it("cooldown, estatísticas e raid Scav em andamento voltam iguais", () => {
    const clock = new ManualClock(1000);
    const player = createNewPlayer(clock);
    startScavRaid(player, MAPS[0], "stealth", ENEMIES, SCAV_LOADOUT, clock);
    const state = load(serializeGame(player, 2000));
    expect(state.scav).toEqual(player.scav);
    expect(state.scav).not.toBe(player.scav);
    expect(state.raid.active?.summary.scav).toEqual(
      player.raid.active?.summary.scav,
    );
  });

  it("perfil sem campos ou inválido volta ao padrão", () => {
    const clock = new ManualClock();
    const data = serializeGame(createNewPlayer(clock), 1) as SaveData;
    expect(load({ ...data, scav: undefined }).scav).toEqual(
      createScavProfile(),
    );
    const partial = load({
      ...data,
      scav: { readyAt: "x", stats: { raids: 4, kills: { pmc: 1 } } },
    }).scav;
    expect(partial).toEqual({
      readyAt: 0,
      stats: {
        raids: 4,
        extracted: 0,
        killed: 0,
        mia: 0,
        kills: { scav: 0, pmc: 1 },
      },
    });
    expect(load({ ...data, scav: { readyAt: 99 } }).scav).toEqual({
      ...createScavProfile(),
      readyAt: 99,
    });
  });
});
