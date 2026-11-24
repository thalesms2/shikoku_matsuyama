// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import {
  MAX_SKILL_LEVEL,
  SKILLS,
  skillXpForLevel,
} from "../../../src/core/pmc/skills.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  SkillsScene,
  StatBar,
  XP_COLOR,
} from "../../../src/ui/scenes/SkillsScene.ts";

function setup() {
  const player = createNewPlayer(new ManualClock());
  const onBack = vi.fn();
  return { player, onBack, scene: new SkillsScene(player, onBack) };
}

describe("StatBar", () => {
  it("mostra rótulo, valor e barra limitada entre 0 e 1", () => {
    const bar = new StatBar("Teste");
    expect(bar.labelText.text).toBe("Teste");
    bar.set("5/10", 0.5, XP_COLOR);
    expect(bar.value.text).toBe("5/10");
    const half = bar.bar.getLocalBounds().width;
    bar.set("", 3, XP_COLOR);
    expect(bar.bar.getLocalBounds().width).toBeGreaterThanOrEqual(half);
    bar.set("", -1, XP_COLOR);
    expect(bar.value.text).toBe("");
  });
});

describe("SkillsScene", () => {
  it("mostra o título e todas as skills", () => {
    const { scene } = setup();
    expect(scene.title.text).toBe("Skills");
    expect([...scene.skillBars.keys()].sort()).toEqual([...SKILLS].sort());
    expect(scene.skillBars.get("aim")!.value.text).toBe("nível 0 · +0%");
  });

  it("refresh reflete mudanças nas skills", () => {
    const { scene, player } = setup();
    player.skills.magDrills = skillXpForLevel(10);
    scene.refresh();
    expect(scene.skillBars.get("magDrills")!.value.text).toBe(
      "nível 10 · +10%",
    );
  });

  it("skill no máximo", () => {
    const { scene, player } = setup();
    player.skills.aim = skillXpForLevel(MAX_SKILL_LEVEL);
    scene.refresh();
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
    expect(scene.content.scale.x).toBeCloseTo(500 / (740 + 64));
    expect(scene.content.x).toBeCloseTo(
      (500 - 740 * scene.content.scale.x) / 2,
    );
  });
});
