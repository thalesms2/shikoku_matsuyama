// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { Button } from "../../../src/ui/components/Button.ts";
import { ContainerWindow } from "../../../src/ui/inventory/ContainerWindow.ts";
import {
  GridView,
  HIGHLIGHT_BAD,
  HIGHLIGHT_OK,
} from "../../../src/ui/inventory/GridView.ts";
import { ItemView } from "../../../src/ui/inventory/ItemView.ts";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CELL,
  cellAt,
  dropCell,
  fitScale,
  formatCount,
  formatPrice,
} from "../../../src/ui/inventory/layout.ts";
import {
  SLOT_BOX,
  SLOT_LABELS,
  SlotView,
} from "../../../src/ui/inventory/SlotView.ts";
import { Tooltip, describeItem } from "../../../src/ui/inventory/Tooltip.ts";
import { setup } from "../../core/inventory/fixtures.ts";

describe("layout", () => {
  it("dropCell arredonda o canto do item para a célula mais próxima", () => {
    expect(dropCell(100, 100, 10, 10)).toEqual({ x: 2, y: 2 });
    expect(dropCell(70, 30, 0, 0)).toEqual({ x: 1, y: 1 });
    expect(dropCell(20, 20, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(dropCell(5, 5, 40, 40)).toEqual({ x: -1, y: -1 });
    expect(dropCell(10, 10, 0, 0, 10)).toEqual({ x: 1, y: 1 });
  });

  it("cellAt devolve a célula sob o ponteiro", () => {
    expect(cellAt(0, 0)).toEqual({ x: 0, y: 0 });
    expect(cellAt(CELL - 1, CELL)).toEqual({ x: 0, y: 1 });
    expect(cellAt(25, 5, 10)).toEqual({ x: 2, y: 0 });
  });

  it("fitScale reduz para caber mas nunca aumenta", () => {
    expect(fitScale(100, 50, 50, 50)).toBe(0.5);
    expect(fitScale(50, 100, 50, 50)).toBe(0.5);
    expect(fitScale(10, 10, 50, 50)).toBe(1);
  });

  it("formatPrice separa milhares com ponto", () => {
    expect(formatPrice(0)).toBe("0 ₽");
    expect(formatPrice(999)).toBe("999 ₽");
    expect(formatPrice(12500)).toBe("12.500 ₽");
    expect(formatPrice(1234567.4)).toBe("1.234.567 ₽");
  });

  it("formatCount abrevia quantidades grandes", () => {
    expect(formatCount(9999)).toBe("9999");
    expect(formatCount(10000)).toBe("10k");
    expect(formatCount(150999)).toBe("150k");
    expect(formatCount(1_000_000)).toBe("1M");
    expect(formatCount(2_560_000)).toBe("2.6M");
  });

  it("toda categoria tem cor e nome", () => {
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual(
      Object.keys(CATEGORY_COLORS).sort(),
    );
  });
});

describe("ItemView", () => {
  it("desenha o item com o tamanho das células e o nome curto", () => {
    const { make } = setup();
    const view = new ItemView(make("wide"));
    expect(view.pixelSize).toEqual({ w: 2 * CELL, h: CELL });
    expect(view.nameText.text).toBe("L");
    expect(view.nameText.position.x).toBe(2 * CELL - 4);
    expect(view.countLabel.text).toBe("");
    expect(view.label).toMatch(/^item:i\d+$/);
  });

  it("mostra a quantidade de itens empilháveis", () => {
    const { make } = setup();
    const item = make("ammo", 12);
    const view = new ItemView(item);
    expect(view.countLabel.text).toBe("12");
    item.count = 7;
    view.redraw();
    expect(view.countLabel.text).toBe("7");
    item.count = 25000;
    view.redraw();
    expect(view.countLabel.text).toBe("25k");
  });

  it("rotação troca largura e altura", () => {
    const { make } = setup();
    const view = new ItemView(make("tall"), true);
    expect(view.pixelSize).toEqual({ w: 3 * CELL, h: CELL });
    view.setRotated(false);
    expect(view.rotated).toBe(false);
    expect(view.pixelSize).toEqual({ w: CELL, h: 3 * CELL });
    expect(view.countLabel.position.y).toBe(3 * CELL - 2);
  });
});

describe("GridView", () => {
  it("cria uma view por item, na posição da célula", () => {
    const { make } = setup();
    const grid = new Grid(4, 3);
    const tall = make("tall");
    grid.place(tall, 1, 0, true);
    const view = new GridView(grid);
    expect(view.pixelWidth).toBe(4 * CELL);
    expect(view.pixelHeight).toBe(3 * CELL);
    const itemView = view.itemViews.get(tall)!;
    expect(itemView.position.x).toBe(CELL);
    expect(itemView.rotated).toBe(true);
    expect(view.itemLayer.children).toEqual([itemView]);
  });

  it("refresh recria as views a partir da grade", () => {
    const { make } = setup();
    const grid = new Grid(2, 2);
    const view = new GridView(grid);
    expect(view.itemViews.size).toBe(0);
    const item = make("small");
    grid.place(item, 1, 1);
    view.refresh();
    const first = view.itemViews.get(item)!;
    expect(first.position.y).toBe(CELL);
    view.refresh();
    expect(first.destroyed).toBe(true);
    expect(view.itemViews.get(item)).not.toBe(first);
  });

  it("containsLocal testa os limites em pixels", () => {
    const view = new GridView(new Grid(2, 1));
    expect(view.containsLocal(0, 0)).toBe(true);
    expect(view.containsLocal(2 * CELL - 1, CELL - 1)).toBe(true);
    expect(view.containsLocal(2 * CELL, 0)).toBe(false);
    expect(view.containsLocal(0, CELL)).toBe(false);
    expect(view.containsLocal(-1, 0)).toBe(false);
    expect(view.containsLocal(0, -1)).toBe(false);
  });

  it("mostra e esconde a prévia, limitada à área da grade", () => {
    const view = new GridView(new Grid(3, 3));
    expect(view.highlight.visible).toBe(false);
    view.showHighlight(2, 2, 2, 2, true);
    expect(view.highlight.visible).toBe(true);
    const bounds = view.highlight.getLocalBounds();
    expect(bounds.x).toBe(2 * CELL);
    expect(bounds.width).toBe(CELL);
    view.showHighlight(-1, -1, 2, 2, false);
    const b2 = view.highlight.getLocalBounds();
    expect(b2.x).toBe(0);
    expect(b2.width).toBe(CELL);
    view.hideHighlight();
    expect(view.highlight.visible).toBe(false);
    expect(HIGHLIGHT_OK).not.toBe(HIGHLIGHT_BAD);
  });
});

describe("SlotView", () => {
  it("mostra o nome do slot e fica vazio sem item", () => {
    const view = new SlotView(new Equipment(), "helmet");
    expect(view.title.text).toBe(SLOT_LABELS.helmet);
    expect(view.itemView).toBeNull();
    expect(view.pixelWidth).toBe(SLOT_BOX.helmet.w * CELL);
    expect(view.pixelHeight).toBe(SLOT_BOX.helmet.h * CELL);
  });

  it("reduz e centraliza o item equipado na caixa", () => {
    const { make } = setup();
    const equipment = new Equipment();
    equipment.equip("backpack", make("bag"));
    const bagView = new SlotView(equipment, "backpack");
    // mochila 2x2 numa caixa 2x2: escala 1, sem deslocamento
    expect(bagView.itemView!.scale.x).toBe(1);
    expect(bagView.itemView!.position.x).toBe(0);

    equipment.equip("holster", make("pistol"));
    const holster = new SlotView(equipment, "holster");
    // pistola 2x1 numa caixa 2x2: escala 1, centralizada na vertical
    expect(holster.itemView!.position.y).toBe(CELL / 2);

    equipment.equip("primary", make("rifle"));
    const primary = new SlotView(equipment, "primary");
    // fuzil 4x2 numa caixa 5x2: escala 1, centralizado na horizontal
    expect(primary.itemView!.position.x).toBe(CELL / 2);
  });

  it("refresh troca a view do item conforme o equipamento", () => {
    const { make } = setup();
    const equipment = new Equipment();
    const view = new SlotView(equipment, "helmet");
    equipment.equip("helmet", make("helmet"));
    view.refresh();
    const first = view.itemView!;
    expect(first).not.toBeNull();
    equipment.unequip("helmet");
    view.refresh();
    expect(first.destroyed).toBe(true);
    expect(view.itemView).toBeNull();
  });

  it("containsLocal e destaque", () => {
    const view = new SlotView(new Equipment(), "primary");
    expect(view.containsLocal(5 * CELL - 1, 2 * CELL - 1)).toBe(true);
    expect(view.containsLocal(5 * CELL, 0)).toBe(false);
    expect(view.containsLocal(0, 2 * CELL)).toBe(false);
    expect(view.containsLocal(-1, 0)).toBe(false);
    expect(view.containsLocal(0, -1)).toBe(false);
    view.showHighlight(true);
    expect(view.highlight.visible).toBe(true);
    expect(view.highlight.tint).toBe(HIGHLIGHT_OK);
    view.showHighlight(false);
    expect(view.highlight.tint).toBe(HIGHLIGHT_BAD);
    view.hideHighlight();
    expect(view.highlight.visible).toBe(false);
  });
});

describe("Button", () => {
  it("chama onPress ao clicar", () => {
    const onPress = vi.fn();
    const button = new Button("Ok", onPress);
    expect(button.text.text).toBe("Ok");
    expect(button.buttonWidth).toBe(120);
    expect(button.buttonHeight).toBe(28);
    button.emit("pointertap", {} as never);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("aceita tamanho personalizado", () => {
    const button = new Button("X", () => {}, 20, 10);
    expect(button.text.position.x).toBe(10);
    expect(button.text.position.y).toBe(5);
  });
});

describe("Tooltip", () => {
  it("descreve itens simples", () => {
    const { make } = setup();
    expect(describeItem(make("wide"))).toEqual([
      "Largo",
      "2x1 · Troca",
      "Valor: 20 ₽",
    ]);
  });

  it("descreve pilhas e contêineres", () => {
    const { make } = setup();
    expect(describeItem(make("ammo", 10))).toContain("Quantidade: 10/30");
    const rig = make("rig");
    expect(describeItem(rig)).toContain(
      "Contêiner: 3 células (duplo clique para abrir)",
    );
  });

  it("mostra perto do ponteiro e esconde", () => {
    const { make } = setup();
    const tooltip = new Tooltip();
    expect(tooltip.visible).toBe(false);
    tooltip.show(make("small"), 100, 50);
    expect(tooltip.visible).toBe(true);
    expect(tooltip.position.x).toBe(116);
    expect(tooltip.position.y).toBe(66);
    expect(tooltip.text.text).toContain("Pequeno");
    tooltip.hide();
    expect(tooltip.visible).toBe(false);
  });
});

describe("ContainerWindow", () => {
  it("mostra as grades do contêiner lado a lado e fecha pelo botão", () => {
    const { make } = setup();
    const rig = make("rig");
    const onClose = vi.fn();
    const win = new ContainerWindow(rig, onClose);
    expect(win.title.text).toBe("Colete");
    expect(win.gridViews).toHaveLength(2);
    expect(win.gridViews[1].x).toBeGreaterThan(win.gridViews[0].x);
    win.closeButton.emit("pointertap", {} as never);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("refresh atualiza as grades", () => {
    const { make } = setup();
    const bag = make("bag");
    const win = new ContainerWindow(bag, () => {});
    const item = make("small");
    bag.grids[0].place(item, 0, 0);
    win.refresh();
    expect(win.gridViews[0].itemViews.has(item)).toBe(true);
  });
});
