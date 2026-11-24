// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { Grid } from "../../../src/core/inventory/grid.ts";
import {
  attachMagazine,
  loadRounds,
  loadedRounds,
} from "../../../src/core/inventory/magazine.ts";
import {
  ContextMenu,
  MENU_ITEM_HEIGHT,
} from "../../../src/ui/components/ContextMenu.ts";
import { itemActions } from "../../../src/ui/inventory/actions.ts";
import type { ActionContext } from "../../../src/ui/inventory/actions.ts";
import { countText } from "../../../src/ui/inventory/ItemView.ts";
import { ammoSheet, itemSheet } from "../../../src/ui/inventory/Tooltip.ts";
import { magSetup } from "../../core/inventory/magFixtures.ts";

describe("countText", () => {
  it("carregadores e armas mostram munição carregada/capacidade", () => {
    const { make } = magSetup();
    const mag = make("mag");
    expect(countText(mag)).toBe("0/30");
    loadRounds(mag, make("fmj", 12));
    expect(countText(mag)).toBe("12/30");
    const rifle = make("rifle");
    expect(countText(rifle)).toBe("");
    attachMagazine(rifle, mag);
    expect(countText(rifle)).toBe("12/30");
    expect(countText(make("fmj", 7))).toBe("7");
    expect(countText(make("rock"))).toBe("");
  });
});

describe("ammoSheet", () => {
  it("lista a munição do carregador do topo para baixo", () => {
    const { make } = magSetup();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 10));
    loadRounds(mag, make("ap", 5));
    expect(ammoSheet(mag)).toEqual([
      "Munição: 15/30",
      "  545 AP x5",
      "  545 FMJ x10",
    ]);
  });

  it("armas mostram o carregador ou a falta dele; outros itens nada", () => {
    const { make } = magSetup();
    const rifle = make("rifle");
    expect(ammoSheet(rifle)).toEqual(["Sem carregador"]);
    const mag = make("mag");
    loadRounds(mag, make("fmj", 3));
    attachMagazine(rifle, mag);
    expect(ammoSheet(rifle)).toEqual(["Carregador: Carregador 545 (3/30)"]);
    expect(ammoSheet(make("rock"))).toEqual([]);
  });

  it("itemSheet junta dados técnicos e munição", () => {
    const { make } = magSetup();
    const mag = make("mag");
    expect(itemSheet(mag)).toEqual([
      "Calibre: C545",
      "Capacidade: 30 cartuchos",
      "Munição: 0/30",
    ]);
  });
});

describe("ContextMenu", () => {
  it("mostra uma opção por linha e roda a escolhida, fechando o menu", () => {
    const menu = new ContextMenu();
    const run = vi.fn();
    menu.show(10, 20, [
      { label: "A", run },
      { label: "B", run: () => {} },
    ]);
    expect(menu.visible).toBe(true);
    expect([menu.x, menu.y]).toEqual([10, 20]);
    expect(menu.buttons).toHaveLength(2);
    expect(menu.buttons[1].y).toBe(MENU_ITEM_HEIGHT);
    menu.buttons[0].emit("pointertap", {} as never);
    expect(run).toHaveBeenCalledOnce();
    expect(menu.visible).toBe(false);
    expect(menu.buttons).toEqual([]);
  });

  it("sem opções não abre; abrir de novo troca as opções", () => {
    const menu = new ContextMenu();
    menu.show(0, 0, []);
    expect(menu.visible).toBe(false);
    menu.show(0, 0, [{ label: "A", run: () => {} }]);
    const old = menu.buttons[0];
    menu.show(0, 0, [{ label: "B", run: () => {} }]);
    expect(old.destroyed).toBe(true);
    expect(menu.buttons[0].text.text).toBe("B");
  });
});

describe("itemActions", () => {
  function ctx(grids: Grid[] = [new Grid(4, 4)]) {
    const { make, factory } = magSetup();
    const context: ActionContext = {
      factory,
      storageFor: () => grids,
      openWindow: vi.fn(),
      changed: vi.fn(),
    };
    return { make, context, grids };
  }
  const labels = (opts: { label: string }[]) => opts.map((o) => o.label);

  it("itens comuns não têm ações", () => {
    const { make, context } = ctx();
    expect(itemActions(make("rock"), context)).toEqual([]);
    expect(itemActions(make("mag"), context)).toEqual([]);
  });

  it("contêineres têm Abrir", async () => {
    const { context } = ctx();
    const { Catalog, ItemFactory } =
      await import("../../../src/core/inventory/item.ts");
    const bag = new ItemFactory(
      new Catalog([
        {
          id: "bag",
          name: "Bolsa",
          shortName: "B",
          category: "container",
          width: 1,
          height: 1,
          basePrice: 1,
          grids: [{ width: 1, height: 1 }],
        },
      ]),
    ).create("bag");
    const [open] = itemActions(bag, context);
    expect(open.label).toBe("Abrir");
    open.run();
    expect(context.openWindow).toHaveBeenCalledWith(bag);
    expect(context.changed).not.toHaveBeenCalled();
  });

  it("Descarregar tira todos os cartuchos na hora", () => {
    const { make, context, grids } = ctx();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 4));
    const [unload] = itemActions(mag, context);
    expect(unload.label).toBe("Descarregar");
    unload.run();
    expect(context.changed).toHaveBeenCalledOnce();
    expect(loadedRounds(mag)).toBe(0);
    expect(grids[0].items()[0].count).toBe(4);
    expect(itemActions(mag, context)).toEqual([]);
  });

  it("Descarregar avisa quantos cartuchos saíram; sem espaço, o resto fica", () => {
    const grid = new Grid(1, 1);
    const { make, context } = ctx([grid]);
    const roundsMoved = vi.fn();
    const mag = make("mag");
    loadRounds(mag, make("fmj", 30));
    grid.place(make("fmj", 50), 0, 0);
    itemActions(mag, { ...context, roundsMoved })[0].run();
    expect(roundsMoved).toHaveBeenCalledWith(10);
    expect(loadedRounds(mag)).toBe(20);
  });

  it("Remover carregador guarda o carregador na grade", () => {
    const { make, context, grids } = ctx();
    const rifle = make("rifle");
    const mag = make("mag");
    attachMagazine(rifle, mag);
    const [remove] = itemActions(rifle, context);
    expect(remove.label).toBe("Remover carregador");
    remove.run();
    expect(rifle.magazine).toBeNull();
    expect(grids[0].has(mag)).toBe(true);
  });

  it("Separar pilha pela metade cria uma nova pilha num espaço livre", () => {
    const { make, context, grids } = ctx();
    const stack = make("fmj", 9);
    grids[0].place(stack, 0, 0);
    const [split] = itemActions(stack, context);
    expect(labels([split])).toEqual(["Separar pilha pela metade"]);
    split.run();
    expect(stack.count).toBe(5);
    const other = grids[0].items().find((i) => i !== stack)!;
    expect(other.count).toBe(4);
  });

  it("sem espaço para a metade, a pilha fica como estava", () => {
    const grid = new Grid(1, 1);
    const { make, context } = ctx([grid]);
    const stack = make("fmj", 10);
    grid.place(stack, 0, 0);
    itemActions(stack, context)[0].run();
    expect(stack.count).toBe(10);
    expect(grid.items()).toEqual([stack]);
  });
});
