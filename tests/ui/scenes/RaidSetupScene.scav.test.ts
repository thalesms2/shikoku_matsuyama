// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createScavProfile } from "../../../src/core/raid/profile.ts";
import { ENEMIES, MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { SCAV_LOADOUT } from "../../../src/data/scav.ts";
import {
  RaidSetupScene,
  describeScav,
  formatCountdown,
} from "../../../src/ui/scenes/RaidSetupScene.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

function setup(withLoadout = false) {
  const clock = new ManualClock(5000);
  const player = createNewPlayer(clock);
  const onStart = vi.fn();
  const scene = new RaidSetupScene(player, {
    maps: MAPS,
    enemies: ENEMIES,
    clock,
    onStart,
    onBack: vi.fn(),
    ...(withLoadout && { scavLoadout: SCAV_LOADOUT }),
  });
  return { scene, player, clock, onStart };
}

describe("textos da raid Scav", () => {
  it("contagem regressiva", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
    expect(formatCountdown(1)).toBe("00:01");
    expect(formatCountdown(20 * 60 * 1000)).toBe("20:00");
    expect(formatCountdown(61_500)).toBe("01:02");
  });

  it("liberada, em espera, efeito do karma e estatísticas", () => {
    const scav = createScavProfile();
    expect(describeScav(scav, 0, 0)).toBe(
      [
        "Raid Scav (equipamento aleatório, o PMC não arrisca nada): liberada",
        "Karma 0.00: Scavs amigáveis 60% · tocaia ×1.00 · loot ×1.00",
        "Raids Scav: 0 · Extrações: 0 · Mortes: 0 · MIA: 0",
      ].join("\n"),
    );
    scav.readyAt = 90_000;
    expect(describeScav(scav, 10, 0)).toContain("em espera, 01:30");
    expect(describeScav(scav, 10, 0)).toContain(
      "Karma +10.00: Scavs amigáveis 100% · tocaia ×0.50 · loot ×1.30",
    );
    expect(describeScav(scav, -2, 0)).toContain("Karma -2.00");
  });
});

describe("RaidSetupScene: raid Scav", () => {
  it("liberada: entra com o mapa e a estratégia escolhidos", () => {
    const { scene, player, onStart } = setup();
    expect(scene.scavText.text).toContain("liberada");
    expect(scene.scavButton.alpha).toBe(1);
    tap(scene.mapButtons.get("cement")!);
    tap(scene.strategyButtons.get("stealth")!);
    tap(scene.scavButton);
    expect(onStart).toHaveBeenCalledOnce();
    expect(player.raid.active?.summary).toMatchObject({
      map: "cement",
      strategy: "stealth",
    });
    expect(player.raid.active?.summary.scav).toBeDefined();
    expect(player.scav.readyAt).toBeGreaterThan(5000);
  });

  it("aceita outras tabelas de equipamento", () => {
    const { scene, player } = setup(true);
    scene.startScav();
    expect(player.scav.stats.raids).toBe(1);
  });

  it("em espera: botão apagado, não entra, contagem anda com update", () => {
    const { scene, player, clock, onStart } = setup();
    player.scav.readyAt = 5000 + 61_000;
    scene.refresh();
    expect(scene.scavButton.alpha).toBeLessThan(1);
    expect(scene.scavText.text).toContain("em espera, 01:01");
    tap(scene.scavButton);
    expect(onStart).not.toHaveBeenCalled();
    expect(player.raid.active).toBeNull();
    clock.advance(31_000);
    scene.update();
    expect(scene.scavText.text).toContain("em espera, 00:30");
    clock.advance(30_000);
    scene.update();
    expect(scene.scavText.text).toContain("liberada");
    expect(scene.scavButton.alpha).toBe(1);
  });
});
