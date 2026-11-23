import { describe, expect, it } from "vitest";

import {
  MAX_SKILL_LEVEL,
  SKILLS,
  SKILL_INFO,
  addSkillXp,
  createSkills,
  skillBonus,
  skillLevel,
  skillProgress,
  skillXpForLevel,
} from "../../../src/core/pmc/skills.ts";

describe("skills", () => {
  it("todas começam com 0 de XP e têm nome e descrição", () => {
    const skills = createSkills();
    expect(Object.keys(skills)).toEqual([...SKILLS]);
    for (const id of SKILLS) {
      expect(skills[id]).toBe(0);
      expect(SKILL_INFO[id].name.length).toBeGreaterThan(0);
      expect(SKILL_INFO[id].description.length).toBeGreaterThan(0);
    }
  });

  it("XP acumulado por nível: 10 × n(n+1)/2, com limites", () => {
    expect(skillXpForLevel(0)).toBe(0);
    expect(skillXpForLevel(1)).toBe(10);
    expect(skillXpForLevel(2)).toBe(30);
    expect(skillXpForLevel(-1)).toBe(0);
    expect(skillXpForLevel(999)).toBe(skillXpForLevel(MAX_SKILL_LEVEL));
  });

  it("nível e progresso pelo XP", () => {
    expect(skillLevel(9)).toBe(0);
    expect(skillLevel(10)).toBe(1);
    expect(skillLevel(1e9)).toBe(MAX_SKILL_LEVEL);
    expect(skillProgress(15)).toEqual({ current: 5, needed: 20 });
    expect(skillProgress(1e9)).toEqual({ current: 0, needed: 0 });
  });

  it("addSkillXp devolve quantos níveis subiu", () => {
    const skills = createSkills();
    expect(addSkillXp(skills, "aim", 35)).toBe(2);
    expect(addSkillXp(skills, "aim", 0)).toBe(0);
    expect(addSkillXp(skills, "aim", -1)).toBe(0);
    expect(skills.aim).toBe(35);
  });

  it("bônus de 1% por nível, limitado a 50%", () => {
    const skills = createSkills();
    expect(skillBonus(skills, "magDrills")).toBe(0);
    skills.magDrills = skillXpForLevel(10);
    expect(skillBonus(skills, "magDrills")).toBeCloseTo(0.1);
    skills.magDrills = skillXpForLevel(MAX_SKILL_LEVEL);
    expect(skillBonus(skills, "magDrills")).toBe(0.5);
  });
});
