// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import {
  attachMagazine,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import { catalog } from "../../../src/data/items.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import {
  InventoryScene,
  STASH_X,
} from "../../../src/ui/scenes/InventoryScene.ts";

const ev = (x: number, y: number, button = 0, target: unknown = null) =>
  ({ global: { x, y }, button, target }) as never;

function setup() {
  const factory = new ItemFactory(catalog);
  const state = { stash: new Grid(8, 4), equipment: new Equipment() };
  const clock = new ManualClock(0);
  const scene = new InventoryScene(state, { clock, factory });
  const put = (id: string, x: number, y: number, count?: number) => {
    const item = factory.create(id, count);
    state.stash.place(item, x, y);
    scene.refresh();
    return item;
  };
  const viewOf = (item: Item) => scene.stashView.itemViews.get(item)!;
  const cell = (x: number, y: number) =>
    [
      STASH_X + x * CELL + CELL / 2,
      scene.stashView.y + y * CELL + CELL / 2,
    ] as const;
  return { factory, state, clock, scene, put, viewOf, cell };
}

describe("InventoryScene: carregadores", () => {
  it("usa a fábrica e o relógio passados", () => {
    const { scene, factory } = setup();
    expect(scene.factory).toBe(factory);
    expect(
      new InventoryScene({ stash: new Grid(2, 2), equipment: new Equipment() })
        .factory,
    ).toBeInstanceOf(ItemFactory);
    scene.destroy();
  });

  it("soltar munição no carregador carrega um cartucho por vez, com barra de progresso", () => {
    const { scene, put, viewOf, cell, clock } = setup();
    const ammo = put("ammo_545", 0, 0, 10);
    const mag = put("mag_vk74", 2, 0);
    viewOf(ammo).emit("pointerdown", ev(...cell(0, 0)));
    viewOf(ammo).emit("pointerup", ev(...cell(2, 0)));
    expect(scene.loader.isBusy(mag)).toBe(true);
    expect(viewOf(mag).progressBar.visible).toBe(true);

    clock.advance(200);
    scene.update(200);
    expect(loadedRounds(mag)).toBe(0);

    clock.advance(1300);
    scene.update(1300);
    expect(loadedRounds(mag)).toBe(3);
    expect(viewOf(mag).countLabel.text).toBe("3/30");
    expect(viewOf(mag).progressBar.visible).toBe(true);

    clock.advance(60_000);
    scene.update(60_000);
    expect(loadedRounds(mag)).toBe(10);
    expect(scene.loader.job).toBeNull();
    expect(viewOf(mag).progressBar.visible).toBe(false);
    scene.destroy();
  });

  it("clique direito abre o menu do item e clique fora fecha", () => {
    const { scene, put, viewOf, cell } = setup();
    const ammo = put("ammo_545", 0, 0, 10);
    viewOf(ammo).emit("pointerdown", ev(...cell(0, 0), 2));
    expect(scene.drag.dragging).toBeNull();
    expect(scene.contextMenu.visible).toBe(true);
    expect(scene.contextMenu.buttons[0].text.text).toBe(
      "Separar pilha pela metade",
    );
    // clique direito em outro lugar não fecha (ele mesmo abre menus)
    scene.view.emit("pointerdown", ev(0, 0, 2, scene.view));
    expect(scene.contextMenu.visible).toBe(true);
    // clique dentro do menu não fecha antes da opção rodar
    scene.view.emit("pointerdown", ev(0, 0, 0, scene.contextMenu.buttons[0]));
    expect(scene.contextMenu.visible).toBe(true);
    scene.view.emit("pointerdown", ev(0, 0, 0, scene.view));
    expect(scene.contextMenu.visible).toBe(false);
    scene.destroy();
  });

  it("as opções do menu mudam o inventário e redesenham a tela", () => {
    const { scene, put, viewOf, cell, state } = setup();
    const ammo = put("ammo_545", 0, 0, 10);
    viewOf(ammo).emit("pointerdown", ev(...cell(0, 0), 2));
    scene.contextMenu.buttons[0].emit("pointertap", ev(0, 0));
    expect(ammo.count).toBe(5);
    expect(state.stash.items()).toHaveLength(2);
    expect(scene.stashView.itemViews.size).toBe(2);
    scene.destroy();
  });

  it("descarregar pelo menu devolve a munição para a grade do carregador", () => {
    const { scene, put, viewOf, cell, clock, factory, state } = setup();
    const mag = put("mag_vk74", 0, 0);
    const ammo = factory.create("ammo_545", 5);
    scene.loader.start({ kind: "load", magazine: mag, ammo });
    clock.advance(10_000);
    scene.update(10_000);
    expect(loadedRounds(mag)).toBe(5);
    viewOf(mag).emit("pointerdown", ev(...cell(0, 0), 2));
    scene.contextMenu.buttons[0].emit("pointertap", ev(0, 0));
    clock.advance(10_000);
    scene.update(10_000);
    expect(loadedRounds(mag)).toBe(0);
    const unloaded = state.stash.items().find((i) => i.def.id === "ammo_545");
    expect(unloaded?.count).toBe(5);
    scene.destroy();
  });

  it("Abrir no menu abre a janela do contêiner", () => {
    const { scene, put, viewOf, cell } = setup();
    const box = put("ammo_case", 0, 0);
    viewOf(box).emit("pointerdown", ev(...cell(0, 0), 2));
    scene.contextMenu.buttons[0].emit("pointertap", ev(0, 0));
    expect(scene.window?.item).toBe(box);
    scene.destroy();
  });

  it("remover o carregador da pistola equipada guarda ele nos bolsos", () => {
    const { scene, factory, state } = setup();
    const pistol = factory.create("pistol_pk9");
    state.equipment.equip("holster", pistol);
    const mag = factory.create("mag_pk9");
    attachMagazine(pistol, mag);
    scene.refresh();
    const view = scene.slotViews.get("holster")!.itemView!;
    view.emit("pointerdown", ev(0, 0, 2));
    expect(scene.contextMenu.buttons[0].text.text).toBe("Remover carregador");
    scene.contextMenu.buttons[0].emit("pointertap", ev(0, 0));
    expect(pistol.magazine).toBeNull();
    expect(state.equipment.pockets[0].has(mag)).toBe(true);
    scene.destroy();
  });

  it("storageFor: grade do item, equipamento e estoque, sem repetir", () => {
    const { scene, put, state, factory } = setup();
    const ammo = put("ammo_545", 0, 0, 5);
    const grids = scene.storageFor(ammo);
    expect(grids[0]).toBe(state.stash);
    expect(grids.filter((g) => g === state.stash)).toHaveLength(1);
    expect(grids).toHaveLength(state.equipment.carryGrids().length + 1);
    const loose = factory.create("ammo_545", 1);
    expect(scene.storageFor(loose).at(-1)).toBe(state.stash);
    scene.destroy();
  });

  it("o botão do meio não arrasta nem abre menu", () => {
    const { scene, put, viewOf, cell } = setup();
    const ammo = put("ammo_545", 0, 0, 10);
    viewOf(ammo).emit("pointerdown", ev(...cell(0, 0), 1));
    expect(scene.drag.dragging).toBeNull();
    expect(scene.contextMenu.visible).toBe(false);
    scene.destroy();
  });

  it("menu sem opções não abre", () => {
    const { scene, put, viewOf, cell } = setup();
    const can = put("food_can", 0, 0);
    viewOf(can).emit("pointerdown", ev(...cell(0, 0), 2));
    expect(scene.contextMenu.visible).toBe(false);
    scene.destroy();
  });
});
