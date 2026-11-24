// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { MAX_LOADOUTS } from "../../../src/core/loadout/loadout.ts";
import type { ShopContext } from "../../../src/core/loadout/types.ts";
import { catalog } from "../../../src/data/items.ts";
import {
  LoadoutScene,
  describeApply,
  describeList,
  describeLoadoutItems,
  nextLoadoutName,
} from "../../../src/ui/scenes/LoadoutScene.ts";
import { ERROR_COLOR, OK_COLOR } from "../../../src/ui/scenes/TradersScene.ts";
import { TEST_FLEA } from "../../core/flea/fleaFixtures.ts";
import { TEST_TRADER, trader } from "../../core/trade/tradeFixtures.ts";

const SHOP: ShopContext = { traders: [TEST_TRADER], flea: TEST_FLEA };

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

function setup() {
  const t = trader();
  const onBack = vi.fn();
  const scene = new LoadoutScene(t.player, {
    shop: SHOP,
    clock: t.clock,
    onBack,
  });
  return { ...t, scene, onBack };
}

describe("textos dos loadouts", () => {
  it("listas, linhas de itens, resultado e nomes", () => {
    expect(
      describeList(
        [
          { item: "barter_bolts", count: 2 },
          { item: "med_bandage", count: 1 },
          { item: "sumiu", count: 1 },
        ],
        catalog,
      ),
    ).toBe(`Parafusos x2, ${catalog.get("med_bandage").name}, sumiu`);

    const { player, put } = trader();
    put("ammo_9mm", 10);
    expect(
      describeLoadoutItems(player, {
        name: "L",
        slots: { helmet: "sumiu" },
        magazines: {},
        carried: [
          { item: "ammo_9mm", count: 30 },
          { item: "barter_bolts", count: 1 },
        ],
      }),
    ).toEqual([
      "sumiu — falta 1",
      `${catalog.get("ammo_9mm").name} x30 — falta 20`,
      "Parafusos — falta 1",
    ]);
    put("barter_bolts");
    expect(
      describeLoadoutItems(player, {
        name: "L",
        slots: {},
        magazines: {},
        carried: [{ item: "barter_bolts", count: 1 }],
      }),
    ).toEqual(["Parafusos — tem"]);

    expect(describeApply({ missing: [], noSpace: [] }, catalog)).toEqual({
      text: "Equipamento montado",
      ok: true,
    });
    expect(
      describeApply(
        {
          missing: [{ item: "barter_bolts", count: 2 }],
          noSpace: [{ item: "med_bandage", count: 1 }],
        },
        catalog,
      ),
    ).toEqual({
      text: `Montado em parte: faltou Parafusos x2; sem espaço para ${catalog.get("med_bandage").name}`,
      ok: false,
    });

    expect(nextLoadoutName([])).toBe("Loadout 1");
    const named = (name: string) => ({
      name,
      slots: {},
      magazines: {},
      carried: [],
    });
    expect(nextLoadoutName([named("Loadout 1"), named("Loadout 3")])).toBe(
      "Loadout 2",
    );
  });
});

describe("LoadoutScene", () => {
  it("sem loadouts: explica e as ações não fazem nada", () => {
    const { scene } = setup();
    expect(scene.nameText.text).toBe("Nenhum loadout");
    expect(scene.equipButton.visible).toBe(false);
    scene.equip();
    scene.quick();
    scene.replace();
    scene.remove();
    expect(scene.messageText.text).toBe("");
  });

  it("salvar, selecionar, montar, trocar e excluir", () => {
    const { scene, player, put, factory } = setup();
    tap(scene.saveButton);
    expect(scene.messageText.text).toBe("Loadout 1 salvo");
    expect(scene.messageText.style.fill).toBe(OK_COLOR);
    expect(scene.itemsText.text).toBe("Equipamento vazio");
    expect(scene.costText.text).toBe("Tem tudo");

    // segundo loadout com munição nos bolsos
    player.inventory.equipment.pockets[0].place(
      factory.create("ammo_9mm", 30),
      0,
      0,
      false,
    );
    tap(scene.saveButton);
    expect(scene.selected).toBe(1);
    expect(scene.listButtons).toHaveLength(2);
    expect(scene.listButtons[0].alpha).toBeLessThan(1);
    const ammo = player.inventory.equipment.pockets[0].items()[0];
    player.inventory.equipment.pockets[0].remove(ammo);
    scene.refresh();
    expect(scene.itemsText.text).toContain("falta 30");
    expect(scene.costText.text).toBe("Custo estimado do que falta: 3.375 ₽");

    put("ammo_9mm", 30);
    tap(scene.equipButton);
    expect(scene.messageText.text).toBe("Equipamento montado");

    tap(scene.listButtons[0]);
    expect(scene.selected).toBe(0);
    tap(scene.replaceButton);
    expect(scene.messageText.text).toBe("Loadout 1 atualizado");
    expect(player.loadouts[0].carried).toEqual([
      { item: "ammo_9mm", count: 30 },
    ]);
    tap(scene.deleteButton);
    expect(scene.messageText.text).toBe("Loadout 1 excluído");
    expect(player.loadouts.map((l) => l.name)).toEqual(["Loadout 2"]);
    expect(scene.selected).toBe(0);
  });

  it("montar em parte, comprar e equipar, item fora de venda e limite", () => {
    const { scene, player, put } = setup();
    player.loadouts.push({
      name: "Caro",
      slots: {},
      magazines: {},
      carried: [
        { item: "ammo_9mm", count: 30 },
        { item: "barter_gpu", count: 1 },
      ],
    });
    scene.select(0);
    expect(scene.costText.text).toContain("Custo estimado");
    expect(scene.costText.text).toContain("Não está à venda agora: ");
    tap(scene.equipButton);
    expect(scene.messageText.text).toContain("Montado em parte: faltou");
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);

    put("money_rub", 10_000);
    tap(scene.quickButton);
    expect(scene.messageText.text).toContain(
      `Comprou ${catalog.get("ammo_9mm").name} x50 por`,
    );
    expect(scene.messageText.text).toContain(
      `não conseguiu comprar ${catalog.get("barter_gpu").name}`,
    );
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);

    player.loadouts[0].carried = [{ item: "barter_gpu", count: 1 }];
    scene.refresh();
    expect(scene.costText.text).toBe(
      `Não está à venda agora: ${catalog.get("barter_gpu").name}`,
    );

    player.loadouts[0].carried = [{ item: "ammo_9mm", count: 10 }];
    tap(scene.quickButton);
    expect(scene.messageText.text).toBe("Equipamento montado");
    expect(scene.messageText.style.fill).toBe(OK_COLOR);

    while (player.loadouts.length < MAX_LOADOUTS) scene.saveCurrent();
    expect(scene.saveButton.alpha).toBeLessThan(1);
    tap(scene.saveButton);
    expect(scene.messageText.text).toBe(`Máximo de ${MAX_LOADOUTS} loadouts`);
  });

  it("voltar e redimensionar", () => {
    const { scene, onBack } = setup();
    tap(scene.backButton);
    expect(onBack).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
  });
});
