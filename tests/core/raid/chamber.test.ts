import { describe, expect, it } from "vitest";

import {
  loadRounds,
  loadedRounds,
  weaponRounds,
} from "../../../src/core/inventory/magazine.ts";
import {
  TEST_ENEMIES,
  armedPlayer,
  emptyPlayer,
  give,
  makeSim,
} from "./raidFixtures.ts";

/** PMC com a escopeta (tubo de 6) no primário e colete tático */
function shotgunPlayer(shells = 0) {
  const player = emptyPlayer();
  const { factory } = player;
  const { equipment } = player.inventory;
  const shotgun = factory.create("shotgun_m12");
  if (shells > 0) loadRounds(shotgun, factory.create("ammo_12g", shells));
  equipment.equip("primary", shotgun);
  equipment.equip("rig", factory.create("rig_cargo"));
  return { player, shotgun };
}

describe("raid: câmara e escopeta", () => {
  it("entra na raid com um cartucho na câmara", () => {
    const { player, pistol } = armedPlayer();
    const { sim } = makeSim(player);
    const before = weaponRounds(pistol);
    sim.run();
    expect(pistol.chamber?.id).toBe("ammo_9mm");
    expect(loadedRounds(pistol.magazine!)).toBe(11);
    expect(weaponRounds(pistol)).toBe(before);
  });

  it("dispara pela câmara: um cartucho por troca com calibre 12", () => {
    const { player, shotgun } = shotgunPlayer(6);
    const { sim, rng } = makeSim(player);
    rng.defaultChance = true;
    expect(sim.playerTurn(TEST_ENEMIES.scav, 0)).toBe(200);
    expect(weaponRounds(shotgun)).toBe(5);
    expect(shotgun.chamber?.id).toBe("ammo_12g");
    expect(loadedRounds(shotgun)).toBe(4);
  });

  it("sem munição na escopeta, enche o tubo com cartuchos soltos e gasta o turno", () => {
    const { player, shotgun } = shotgunPlayer();
    const ammo = give(player, "ammo_12g", 10);
    const { sim } = makeSim(player);
    expect(sim.playerTurn(TEST_ENEMIES.scav, 0)).toBe(0);
    expect(sim.events.map((e) => e.text)).toEqual([
      "Recarregou 6 cartuchos em M-12",
    ]);
    expect(loadedRounds(shotgun)).toBe(5);
    expect(shotgun.chamber?.id).toBe("ammo_12g");
    expect(ammo.count).toBe(4);
    expect(player.skills.magDrills).toBe(3);
  });

  it("sem cartuchos soltos, a escopeta não recarrega e o PMC tenta fugir", () => {
    const { player } = shotgunPlayer();
    const pistol = player.factory.create("pistol_pk9");
    player.inventory.equipment.equip("holster", pistol);
    const { sim } = makeSim(player);
    expect(sim.reloadTube()).toBe(false);
    expect(sim.playerTurn(TEST_ENEMIES.scav, 0)).toBe(0);
    expect(sim.events.map((e) => e.text)).toEqual([
      "Sem munição, tentou fugir e não conseguiu",
    ]);
  });

  it("fora de combate, completa o tubo com a munição solta", () => {
    const { player, shotgun } = shotgunPlayer(2);
    give(player, "ammo_12g", 10);
    const { sim } = makeSim(player);
    sim.topUpMagazines();
    expect(loadedRounds(shotgun)).toBe(6);
    expect(sim.events.map((e) => e.text)).toEqual(["Recarregou 4 cartuchos"]);
  });

  it("arma sem carregador não atrapalha o completar", () => {
    const player = emptyPlayer();
    player.inventory.equipment.equip(
      "holster",
      player.factory.create("pistol_pk9"),
    );
    const { sim } = makeSim(player);
    sim.topUpMagazines();
    expect(sim.events).toEqual([]);
  });
});
