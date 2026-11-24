// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachMagazine } from "../../../src/core/inventory/magazine.ts";
import { saveLoadout } from "../../../src/core/loadout/loadout.ts";
import type { ShopContext } from "../../../src/core/loadout/types.ts";
import {
  LoadoutScene,
  withLoaded,
} from "../../../src/ui/scenes/LoadoutScene.ts";
import { ERROR_COLOR, OK_COLOR } from "../../../src/ui/scenes/TradersScene.ts";
import { TEST_FLEA } from "../../core/flea/fleaFixtures.ts";
import { TEST_TRADER, trader } from "../../core/trade/tradeFixtures.ts";

const SHOP: ShopContext = { traders: [TEST_TRADER], flea: TEST_FLEA };

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

function setup(ask?: (q: string, v: string) => string | null) {
  const t = trader();
  const scene = new LoadoutScene(t.player, {
    shop: SHOP,
    clock: t.clock,
    onBack: vi.fn(),
    ask,
  });
  return { ...t, scene };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LoadoutScene: renomear", () => {
  it("pede o nome, renomeia e mostra o resultado", () => {
    const ask = vi.fn(() => "Porto");
    const { player, scene } = setup(ask);
    expect(scene.renameButton.visible).toBe(false);
    saveLoadout(player, "Loadout 1");
    scene.refresh();
    expect(scene.renameButton.visible).toBe(true);
    tap(scene.renameButton);
    expect(ask).toHaveBeenCalledWith("Novo nome do loadout", "Loadout 1");
    expect(player.loadouts[0].name).toBe("Porto");
    expect(scene.messageText.text).toBe("Loadout 1 agora se chama Porto");
    expect(scene.messageText.style.fill).toBe(OK_COLOR);
    expect(scene.nameText.text).toBe("Porto");
  });

  it("nome inválido mostra o motivo; cancelar não muda nada", () => {
    const answers = ["", null];
    const { player, scene } = setup(() => answers.shift()!);
    saveLoadout(player, "A");
    scene.refresh();
    scene.rename();
    expect(scene.messageText.text).toBe("O nome não pode ficar vazio");
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);
    scene.messageText.text = "";
    scene.rename();
    expect(scene.messageText.text).toBe("");
    expect(player.loadouts[0].name).toBe("A");
  });

  it("sem loadout não faz nada; sem `ask`, usa o prompt do navegador", () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Novo");
    const { player, scene } = setup();
    scene.rename();
    expect(prompt).not.toHaveBeenCalled();
    saveLoadout(player, "A");
    scene.refresh();
    scene.rename();
    expect(prompt).toHaveBeenCalledWith("Novo nome do loadout", "A");
    expect(player.loadouts[0].name).toBe("Novo");
  });
});

describe("LoadoutScene: carregar ao montar", () => {
  it("Equipar e Comprar e equipar carregam a arma com a munição do estoque", () => {
    const { player, factory, put, scene } = setup();
    const pistol = factory.create("pistol_pk9");
    attachMagazine(pistol, factory.create("mag_pk9"));
    player.inventory.equipment.equip("holster", pistol);
    saveLoadout(player, "A");
    scene.refresh();
    put("ammo_9mm", 5);
    scene.equip();
    expect(scene.messageText.text).toBe(
      "Equipamento montado; carregou 5 cartucho(s)",
    );
    put("ammo_9mm", 2);
    scene.quick();
    expect(scene.messageText.text).toContain("carregou 2 cartucho(s)");
  });

  it("withLoaded só acrescenta quando carregou algo", () => {
    expect(withLoaded("Ok", 0)).toBe("Ok");
    expect(withLoaded("Ok", 3)).toBe("Ok; carregou 3 cartucho(s)");
  });
});
