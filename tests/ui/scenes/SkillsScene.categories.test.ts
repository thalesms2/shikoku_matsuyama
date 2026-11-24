// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import {
  SKILLS,
  SKILL_CATEGORIES,
  SKILL_CATEGORY_NAMES,
  SKILL_INFO,
  createSkills,
  skillsIn,
} from "../../../src/core/pmc/skills.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import {
  SKILL_COLUMNS,
  SkillsScene,
} from "../../../src/ui/scenes/SkillsScene.ts";

describe("categorias das skills", () => {
  it("as 34 skills estão nas quatro categorias, na ordem pedida", () => {
    expect(SKILLS).toHaveLength(34);
    expect(skillsIn("physical").map((id) => SKILL_INFO[id].name)).toEqual([
      "Resistência",
      "Força",
      "Saúde",
      "Metabolismo",
      "Resistência ao estresse",
      "Vitalidade",
    ]);
    expect(skillsIn("combat")).toHaveLength(14);
    expect(skillsIn("combat")[0]).toBe("aim");
    expect(skillsIn("practical")).toHaveLength(10);
    expect(skillsIn("practical")).toContain("magDrills");
    expect(skillsIn("mental").map((id) => SKILL_INFO[id].name)).toEqual([
      "Atenção",
      "Carisma",
      "Intelecto",
      "Percepção",
    ]);
    expect(SKILL_CATEGORIES.flatMap(skillsIn).sort()).toEqual(
      [...SKILLS].sort(),
    );
    expect(Object.values(SKILL_CATEGORY_NAMES)).toEqual([
      "Físicas",
      "Combate",
      "Práticas",
      "Mentais",
    ]);
  });

  it("as skills novas começam em 0", () => {
    const skills = createSkills();
    expect(skills.pistols).toBe(0);
    expect(skills.intellect).toBe(0);
  });
});

describe("SkillsScene por categoria", () => {
  it("um título por categoria; cada coluna em ordem, de cima para baixo", () => {
    const player = createNewPlayer(new ManualClock());
    const scene = new SkillsScene(player, vi.fn());
    expect([...scene.categoryTitles.keys()].sort()).toEqual(
      [...SKILL_CATEGORIES].sort(),
    );
    expect(scene.categoryTitles.get("combat")!.text).toBe("Combate");
    for (const categories of SKILL_COLUMNS) {
      const [top, bottom] = categories.map((c) => scene.categoryTitles.get(c)!);
      expect(top.x).toBe(bottom.x);
      expect(bottom.y).toBeGreaterThan(top.y);
      const last = skillsIn(categories[0]).at(-1)!;
      expect(scene.skillBars.get(last)!.y).toBeLessThan(bottom.y);
    }
    expect(scene.categoryTitles.get("combat")!.x).toBeGreaterThan(
      scene.categoryTitles.get("physical")!.x,
    );
  });
});
