import { describe, expect, it } from "vitest";

import {
  attachMagazine,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import {
  MAX_LOADOUT_NAME,
  loadMagazines,
  renameLoadout,
  saveLoadout,
} from "../../../src/core/loadout/loadout.ts";
import type { Loadout } from "../../../src/core/loadout/types.ts";
import { trader } from "../trade/tradeFixtures.ts";

describe("renameLoadout", () => {
  it("valida o nome e troca nas raids automáticas", () => {
    const { player } = trader();
    saveLoadout(player, "A");
    saveLoadout(player, "B");
    player.auto.rules.loadout = "A";
    expect(renameLoadout(player, 5, "X")).toEqual({
      ok: false,
      reason: "Loadout não existe",
    });
    expect(renameLoadout(player, 0, "   ")).toEqual({
      ok: false,
      reason: "O nome não pode ficar vazio",
    });
    expect(renameLoadout(player, 0, "x".repeat(MAX_LOADOUT_NAME + 1))).toEqual({
      ok: false,
      reason: `Nome muito longo (máx. ${MAX_LOADOUT_NAME} letras)`,
    });
    expect(renameLoadout(player, 0, "B")).toEqual({
      ok: false,
      reason: "Já existe um loadout com esse nome",
    });
    expect(renameLoadout(player, 0, "  Porto  ")).toEqual({ ok: true });
    expect(player.loadouts[0].name).toBe("Porto");
    expect(player.auto.rules.loadout).toBe("Porto");
    // o mesmo nome dele mesmo vale; outro loadout não mexe na regra
    expect(renameLoadout(player, 0, "Porto")).toEqual({ ok: true });
    expect(renameLoadout(player, 1, "C")).toEqual({ ok: true });
    expect(player.auto.rules.loadout).toBe("Porto");
  });
});

describe("loadMagazines", () => {
  it("carrega a arma vestida (câmara e carregador) e os carregadores levados", () => {
    const { player, factory, put } = trader();
    const { equipment } = player.inventory;
    const pistol = factory.create("pistol_pk9");
    attachMagazine(pistol, factory.create("mag_pk9"));
    equipment.equip("holster", pistol);
    equipment.equip("rig", factory.create("rig_cargo"));
    const spare = factory.create("mag_pk9");
    equipment.carryGrids()[0].place(spare, 0, 0);
    put("ammo_545", 30);
    const ammo = put("ammo_9mm", 30);
    expect(loadMagazines(player)).toBe(25);
    expect(pistol.chamber?.id).toBe("ammo_9mm");
    expect(loadedRounds(pistol.magazine!)).toBe(12);
    expect(loadedRounds(spare)).toBe(12);
    expect(ammo.count).toBe(5);
    // tudo cheio: nada mais entra
    expect(loadMagazines(player)).toBe(0);
  });

  it("usa primeiro a munição da carga do loadout, depois as pilhas maiores", () => {
    const { player, factory, put } = trader();
    const rifle = factory.create("rifle_vk74");
    attachMagazine(rifle, factory.create("mag_vk74"));
    player.inventory.equipment.equip("primary", rifle);
    const fmj = put("ammo_545", 50);
    const ap = put("ammo_545ap", 40);
    const loadout: Loadout = {
      name: "L",
      slots: {},
      magazines: {},
      carried: [{ item: "ammo_545ap", count: 10 }],
    };
    expect(loadMagazines(player, loadout)).toBe(31);
    expect(rifle.chamber?.id).toBe("ammo_545ap");
    expect(ap.count).toBe(9);
    expect(fmj.count).toBe(50);
    // sem loadout: a maior pilha primeiro
    const other = trader();
    const r2 = other.factory.create("rifle_vk74");
    attachMagazine(r2, other.factory.create("mag_vk74"));
    other.player.inventory.equipment.equip("primary", r2);
    const a = other.put("ammo_545", 5);
    const b = other.put("ammo_545ap", 40);
    expect(loadMagazines(other.player)).toBe(31);
    expect(r2.chamber?.id).toBe("ammo_545ap");
    expect(a.count).toBe(5);
    expect(b.count).toBe(9);
  });

  it("sem munição no estoque, não carrega nada", () => {
    const { player, factory } = trader();
    player.inventory.equipment.equip("holster", factory.create("pistol_pk9"));
    expect(loadMagazines(player)).toBe(0);
  });
});
