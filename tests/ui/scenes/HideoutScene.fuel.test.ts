// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CORE_DEFAULTS,
  resetCoreBalance,
  setCoreBalance,
} from "../../../src/core/balance.ts";
import { ManualClock } from "../../../src/core/clock.ts";
import { autoPlace } from "../../../src/core/inventory/operations.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import { HideoutScene } from "../../../src/ui/scenes/HideoutScene.ts";
import { ERROR_COLOR, OK_COLOR } from "../../../src/ui/scenes/TradersScene.ts";
import { FUEL_HIDEOUT } from "../../core/hideout/fuelFixtures.ts";
import { HOUR, MIN } from "../../core/hideout/hideoutFixtures.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

function setup() {
  const clock = new ManualClock(0);
  const player = createNewPlayer(clock);
  const scene = new HideoutScene(player, {
    data: FUEL_HIDEOUT,
    traders: TRADERS,
    clock,
    onBack: vi.fn(),
  });
  const labels = () =>
    scene.rows.children
      .filter((c) => !("onPress" in c))
      .map((c) => (c as Text).text);
  const pick = (id: string) => tap(scene.moduleButtons.get(id)!);
  return { scene, player, clock, labels, pick };
}

afterEach(() => {
  resetCoreBalance();
});

describe("HideoutScene: obras e combustível", () => {
  it("cada módulo mostra a contagem da própria obra", () => {
    const { scene, player, pick } = setup();
    player.hideout.construction = { module: "power", level: 1, endsAt: HOUR };
    player.hideout.extraConstructions = [
      { module: "radio", level: 1, endsAt: 30 * MIN },
    ];
    scene.refresh();
    expect(scene.upgradeText.text).toBe("Em obra: nível 1, termina em 1h");
    pick("radio");
    expect(scene.upgradeText.text).toBe("Em obra: nível 1, termina em 30min");
    expect(scene.upgradeButton.visible).toBe(false);
  });

  it("abastece o gerador com um galão do estoque", () => {
    const { scene, player, labels } = setup();
    expect(labels()[0]).not.toContain("Combustível");
    player.hideout.modules.power = 1;
    scene.refresh();
    expect(scene.infoText.text).toContain(
      "Gerador sem combustível: produções e renda paradas",
    );
    expect(labels()[0]).toBe("Combustível: 0/30 · dura 0s");
    expect(scene.rowButtons[0].text.text).toBe("Abastecer");
    expect(scene.rowButtons[0].alpha).toBeLessThan(1);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Faltam: Galão de combustível (0/1)");
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);
    const can = player.factory.create("barter_fuel");
    autoPlace(can, [player.inventory.stash]);
    scene.refresh();
    expect(scene.rowButtons[0].alpha).toBe(1);
    tap(scene.rowButtons[0]);
    expect(scene.messageText.text).toBe("Gerador abastecido");
    expect(scene.messageText.style.fill).toBe(OK_COLOR);
    expect(labels()[0]).toBe("Combustível: 10/30 · dura 10h");
    expect(scene.infoText.text).not.toContain("sem combustível");
  });

  it("sem gasto por hora, não mostra quanto dura", () => {
    setCoreBalance({
      ...CORE_DEFAULTS,
      fuel: { ...CORE_DEFAULTS.fuel, perHour: 0 },
    });
    const { scene, player, labels } = setup();
    player.hideout.modules.power = 1;
    player.hideout.fuel = 5;
    scene.refresh();
    expect(labels()[0]).toBe("Combustível: 5/30");
  });
});
