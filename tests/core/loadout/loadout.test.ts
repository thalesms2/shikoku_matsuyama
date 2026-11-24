import { describe, expect, it } from "vitest";

import type { SlotName } from "../../../src/core/inventory/equipment.ts";
import { loadRounds } from "../../../src/core/inventory/magazine.ts";
import {
  MAX_LOADOUTS,
  applyLoadout,
  carriedItems,
  deleteLoadout,
  missingItems,
  replaceLoadout,
  requiredItems,
  saveLoadout,
  snapshotLoadout,
} from "../../../src/core/loadout/loadout.ts";
import type { Loadout } from "../../../src/core/loadout/types.ts";
import { trader } from "../trade/tradeFixtures.ts";

function kit(width = 10, height = 10) {
  const t = trader(width, height);
  const { equipment } = t.player.inventory;
  const wear = (slot: SlotName, id: string) => {
    const item = t.factory.create(id);
    equipment.equip(slot, item);
    return item;
  };
  return { ...t, equipment, wear };
}

const loadout = (extra: Partial<Loadout> = {}): Loadout => ({
  name: "L",
  slots: {},
  magazines: {},
  carried: [],
  ...extra,
});

describe("foto do equipamento", () => {
  it("slots, carregador encaixado e itens carregados (com conteúdo)", () => {
    const { player, factory, equipment, wear } = kit();
    const rifle = wear("primary", "rifle_vk74");
    rifle.magazine = null;
    const mag = factory.create("mag_vk74");
    mag.location = { kind: "weapon", weapon: rifle };
    rifle.magazine = mag;
    const rig = wear("rig", "rig_cargo");
    const backpack = wear("backpack", "backpack_sack");
    wear("helmet", "helmet_tk1");
    rig.grids[0].place(factory.create("ammo_545", 30), 0, 0, false);
    equipment.pockets[0].place(factory.create("med_bandage"), 0, 0, false);
    const box = factory.create("ammo_case");
    backpack.grids[0].place(box, 0, 0, false);
    box.grids[0].place(factory.create("ammo_545", 20), 0, 0, false);

    expect(carriedItems(equipment).map((i) => i.def.id)).toEqual([
      "med_bandage",
      "ammo_545",
      "ammo_case",
      "ammo_545",
    ]);
    const snap = snapshotLoadout(player, "Meu");
    expect(snap).toEqual({
      name: "Meu",
      slots: {
        primary: "rifle_vk74",
        helmet: "helmet_tk1",
        rig: "rig_cargo",
        backpack: "backpack_sack",
      },
      magazines: { primary: "mag_vk74" },
      carried: [
        { item: "med_bandage", count: 1 },
        { item: "ammo_545", count: 50 },
        { item: "ammo_case", count: 1 },
      ],
    });
    expect(
      requiredItems({ ...snap, magazines: { holster: "rig_cargo" } }),
    ).toEqual([
      { item: "rifle_vk74", count: 1 },
      { item: "helmet_tk1", count: 1 },
      { item: "rig_cargo", count: 2 },
      { item: "backpack_sack", count: 1 },
      { item: "med_bandage", count: 1 },
      { item: "ammo_545", count: 50 },
      { item: "ammo_case", count: 1 },
    ]);
  });

  it("o que falta conta equipamento, carregadores, carga e estoque", () => {
    const { player, put, factory, wear, equipment } = kit();
    const pistol = wear("holster", "pistol_pk9");
    const mag = factory.create("mag_pk9");
    mag.location = { kind: "weapon", weapon: pistol };
    pistol.magazine = mag;
    equipment.pockets[0].place(factory.create("ammo_9mm", 10), 0, 0, false);
    put("ammo_9mm", 15);
    const want = loadout({
      slots: { holster: "pistol_pk9", helmet: "helmet_tk1" },
      magazines: { holster: "mag_pk9" },
      carried: [
        { item: "ammo_9mm", count: 40 },
        { item: "mag_pk9", count: 1 },
      ],
    });
    expect(missingItems(player, want)).toEqual([
      { item: "helmet_tk1", count: 1 },
      { item: "mag_pk9", count: 1 },
      { item: "ammo_9mm", count: 15 },
    ]);
    // itens presos no carregamento não contam
    const spare = put("mag_pk9");
    const ammo = put("ammo_9mm", 50);
    // a pilha de 15 completou a antiga (50) e sobrou uma de 15
    expect(ammo.count).toBe(15);
    player.loader.start({ kind: "load", magazine: spare, ammo });
    expect(missingItems(player, want)).toEqual([
      { item: "helmet_tk1", count: 1 },
      { item: "mag_pk9", count: 1 },
    ]);
  });
});

describe("applyLoadout", () => {
  it("monta tudo do estoque, com o carregador mais cheio na arma", () => {
    const { player, put, equipment } = kit();
    put("rifle_vk74");
    const empty = put("mag_vk74");
    const full = put("mag_vk74");
    loadRounds(full, put("ammo_545", 30));
    put("rig_cargo");
    put("ammo_545", 60);
    put("med_bandage");
    const want = loadout({
      slots: { primary: "rifle_vk74", rig: "rig_cargo" },
      magazines: { primary: "mag_vk74" },
      carried: [
        { item: "ammo_545", count: 40 },
        { item: "med_bandage", count: 1 },
        { item: "mag_vk74", count: 1 },
      ],
    });
    expect(applyLoadout(player, want)).toEqual({ missing: [], noSpace: [] });
    expect(equipment.get("primary")!.magazine).toBe(full);
    expect(carriedItems(equipment).map((i) => [i.def.id, i.count])).toEqual(
      expect.arrayContaining([
        ["ammo_545", 40],
        ["med_bandage", 1],
        ["mag_vk74", 1],
      ]),
    );
    expect(empty.location?.kind).toBe("grid");
    expect(missingItems(player, want)).toEqual([]);
    // de novo: nada muda
    expect(applyLoadout(player, want)).toEqual({ missing: [], noSpace: [] });
  });

  it("slot igual fica; diferente troca e guarda o antigo no estoque", () => {
    const { player, put, wear, equipment } = kit();
    const helmet = wear("helmet", "helmet_tk1");
    const sack = wear("backpack", "backpack_sack");
    const hiker = put("backpack_hiker");
    const want = loadout({
      slots: { helmet: "helmet_tk1", backpack: "backpack_hiker" },
    });
    expect(applyLoadout(player, want)).toEqual({ missing: [], noSpace: [] });
    expect(equipment.get("helmet")).toBe(helmet);
    expect(equipment.get("backpack")).toBe(hiker);
    expect(sack.location?.kind).toBe("grid");
  });

  it("o antigo não cabe no estoque: tudo volta como estava", () => {
    const { player, put, wear, equipment } = kit(3, 3);
    const hiker = wear("backpack", "backpack_hiker");
    const sack = put("backpack_sack");
    const want = loadout({ slots: { backpack: "backpack_sack" } });
    expect(applyLoadout(player, want)).toEqual({
      missing: [],
      noSpace: [{ item: "backpack_sack", count: 1 }],
    });
    expect(equipment.get("backpack")).toBe(hiker);
    expect(sack.location).toMatchObject({ kind: "grid", x: 0, y: 0 });
  });

  it("falta item de slot ou carregador; sem arma, o carregador é ignorado", () => {
    const { player, wear } = kit();
    wear("primary", "rifle_vk74");
    const want = loadout({
      slots: { primary: "rifle_vk74", rig: "rig_cargo" },
      magazines: { primary: "mag_vk74", holster: "mag_pk9" },
    });
    expect(applyLoadout(player, want)).toEqual({
      missing: [
        { item: "rig_cargo", count: 1 },
        { item: "mag_vk74", count: 1 },
      ],
      noSpace: [],
    });
  });

  it("troca o carregador da arma; sem espaço para o antigo, mantém", () => {
    const { player, put, factory, wear } = kit(1, 2);
    const pistol = wear("holster", "pistol_pk9");
    const old = factory.create("mag_pk9");
    old.location = { kind: "weapon", weapon: pistol };
    pistol.magazine = old;
    // o loadout pede um carregador de outro tipo: o antigo precisa sair
    const want = loadout({ magazines: { holster: "mag_vk74" } });
    put("mag_vk74");
    expect(applyLoadout(player, want)).toEqual({
      missing: [],
      noSpace: [{ item: "mag_vk74", count: 1 }],
    });
    expect(pistol.magazine).toBe(old);

    const roomy = kit();
    const gun = roomy.wear("holster", "pistol_pk9");
    const first = roomy.factory.create("mag_pk9");
    first.location = { kind: "weapon", weapon: gun };
    gun.magazine = first;
    roomy.put("mag_vk74");
    expect(applyLoadout(roomy.player, want).noSpace).toEqual([]);
    expect(first.location?.kind).toBe("grid");
  });

  it("itens carregados: junta várias pilhas e separa a última", () => {
    const { player, factory, equipment } = kit();
    const { stash } = player.inventory;
    // put() juntaria as pilhas; aqui ficam separadas
    const a = factory.create("ammo_9mm", 10);
    const b = factory.create("ammo_9mm", 10);
    stash.place(a, 0, 0, false);
    stash.place(b, 1, 0, false);
    const want = loadout({ carried: [{ item: "ammo_9mm", count: 15 }] });
    expect(applyLoadout(player, want)).toEqual({ missing: [], noSpace: [] });
    expect(a.location).toMatchObject({ grid: equipment.pockets[0] });
    expect(b.count).toBe(5);
  });

  it("itens carregados: falta no estoque", () => {
    const { player, put } = kit();
    put("ammo_9mm", 5);
    const want = loadout({ carried: [{ item: "ammo_9mm", count: 15 }] });
    expect(applyLoadout(player, want)).toEqual({
      missing: [{ item: "ammo_9mm", count: 10 }],
      noSpace: [],
    });
  });

  it("itens carregados sem espaço: a pilha separada volta inteira", () => {
    const { player, put, factory, equipment } = kit();
    for (const pocket of equipment.pockets) {
      pocket.place(factory.create("med_bandage"), 0, 0, false);
    }
    const ammo = put("ammo_9mm", 30);
    const want = loadout({ carried: [{ item: "ammo_9mm", count: 10 }] });
    expect(applyLoadout(player, want)).toEqual({
      missing: [],
      noSpace: [{ item: "ammo_9mm", count: 10 }],
    });
    expect(ammo.count).toBe(30);
  });

  it("itens carregados sem espaço: completa a pilha e o resto volta", () => {
    const { player, put, factory, equipment } = kit();
    equipment.pockets.forEach((pocket, i) =>
      pocket.place(
        factory.create(i === 0 ? "ammo_9mm" : "med_bandage", i === 0 ? 45 : 1),
        0,
        0,
        false,
      ),
    );
    const ammo = put("ammo_9mm", 20);
    const want = loadout({ carried: [{ item: "ammo_9mm", count: 65 }] });
    expect(applyLoadout(player, want)).toEqual({
      missing: [],
      noSpace: [{ item: "ammo_9mm", count: 15 }],
    });
    expect(ammo.count).toBe(15);
    expect(ammo.location).toMatchObject({ kind: "grid", x: 0, y: 0 });
    expect(equipment.pockets[0].items()[0].count).toBe(50);
  });
});

describe("guardar, trocar e excluir", () => {
  it("até o máximo; trocar mantém o nome", () => {
    const { player, wear } = kit();
    for (let i = 0; i < MAX_LOADOUTS; i++) {
      expect(saveLoadout(player, `L${i}`)).toBe(true);
    }
    expect(saveLoadout(player, "demais")).toBe(false);
    wear("helmet", "helmet_tk1");
    replaceLoadout(player, 1);
    expect(player.loadouts[1]).toMatchObject({
      name: "L1",
      slots: { helmet: "helmet_tk1" },
    });
    replaceLoadout(player, 99);
    deleteLoadout(player, 0);
    expect(player.loadouts.map((l) => l.name)).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
    ]);
  });
});
