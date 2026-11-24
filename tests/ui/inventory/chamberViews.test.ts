// @vitest-environment jsdom
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import {
  attachMagazine,
  loadRounds,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import { itemActions } from "../../../src/ui/inventory/actions.ts";
import type { ActionContext } from "../../../src/ui/inventory/actions.ts";
import { DragController } from "../../../src/ui/inventory/DragController.ts";
import { GridView } from "../../../src/ui/inventory/GridView.ts";
import { countText } from "../../../src/ui/inventory/ItemView.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import { SlotView } from "../../../src/ui/inventory/SlotView.ts";
import { ammoSheet } from "../../../src/ui/inventory/Tooltip.ts";
import { chamberSetup } from "../../core/inventory/chamberFixtures.ts";

const labels = (options: { label: string }[]) => options.map((o) => o.label);

describe("countText e ammoSheet com câmara e tubo", () => {
  it("o tubo mostra carregados/capacidade e a câmara aparece como +1", () => {
    const { make, factory } = chamberSetup();
    const shotgun = make("shotgun");
    expect(countText(shotgun)).toBe("0/4");
    loadRounds(shotgun, make("buck", 3));
    shotgun.chamber = factory.catalog.get("slug");
    expect(countText(shotgun)).toBe("3+1/4");
    const rifle = make("rifle");
    expect(countText(rifle)).toBe("");
    rifle.chamber = factory.catalog.get("fmj");
    expect(countText(rifle)).toBe("1");
    attachMagazine(rifle, make("mag"));
    expect(countText(rifle)).toBe("0+1/30");
  });

  it("o tooltip lista o tubo do topo para baixo e o cartucho da câmara", () => {
    const { make, factory } = chamberSetup();
    const shotgun = make("shotgun");
    loadRounds(shotgun, make("buck", 2));
    loadRounds(shotgun, make("slug", 1));
    expect(ammoSheet(shotgun)).toEqual([
      "Tubo: 3/4",
      "  Balote x1",
      "  Chumbo x2",
    ]);
    shotgun.chamber = factory.catalog.get("buck");
    expect(ammoSheet(shotgun).at(-1)).toBe("Câmara: Chumbo");
    const rifle = make("rifle");
    rifle.chamber = factory.catalog.get("fmj");
    expect(ammoSheet(rifle)).toEqual(["Sem carregador", "Câmara: 545 FMJ"]);
  });
});

describe("itemActions com câmara e tubo", () => {
  function ctx(grids: Grid[] = [new Grid(4, 4)]) {
    const { make, factory } = chamberSetup();
    const context: ActionContext = {
      factory,
      storageFor: () => grids,
      openWindow: vi.fn(),
      changed: vi.fn(),
    };
    return { make, factory, context, grids };
  }

  it("Carregar a câmara e Descarregar a câmara", () => {
    const { make, context, grids } = ctx();
    const rifle = make("rifle");
    const mag = make("mag");
    attachMagazine(rifle, mag);
    expect(labels(itemActions(rifle, context))).toEqual(["Remover carregador"]);
    loadRounds(mag, make("fmj", 2));
    const options = itemActions(rifle, context);
    expect(labels(options)).toEqual([
      "Remover carregador",
      "Carregar a câmara",
    ]);
    options[1].run();
    expect(rifle.chamber?.id).toBe("fmj");
    expect(loadedRounds(mag)).toBe(1);
    expect(context.changed).toHaveBeenCalledOnce();
    const unload = itemActions(rifle, context).find(
      (o) => o.label === "Descarregar a câmara",
    )!;
    unload.run();
    expect(rifle.chamber).toBeUndefined();
    expect(grids[0].items()[0].def.id).toBe("fmj");
  });

  it("a escopeta descarrega o tubo na hora", () => {
    const { make, context } = ctx();
    const shotgun = make("shotgun");
    expect(itemActions(shotgun, context)).toEqual([]);
    loadRounds(shotgun, make("buck", 2));
    expect(labels(itemActions(shotgun, context))).toEqual([
      "Descarregar",
      "Carregar a câmara",
    ]);
    itemActions(shotgun, context)[0].run();
    expect(loadedRounds(shotgun)).toBe(0);
    expect(itemActions(shotgun, context)).toEqual([]);
  });
});

describe("DragController com a escopeta", () => {
  function scene() {
    const { make } = chamberSetup();
    const stash = new Grid(8, 2);
    const equipment = new Equipment();
    const stashView = new GridView(stash);
    const primary = new SlotView(equipment, "primary");
    primary.position.set(600, 0);
    const overlay = new Container();
    new Container().addChild(stashView, primary, overlay);
    const drag = new DragController(
      overlay,
      () => ({ grids: [stashView], slots: [primary] }),
      () => {
        stashView.refresh();
        primary.refresh();
      },
    );
    const cell = (x: number, y: number) => ({
      x: x * CELL + CELL / 2,
      y: y * CELL + CELL / 2,
    });
    return { make, stash, stashView, equipment, primary, drag, cell };
  }

  it("cartuchos sobre a escopeta na grade carregam o tubo", () => {
    const { make, stash, stashView, drag, cell } = scene();
    const shells = make("buck", 10);
    const shotgun = make("shotgun");
    stash.place(shells, 0, 0);
    stash.place(shotgun, 2, 0);
    stashView.refresh();
    drag.begin(stashView.itemViews.get(shells)!, cell(0, 0));
    expect(drag.resolve(cell(3, 0))).toMatchObject({
      kind: "load",
      target: shotgun,
      ok: true,
    });
    expect(drag.end(cell(3, 0))).toBe(true);
    expect(loadedRounds(shotgun)).toBe(4);
  });

  it("cartuchos sobre a escopeta equipada carregam o tubo", () => {
    const { make, stash, stashView, equipment, primary, drag, cell } = scene();
    const shotgun = make("shotgun");
    equipment.equip("primary", shotgun);
    primary.refresh();
    const wrong = make("fmj", 5);
    const shells = make("buck", 10);
    stash.place(wrong, 0, 0);
    stash.place(shells, 1, 0);
    stashView.refresh();
    drag.begin(stashView.itemViews.get(wrong)!, cell(0, 0));
    expect(drag.resolve({ x: 620, y: 20 })).toMatchObject({
      kind: "load",
      view: primary,
      ok: false,
    });
    drag.cancel();
    drag.begin(stashView.itemViews.get(shells)!, cell(1, 0));
    expect(drag.end({ x: 620, y: 20 })).toBe(true);
    // 1 cartucho na câmara e 4 no tubo
    expect(shotgun.chamber?.id).toBe("buck");
    expect(loadedRounds(shotgun)).toBe(4);
    expect(shells.count).toBe(5);
  });
});

describe("DragController: munição sobre arma com carregador", () => {
  function scene() {
    const { make } = chamberSetup();
    const stash = new Grid(8, 2);
    const equipment = new Equipment();
    const stashView = new GridView(stash);
    const primary = new SlotView(equipment, "primary");
    primary.position.set(600, 0);
    const overlay = new Container();
    new Container().addChild(stashView, primary, overlay);
    const drag = new DragController(
      overlay,
      () => ({ grids: [stashView], slots: [primary] }),
      () => {
        stashView.refresh();
        primary.refresh();
      },
    );
    const cell = (x: number, y: number) => ({
      x: x * CELL + CELL / 2,
      y: y * CELL + CELL / 2,
    });
    return { make, stash, stashView, equipment, primary, drag, cell };
  }

  it("na grade: câmara e carregador; calibre errado fica vermelho", () => {
    const { make, stash, stashView, drag, cell } = scene();
    const rifle = make("rifle");
    const mag = make("mag");
    attachMagazine(rifle, mag);
    const wrong = make("nine", 5);
    const ammo = make("fmj", 10);
    stash.place(wrong, 0, 0);
    stash.place(ammo, 0, 1);
    stash.place(rifle, 2, 0);
    stashView.refresh();
    drag.begin(stashView.itemViews.get(wrong)!, cell(0, 0));
    expect(drag.resolve(cell(3, 0))).toMatchObject({ kind: "load", ok: false });
    drag.cancel();
    drag.begin(stashView.itemViews.get(ammo)!, cell(0, 1));
    expect(drag.resolve(cell(3, 0))).toMatchObject({
      kind: "load",
      target: rifle,
      ok: true,
    });
    expect(drag.end(cell(3, 0))).toBe(true);
    expect(rifle.chamber?.id).toBe("fmj");
    expect(loadedRounds(mag)).toBe(9);
  });

  it("equipada no slot: carrega a câmara e o carregador", () => {
    const { make, stash, stashView, equipment, primary, drag, cell } = scene();
    const rifle = make("rifle");
    const mag = make("mag");
    attachMagazine(rifle, mag);
    equipment.equip("primary", rifle);
    primary.refresh();
    const ammo = make("fmj", 3);
    stash.place(ammo, 0, 0);
    stashView.refresh();
    drag.begin(stashView.itemViews.get(ammo)!, cell(0, 0));
    expect(drag.end({ x: 620, y: 20 })).toBe(true);
    expect(rifle.chamber?.id).toBe("fmj");
    expect(loadedRounds(mag)).toBe(2);
    expect(stash.has(ammo)).toBe(false);
  });
});
