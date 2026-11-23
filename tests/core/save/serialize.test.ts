import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Catalog } from "../../../src/core/inventory/item.ts";
import type { ItemDef } from "../../../src/core/inventory/item.ts";
import {
  attachMagazine,
  loadRounds,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import { moveToGrid } from "../../../src/core/inventory/operations.ts";
import { damage } from "../../../src/core/pmc/pmc.ts";
import { addSkillXp } from "../../../src/core/pmc/skills.ts";
import { SAVE_VERSION } from "../../../src/core/save/format.ts";
import type {
  SaveData,
  SavedPlacedItem,
} from "../../../src/core/save/format.ts";
import {
  deserializeGame,
  serializeGame,
} from "../../../src/core/save/serialize.ts";
import { catalog } from "../../../src/data/items.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";

const roundTrip = (data: SaveData) =>
  JSON.parse(JSON.stringify(data)) as SaveData;

describe("serializeGame / deserializeGame", () => {
  it("ida e volta preserva todo o estado", () => {
    const clock = new ManualClock(1000);
    const state = createNewPlayer(clock);
    const { stash, equipment } = state.inventory;
    const mag = stash.items().find((i) => i.def.id === "mag_vk74")!;
    const ammo = stash
      .items()
      .find((i) => i.def.id === "ammo_545" && i.count === 35)!;
    loadRounds(mag, ammo, 10);
    const rifle = stash.items().find((i) => i.def.id === "rifle_vk74")!;
    attachMagazine(rifle, mag);
    moveToGrid(rifle, stash, 0, 10, true);
    damage(state.pmc, "leftArm", 25);
    state.pmc.energy = 42;
    addSkillXp(state.skills, "aim", 123);
    const other = stash.items().find((i) => i.def.id === "mag_vk74")!;
    state.loader.start({ kind: "load", magazine: other, ammo });
    clock.advance(1500);
    state.loader.advance();

    const data = serializeGame(state, 5000);
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.savedAt).toBe(5000);
    expect(data.nextId).toBe(state.factory.nextId);
    expect(data.loader).toMatchObject({
      kind: "load",
      magazine: other.uid,
      done: 3,
    });

    const { state: loaded, warnings } = deserializeGame(
      roundTrip(data),
      catalog,
      clock,
    );
    expect(warnings).toEqual([]);
    expect(serializeGame(loaded, 5000)).toEqual(data);
    expect(loaded.pmc).toEqual(state.pmc);
    expect(loaded.pmc).not.toBe(state.pmc);
    const loadedRifle = loaded.inventory.stash
      .items()
      .find((i) => i.uid === rifle.uid)!;
    expect(loadedRifle.magazine?.uid).toBe(mag.uid);
    expect(loadedRounds(loadedRifle.magazine!)).toBe(10);
    expect(loaded.inventory.equipment.get("holster")?.magazine).not.toBeNull();
    expect(loaded.factory.create("food_can").uid).toBe(`i${data.nextId}`);
    expect(equipment).not.toBe(loaded.inventory.equipment);

    // o carregamento continua de onde parou
    clock.advance(1000);
    expect(loaded.loader.advance()).toBe(2);
  });

  it("carregamento salvo continua; descarregamento usa o armazenamento padrão", () => {
    const clock = new ManualClock(0);
    const state = createNewPlayer(clock);
    const pistol = state.inventory.equipment.get("holster")!;
    const mag = pistol.magazine!;
    state.loader.start({
      kind: "unload",
      magazine: mag,
      factory: state.factory,
      grids: () => [],
    });
    const data = roundTrip(serializeGame(state, 0));
    expect(data.loader).toEqual({
      kind: "unload",
      magazine: mag.uid,
      startedAt: 0,
      done: 0,
    });
    const { state: loaded } = deserializeGame(data, catalog, clock);
    clock.advance(1000);
    expect(loaded.loader.advance()).toBe(2);
    expect(
      loadedRounds(loaded.inventory.equipment.get("holster")!.magazine!),
    ).toBe(10);
  });

  it("descarta trabalhos de carregamento cujos itens sumiram", () => {
    const clock = new ManualClock(0);
    const data = roundTrip(serializeGame(createNewPlayer(clock), 0));
    data.loader = {
      kind: "load",
      magazine: "nada",
      ammo: "nada",
      startedAt: 0,
      done: 0,
    };
    expect(deserializeGame(data, catalog, clock).state.loader.job).toBeNull();
    const mag = data.equipment.slots.holster!.magazine!.uid;
    data.loader = {
      kind: "load",
      magazine: mag,
      ammo: "nada",
      startedAt: 0,
      done: 0,
    };
    expect(deserializeGame(data, catalog, clock).state.loader.job).toBeNull();
    data.loader = null;
    expect(deserializeGame(data, catalog, clock).state.loader.job).toBeNull();
  });

  it("completa PMC e skills que faltam no save com os valores padrão", () => {
    const clock = new ManualClock(0);
    const data = roundTrip(serializeGame(createNewPlayer(clock), 0));
    const partial = data as unknown as Record<string, unknown>;
    partial.pmc = { name: "Velho", xp: 10, health: { head: 20 } };
    partial.skills = { aim: 50 };
    const { state } = deserializeGame(data, catalog, clock);
    expect(state.pmc).toMatchObject({ name: "Velho", xp: 10, energy: 100 });
    expect(state.pmc.health).toMatchObject({ head: 20, thorax: 85 });
    expect(state.skills).toMatchObject({ aim: 50, magDrills: 0 });
    delete partial.pmc;
    delete partial.skills;
    const fresh = deserializeGame(data, catalog, clock).state;
    expect(fresh.pmc.name).toBe("PMC");
    expect(fresh.skills.aim).toBe(0);
  });
});

/** Catálogo pequeno para simular saves antigos com itens diferentes */
const OLD: ItemDef[] = [
  {
    id: "box",
    name: "Caixa",
    shortName: "B",
    category: "container",
    width: 2,
    height: 2,
    basePrice: 1,
    grids: [{ width: 2, height: 2 }],
  },
  {
    id: "small",
    name: "Pequeno",
    shortName: "S",
    category: "barter",
    width: 1,
    height: 1,
    basePrice: 1,
  },
  {
    id: "big",
    name: "Grande",
    shortName: "G",
    category: "barter",
    width: 3,
    height: 3,
    basePrice: 1,
  },
  {
    id: "ammo",
    name: "Munição",
    shortName: "A",
    category: "ammo",
    width: 1,
    height: 1,
    maxStack: 10,
    basePrice: 1,
    stats: { caliber: "C1" },
  },
  {
    id: "mag",
    name: "Carregador",
    shortName: "M",
    category: "magazine",
    width: 1,
    height: 1,
    basePrice: 1,
    stats: { caliber: "C1", capacity: 5 },
  },
  {
    id: "gun",
    name: "Arma",
    shortName: "W",
    category: "weapon",
    width: 2,
    height: 1,
    basePrice: 1,
    equipSlot: "pistol",
    stats: { caliber: "C2" },
  },
  {
    id: "hat",
    name: "Chapéu",
    shortName: "H",
    category: "barter",
    width: 1,
    height: 1,
    basePrice: 1,
  },
];

function save(
  stash: SavedPlacedItem[],
  extra: Partial<SaveData> = {},
): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: 0,
    nextId: 100,
    stash: { width: 3, height: 3, items: stash },
    equipment: { slots: {}, pockets: [[], [], [], []] },
    pmc: undefined as never,
    skills: undefined as never,
    loader: null,
    ...extra,
  };
}

const at = (x: number, y: number, item: object): SavedPlacedItem =>
  ({ x, y, r: false, count: 1, ...item }) as SavedPlacedItem;

describe("deserializeGame: saves antigos e inconsistentes", () => {
  const clock = new ManualClock(0);
  const old = new Catalog(OLD);

  it("itens removidos do catálogo são descartados com aviso", () => {
    const { state, warnings } = deserializeGame(
      save([
        at(0, 0, { uid: "a", def: "sumiu" }),
        at(1, 0, { uid: "b", def: "small" }),
      ]),
      old,
      clock,
    );
    expect(warnings).toEqual(["Item removido do jogo: sumiu (a)"]);
    expect(state.inventory.stash.items().map((i) => i.uid)).toEqual(["b"]);
  });

  it("quantidade inválida para a definição atual é descartada", () => {
    const { warnings } = deserializeGame(
      save([at(0, 0, { uid: "a", def: "small", count: 5 })]),
      old,
      clock,
    );
    expect(warnings[0]).toContain("a: Quantidade inválida");
  });

  it("item que não cabe mais na posição vai para o primeiro espaço da grade", () => {
    const { state } = deserializeGame(
      save([
        at(0, 0, { uid: "s", def: "small" }),
        at(0, 0, { uid: "t", def: "small" }),
      ]),
      old,
      clock,
    );
    expect(
      state.inventory.stash.items().find((i) => i.uid === "t")?.location,
    ).toMatchObject({ x: 1, y: 0 });
  });

  it("conteúdo que não cabe no contêiner vai para o estoque; sem espaço, é perdido com aviso", () => {
    const { state, warnings } = deserializeGame(
      save([
        at(0, 0, {
          uid: "box",
          def: "box",
          grids: [
            [at(0, 0, { uid: "inner", def: "big" })],
            [at(0, 0, { uid: "ghost", def: "small" })],
          ],
        }),
      ]),
      old,
      clock,
    );
    const ids = state.inventory.stash.items().map((i) => i.uid);
    expect(ids).toContain("ghost");
    expect(ids).not.toContain("inner");
    expect(warnings).toEqual(["Sem espaço no estoque para big (inner)"]);
  });

  it("cartuchos: munição removida é avisada; item que deixou de ser carregador ignora", () => {
    const { state, warnings } = deserializeGame(
      save([
        at(0, 0, {
          uid: "m",
          def: "mag",
          rounds: [
            ["ammo", 3],
            ["sumiu", 1],
          ],
        }),
        at(1, 0, { uid: "h", def: "hat", rounds: [["ammo", 3]] }),
      ]),
      old,
      clock,
    );
    expect(warnings).toEqual(["Munição removida do jogo: sumiu"]);
    const mag = state.inventory.stash.items().find((i) => i.uid === "m")!;
    expect(loadedRounds(mag)).toBe(3);
    expect(
      state.inventory.stash.items().find((i) => i.uid === "h")!.rounds,
    ).toBeUndefined();
  });

  it("carregador incompatível com a arma vai para o estoque", () => {
    const { state, warnings } = deserializeGame(
      save([
        at(0, 0, {
          uid: "g",
          def: "gun",
          magazine: { uid: "m", def: "mag", count: 1 },
        }),
      ]),
      old,
      clock,
    );
    expect(warnings).toEqual(["Carregador incompatível com g"]);
    expect(
      state.inventory.stash
        .items()
        .map((i) => i.uid)
        .sort(),
    ).toEqual(["g", "m"]);
  });

  it("carregador removido do catálogo some sem quebrar a arma", () => {
    const { state, warnings } = deserializeGame(
      save([
        at(0, 0, {
          uid: "g",
          def: "gun",
          magazine: { uid: "m", def: "sumiu", count: 1 },
        }),
      ]),
      old,
      clock,
    );
    expect(warnings).toHaveLength(1);
    expect(state.inventory.stash.items()[0].magazine).toBeNull();
  });

  it("equipamento: slot incompatível vai para o estoque; item removido é descartado", () => {
    const { state, warnings } = deserializeGame(
      save([], {
        equipment: {
          slots: {
            helmet: { uid: "h", def: "hat", count: 1 },
            holster: { uid: "g", def: "gun", count: 1 },
            backpack: { uid: "x", def: "sumiu", count: 1 },
          },
          pockets: [[at(0, 0, { uid: "p", def: "small" })], [], [], []],
        },
      }),
      old,
      clock,
    );
    expect(warnings).toEqual(["Item removido do jogo: sumiu (x)"]);
    expect(state.inventory.equipment.get("holster")?.uid).toBe("g");
    expect(state.inventory.equipment.get("helmet")).toBeNull();
    expect(state.inventory.stash.items().map((i) => i.uid)).toEqual(["h"]);
    expect(state.inventory.equipment.pockets[0].items()[0].uid).toBe("p");
  });
});
