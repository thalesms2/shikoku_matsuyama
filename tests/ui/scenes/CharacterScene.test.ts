// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { MAX_LEVEL, damage, xpForLevel } from "../../../src/core/pmc/pmc.ts";
import {
  MAX_SKILL_LEVEL,
  SKILLS,
  skillXpForLevel,
} from "../../../src/core/pmc/skills.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  CharacterScene,
  HEALTH_COLOR,
  StatBar,
} from "../../../src/ui/scenes/CharacterScene.ts";

function setup() {
  const player = createNewPlayer(new ManualClock());
  const onBack = vi.fn();
  return { player, onBack, scene: new CharacterScene(player, onBack) };
}

describe("StatBar", () => {
  it("mostra rótulo, valor e barra limitada entre 0 e 1", () => {
    const bar = new StatBar("Teste");
    expect(bar.labelText.text).toBe("Teste");
    bar.set("5/10", 0.5, HEALTH_COLOR);
    expect(bar.value.text).toBe("5/10");
    const half = bar.bar.getLocalBounds().width;
    bar.set("", 3, HEALTH_COLOR);
    expect(bar.bar.getLocalBounds().width).toBeGreaterThanOrEqual(half);
    bar.set("", -1, HEALTH_COLOR);
    expect(bar.value.text).toBe("");
  });
});

describe("CharacterScene", () => {
  it("mostra nome, nível, vida, energia, hidratação e todas as skills", () => {
    const { scene, player } = setup();
    expect(scene.title.text).toBe(player.pmc.name);
    expect(scene.levelBar.value.text).toBe("1 · 0/1000 XP");
    expect(scene.totalBar.value.text).toBe("440/440");
    expect(scene.partBars.size).toBe(7);
    expect(scene.partBars.get("head")!.value.text).toBe("35/35");
    expect(scene.energyBar.value.text).toBe("100/100");
    expect(scene.hydrationBar.value.text).toBe("100/100");
    expect([...scene.skillBars.keys()]).toEqual([...SKILLS]);
    expect(scene.skillBars.get("aim")!.value.text).toBe("nível 0 · +0%");
  });

  it("refresh reflete mudanças no PMC e nas skills", () => {
    const { scene, player } = setup();
    damage(player.pmc, "leftArm", 60);
    damage(player.pmc, "rightLeg", 50);
    player.pmc.energy = 33.4;
    player.pmc.hydration = 0;
    player.skills.magDrills = skillXpForLevel(10);
    player.pmc.xp = xpForLevel(3) + 500;
    scene.refresh();
    expect(scene.partBars.get("leftArm")!.value.text).toBe("destruída");
    expect(scene.partBars.get("rightLeg")!.value.text).toBe("15/65");
    expect(scene.energyBar.value.text).toBe("33/100");
    expect(scene.hydrationBar.value.text).toBe("0/100");
    expect(scene.skillBars.get("magDrills")!.value.text).toBe(
      "nível 10 · +10%",
    );
    expect(scene.levelBar.value.text).toBe("3 · 500/3000 XP");
  });

  it("nível e skills no máximo", () => {
    const { scene, player } = setup();
    player.pmc.xp = xpForLevel(MAX_LEVEL) + 10;
    player.skills.aim = skillXpForLevel(MAX_SKILL_LEVEL);
    scene.refresh();
    expect(scene.levelBar.value.text).toBe(`${MAX_LEVEL} (máximo)`);
    expect(scene.skillBars.get("aim")!.value.text).toBe("nível 51 · +50%");
  });

  it("o botão volta ao inventário", () => {
    const { scene, onBack } = setup();
    scene.backButton.emit("pointertap", {} as never);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("resize escala e centraliza", () => {
    const { scene } = setup();
    scene.resize(10000, 10000);
    expect(scene.content.scale.x).toBe(1.5);
    scene.resize(500, 5000);
    expect(scene.content.scale.x).toBeCloseTo(500 / (840 + 64));
    expect(scene.content.x).toBeCloseTo(
      (500 - 840 * scene.content.scale.x) / 2,
    );
  });
});

describe("larguras das barras", () => {
  it("skills usam barras mais largas que a vida", () => {
    const { scene } = setup();
    expect(scene.partBars.get("head")!.barWidth).toBe(220);
    expect(scene.skillBars.get("magDrills")!.barWidth).toBe(320);
    expect(scene.skillBars.get("magDrills")!.value.x).toBe(320);
  });
});
