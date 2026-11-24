// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createRaidProfile } from "../../../src/core/raid/profile.ts";
import { catalog } from "../../../src/data/items.ts";
import { ENEMIES, MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  LOOT_RULE_LABELS,
  READY_COLOR,
  RaidSetupScene,
  WARNING_COLOR,
  describeExtract,
  describeMap,
  describeStats,
} from "../../../src/ui/scenes/RaidSetupScene.ts";
import { armedPlayer } from "../../core/raid/raidFixtures.ts";

function setup(player = createNewPlayer(new ManualClock(3))) {
  const onStart = vi.fn();
  const onBack = vi.fn();
  const clock = new ManualClock(1000);
  const scene = new RaidSetupScene(player, {
    maps: MAPS,
    enemies: ENEMIES,
    clock,
    onStart,
    onBack,
  });
  return { scene, player, onStart, onBack };
}

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

describe("textos da preparação", () => {
  it("extrações com e sem requisito", () => {
    const base = { id: "e", name: "Saída", risk: 0 };
    expect(describeExtract(base, catalog)).toBe("Saída");
    expect(
      describeExtract(
        { ...base, requirement: { kind: "key", item: "key_garage" } },
        catalog,
      ),
    ).toBe("Saída (chave: Chave da garagem)");
    expect(
      describeExtract(
        {
          ...base,
          requirement: { kind: "payment", item: "money_rub", amount: 7000 },
        },
        catalog,
      ),
    ).toBe("Saída (pagar 7.000 ₽)");
    expect(
      describeExtract(
        { ...base, requirement: { kind: "noBackpack" } },
        catalog,
      ),
    ).toBe("Saída (sem mochila)");
  });

  it("ficha do mapa", () => {
    const text = describeMap(MAPS[0], catalog);
    expect(text).toContain(MAPS[0].description);
    expect(text).toContain("Dificuldade: 1/5");
    expect(text).toContain("Duração: 30 min");
    expect(text).toContain("Estrada do Posto; Túnel de Serviço");
  });

  it("estatísticas e karma com sinal", () => {
    const profile = createRaidProfile(1);
    expect(describeStats(profile)).toBe(
      "Raids: 0 · Extrações: 0 · Mortes: 0 · MIA: 0\nAbates: 0 Scav, 0 PMC · Karma: 0.00",
    );
    profile.karma = 1.5;
    expect(describeStats(profile)).toContain("Karma: +1.50");
    profile.karma = -0.25;
    expect(describeStats(profile)).toContain("Karma: -0.25");
  });
});

describe("RaidSetupScene", () => {
  it("começa no primeiro mapa e na estratégia equilibrada", () => {
    const { scene } = setup();
    expect(scene.map).toBe(MAPS[0]);
    expect(scene.strategy).toBe("balanced");
    expect(scene.mapButtons.get(MAPS[0].id)!.alpha).toBe(1);
    expect(scene.mapButtons.get(MAPS[1].id)!.alpha).toBeLessThan(1);
    expect(scene.strategyButtons.get("balanced")!.alpha).toBe(1);
    expect(scene.strategyInfo.text).toContain("Briga quando precisa");
  });

  it("botões trocam mapa e estratégia", () => {
    const { scene } = setup();
    tap(scene.mapButtons.get("harbor")!);
    expect(scene.map.id).toBe("harbor");
    expect(scene.mapInfo.text).toContain("Barco do Contrabandista");
    tap(scene.strategyButtons.get("stealth")!);
    expect(scene.strategy).toBe("stealth");
    expect(scene.strategyButtons.get("stealth")!.alpha).toBe(1);
  });

  it("regra de loot alterna e fica no perfil", () => {
    const { scene, player } = setup();
    expect(scene.lootRuleButton.text.text).toBe(LOOT_RULE_LABELS.valuePerCell);
    tap(scene.lootRuleButton);
    expect(player.raid.lootRule).toBe("keepFirst");
    expect(scene.lootRuleButton.text.text).toBe(LOOT_RULE_LABELS.keepFirst);
    tap(scene.lootRuleButton);
    expect(player.raid.lootRule).toBe("valuePerCell");
  });

  it("avisos em vermelho; equipado, 'Pronto' em verde", () => {
    const { scene } = setup();
    expect(scene.warningsText.text).toBe(
      "⚠ Sem colete balístico\n⚠ Sem capacete",
    );
    expect(scene.warningsText.style.fill).toBe(WARNING_COLOR);
    const { player } = armedPlayer();
    const { equipment } = player.inventory;
    equipment.equip("armor", player.factory.create("armor_civil"));
    equipment.equip("helmet", player.factory.create("helmet_tk1"));
    const ready = setup(player).scene;
    expect(ready.warningsText.text).toBe("Pronto para a raid");
    expect(ready.warningsText.style.fill).toBe(READY_COLOR);
  });

  it("entrar resolve a raid e avisa o jogo", () => {
    const { scene, player, onStart } = setup();
    tap(scene.mapButtons.get("cement")!);
    tap(scene.startButton);
    expect(onStart).toHaveBeenCalledOnce();
    expect(player.raid.active?.summary.map).toBe("cement");
    expect(player.raid.active?.startedAt).toBe(1000);
    expect(player.raid.stats.raids).toBe(1);
  });

  it("voltar e redimensionar", () => {
    const { scene, onBack } = setup();
    tap(scene.backButton);
    expect(onBack).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
    scene.resize(472, 100000);
    expect(scene.content.scale.x).toBeCloseTo(0.5);
    expect(scene.content.x).toBeCloseTo((472 - 880 * 0.5) / 2);
  });
});
