// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import type { Item } from "../../../src/core/inventory/item.ts";
import { autoPlace } from "../../../src/core/inventory/operations.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import { InventoryScene } from "../../../src/ui/scenes/InventoryScene.ts";
import {
  ERROR_COLOR,
  TradersScene,
} from "../../../src/ui/scenes/TradersScene.ts";
import { theme } from "../../../src/ui/theme.ts";

function setup() {
  const clock = new ManualClock(0);
  const player = createNewPlayer(clock);
  const find = (id: string) =>
    player.inventory.stash.items().find((i) => i.def.id === id)!;
  const open = (sellItem?: Item) =>
    new TradersScene(player, {
      traders: TRADERS,
      clock,
      onBack: vi.fn(),
      sellItem,
    });
  return { player, find, open };
}

describe("TradersScene: item escolhido para vender", () => {
  it("abre no vendedor que paga mais, na aba de venda, com a linha destacada", () => {
    const { find, open } = setup();
    const rifle = find("rifle_vk74");
    const scene = open(rifle);
    expect(scene.trader.id).toBe("colonel");
    expect(scene.tab).toBe("sell");
    expect(scene.focus).toBe(rifle);
    const row = scene.saleItems().indexOf(rifle) % 10;
    const label = scene.rows.children[row * 2] as unknown as {
      style: { fill: unknown };
    };
    expect(label.style.fill).toBe(theme.accent);
    expect(scene.messageText.text).toBe("");
  });

  it("vai para a página em que o item aparece", () => {
    const { player, find, open } = setup();
    // muita sucata no estoque empurra o item para outras páginas
    for (let i = 0; i < 25; i++) {
      autoPlace(player.factory.create("barter_bolts"), [
        player.inventory.stash,
      ]);
    }
    const kit = find("med_kit");
    const scene = open(kit);
    const index = scene.saleItems().indexOf(kit);
    expect(scene.page).toBe(Math.floor(index / 10));
  });

  it("ninguém compra: fica no vendedor atual com o motivo", () => {
    const { player, open } = setup();
    const money = player.inventory.stash
      .items()
      .find((i) => i.def.category === "money")!;
    const scene = open(money);
    expect(scene.trader.id).toBe(TRADERS[0].id);
    expect(scene.tab).toBe("sell");
    expect(scene.page).toBe(0);
    expect(scene.messageText.text).toBe(
      `Nenhum vendedor compra ${money.def.name}`,
    );
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);
  });
});

describe("InventoryScene: área de venda", () => {
  it("o botão Vendedores vira área de venda só com onSellItem; itens fora do estoque não vendem", () => {
    const clock = new ManualClock(0);
    const player = createNewPlayer(clock);
    const onSellItem = vi.fn();
    const scene = new InventoryScene(player.inventory, {
      player,
      onOpenTraders: vi.fn(),
      onSellItem,
    });
    expect(scene.targets().sell?.view).toBe(scene.tradersButton);
    const rifle = player.inventory.stash
      .items()
      .find((i) => i.def.id === "rifle_vk74")!;
    const view = scene.stashView.itemViews.get(rifle)!;
    scene.drag.begin(view, view.toGlobal({ x: 5, y: 5 }));
    scene.drag.end(scene.tradersButton!.toGlobal({ x: 5, y: 5 }));
    expect(onSellItem).toHaveBeenCalledWith(rifle);

    // a pistola equipada não está no estoque
    const holster = scene.slotViews.get("holster")!;
    scene.drag.begin(
      holster.itemView!,
      holster.itemView!.toGlobal({ x: 5, y: 5 }),
    );
    expect(
      scene.drag.resolve(scene.tradersButton!.toGlobal({ x: 5, y: 5 })),
    ).toMatchObject({ kind: "sell", ok: false });
    scene.drag.cancel();
    scene.destroy();

    const plain = new InventoryScene(player.inventory, {
      player,
      onOpenTraders: vi.fn(),
    });
    expect(plain.targets().sell).toBeUndefined();
    plain.destroy();
  });
});
