import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import {
  loadRounds,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import type { SaveData } from "../../../src/core/save/format.ts";
import { MIGRATIONS, migrate } from "../../../src/core/save/migrations.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

/** Novo jogo com a escopeta no primário (com `chamber` e cartuchos no tubo) */
function saved(chamber: unknown, slot = "primary"): SaveData {
  const player = createNewPlayer(new ManualClock());
  const { factory } = player;
  const shotgun = factory.create("shotgun_m12");
  loadRounds(shotgun, factory.create("ammo_12g", 3));
  player.inventory.equipment.unequip("primary");
  player.inventory.equipment.equip("primary", shotgun);
  const data = JSON.parse(JSON.stringify(serializeGame(player, 1)));
  const item = data.equipment.slots[slot] as Record<string, unknown>;
  item.chamber = chamber;
  return data;
}

const load = (data: SaveData) =>
  deserializeGame(migrate(data), catalog, new ManualClock(1));

describe("save v12: câmara e tubo", () => {
  it("SAVE_VERSION é pelo menos 12 e a migração 11 → 12 não muda nada", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(12);
    const data = { version: 11 };
    expect(MIGRATIONS[11](data)).toBe(data);
  });

  it("o tubo e a câmara voltam do save", () => {
    const player = createNewPlayer(new ManualClock());
    const { factory } = player;
    const shotgun = factory.create("shotgun_m12");
    loadRounds(shotgun, factory.create("ammo_12g", 3));
    shotgun.chamber = catalog.get("ammo_12g");
    player.inventory.equipment.unequip("primary");
    player.inventory.equipment.equip("primary", shotgun);
    const data = serializeGame(player, 1);
    expect(data.equipment.slots.primary?.chamber).toBe("ammo_12g");
    const { state, warnings } = load(JSON.parse(JSON.stringify(data)));
    const back = state.inventory.equipment.get("primary") as Item;
    expect(loadedRounds(back)).toBe(3);
    expect(back.chamber).toBe(catalog.get("ammo_12g"));
    expect(warnings).toEqual([]);
  });

  it("câmara inválida é descartada (com aviso quando é munição errada)", () => {
    const chamberOf = (data: SaveData, slot = "primary") => {
      const { state, warnings } = load(data);
      const item = state.inventory.equipment.get(slot as "primary") as Item;
      return { chamber: item.chamber, warnings };
    };
    expect(chamberOf(saved(42))).toEqual({ chamber: undefined, warnings: [] });
    expect(chamberOf(saved("sumiu"))).toEqual({
      chamber: undefined,
      warnings: ["Munição removida do jogo: sumiu"],
    });
    const wrong = chamberOf(saved("ammo_9mm"));
    expect(wrong.chamber).toBeUndefined();
    expect(wrong.warnings[0]).toMatch(/^Cartucho incompatível na câmara de /);
    const notAmmo = chamberOf(saved("money_rub"));
    expect(notAmmo.chamber).toBeUndefined();
    // Item que não é arma ignora o campo
    const rig = chamberOf(saved("ammo_12g", "rig"), "rig");
    expect(rig).toEqual({ chamber: undefined, warnings: [] });
  });
});
