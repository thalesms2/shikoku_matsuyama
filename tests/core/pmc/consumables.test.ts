import { describe, expect, it } from "vitest";

import { Grid } from "../../../src/core/inventory/grid.ts";
import { Catalog, ItemFactory } from "../../../src/core/inventory/item.ts";
import type { ItemDef } from "../../../src/core/inventory/item.ts";
import { MS_PER_ROUND } from "../../../src/core/inventory/loading.ts";
import {
  CONSUMABLE_SKILL_XP,
  isConsumable,
  msPerRound,
  useConsumable,
} from "../../../src/core/pmc/consumables.ts";
import { createPmc, damage } from "../../../src/core/pmc/pmc.ts";
import { createSkills, skillXpForLevel } from "../../../src/core/pmc/skills.ts";

const base = { width: 1, height: 1, basePrice: 1, shortName: "x" };
const DEFS: ItemDef[] = [
  { ...base, id: "kit", name: "Kit", category: "medical", stats: { heal: 50 } },
  {
    ...base,
    id: "can",
    name: "Lata",
    category: "food",
    stats: { energy: 40, hydration: -5 },
  },
  {
    ...base,
    id: "water",
    name: "Água",
    category: "food",
    maxStack: 3,
    stats: { hydration: 60 },
  },
  { ...base, id: "pill", name: "Pílula", category: "medical" },
  {
    ...base,
    id: "empty",
    name: "Vazio",
    category: "medical",
    stats: { damage: 1 },
  },
  {
    ...base,
    id: "rock",
    name: "Pedra",
    category: "barter",
    stats: { heal: 10 },
  },
];

function setup() {
  const factory = new ItemFactory(new Catalog(DEFS));
  return {
    make: factory.create.bind(factory),
    pmc: createPmc(),
    skills: createSkills(),
  };
}

describe("isConsumable", () => {
  it("só remédios e comida com algum efeito", () => {
    const { make } = setup();
    expect(isConsumable(make("kit"))).toBe(true);
    expect(isConsumable(make("can"))).toBe(true);
    expect(isConsumable(make("water"))).toBe(true);
    expect(isConsumable(make("pill"))).toBe(false);
    expect(isConsumable(make("empty"))).toBe(false);
    expect(isConsumable(make("rock"))).toBe(false);
  });
});

describe("useConsumable", () => {
  it("remédio cura, dá XP de Saúde e some", () => {
    const { make, pmc, skills } = setup();
    damage(pmc, "leftLeg", 40);
    const kit = make("kit");
    const grid = new Grid(1, 1);
    grid.place(kit, 0, 0);
    expect(useConsumable(kit, pmc, skills)).toEqual({
      healed: 40,
      energy: 0,
      hydration: 0,
    });
    expect(pmc.health.leftLeg).toBe(65);
    expect(skills.health).toBe(CONSUMABLE_SKILL_XP);
    expect(grid.isEmpty).toBe(true);
  });

  it("comida muda energia e hidratação e dá XP de Metabolismo", () => {
    const { make, pmc, skills } = setup();
    pmc.energy = 50;
    expect(useConsumable(make("can"), pmc, skills)).toEqual({
      healed: 0,
      energy: 40,
      hydration: -5,
    });
    expect(skills.metabolism).toBe(CONSUMABLE_SKILL_XP);
    expect(skills.health).toBe(0);
  });

  it("pilhas perdem uma unidade por uso", () => {
    const { make, pmc, skills } = setup();
    pmc.hydration = 0;
    const water = make("water", 3);
    useConsumable(water, pmc, skills);
    expect(water.count).toBe(2);
    expect(pmc.hydration).toBe(60);
  });

  it("skills aumentam o efeito", () => {
    const { make, pmc, skills } = setup();
    skills.metabolism = skillXpForLevel(10);
    skills.health = skillXpForLevel(20);
    pmc.hydration = 0;
    useConsumable(make("water"), pmc, skills);
    expect(pmc.hydration).toBeCloseTo(66);
    damage(pmc, "thorax", 80);
    useConsumable(make("kit"), pmc, skills);
    expect(pmc.health.thorax).toBeCloseTo(5 + 60);
  });

  it("item que não é consumível não faz nada", () => {
    const { make, pmc, skills } = setup();
    const rock = make("rock");
    expect(useConsumable(rock, pmc, skills)).toBeNull();
    expect(rock.count).toBe(1);
  });
});

describe("msPerRound", () => {
  it("Manuseio de carregador reduz o tempo por cartucho", () => {
    const skills = createSkills();
    expect(msPerRound(skills)).toBe(MS_PER_ROUND);
    skills.magDrills = skillXpForLevel(20);
    expect(msPerRound(skills)).toBeCloseTo(400);
  });
});
