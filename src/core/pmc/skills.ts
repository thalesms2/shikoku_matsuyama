/** Skills do PMC */
export const SKILLS = [
  "endurance",
  "strength",
  "health",
  "vitality",
  "metabolism",
  "perception",
  "stealth",
  "aim",
  "magDrills",
] as const;

export type SkillId = (typeof SKILLS)[number];

export interface SkillInfo {
  name: string;
  description: string;
  /** Bônus por nível (fração: 0.01 = 1%) */
  perLevel: number;
  /** Bônus máximo (fração) */
  maxBonus: number;
}

export const SKILL_INFO: Record<SkillId, SkillInfo> = {
  endurance: {
    name: "Resistência",
    description: "Menos cansaço durante a raid.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  strength: {
    name: "Força",
    description: "Carrega mais peso sem perder velocidade.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  health: {
    name: "Saúde",
    description: "Remédios curam mais.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  vitality: {
    name: "Vitalidade",
    description: "Mais chance de sobreviver a ferimentos graves.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  metabolism: {
    name: "Metabolismo",
    description: "Comida e bebida rendem mais.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  perception: {
    name: "Percepção",
    description: "Encontra mais loot e percebe perigos antes.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  stealth: {
    name: "Furtividade",
    description: "Menos chance de ser notado.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  aim: {
    name: "Mira",
    description: "Acerta mais nos combates.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  magDrills: {
    name: "Manuseio de carregador",
    description: "Carrega e descarrega carregadores mais rápido.",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
};

/** Nível máximo de uma skill */
export const MAX_SKILL_LEVEL = 51;

export type SkillsState = Record<SkillId, number>;

/** Todas as skills com 0 de XP */
export function createSkills(): SkillsState {
  return Object.fromEntries(SKILLS.map((id) => [id, 0])) as SkillsState;
}

/** XP total para chegar ao nível `level` da skill: 10 + 20 + ... + 10·level */
export function skillXpForLevel(level: number): number {
  const n = Math.max(0, Math.min(MAX_SKILL_LEVEL, Math.floor(level)));
  return (10 * n * (n + 1)) / 2;
}

export function skillLevel(xp: number): number {
  let level = 0;
  while (level < MAX_SKILL_LEVEL && xp >= skillXpForLevel(level + 1)) level++;
  return level;
}

/** Progresso dentro do nível atual da skill */
export function skillProgress(xp: number): { current: number; needed: number } {
  const level = skillLevel(xp);
  if (level === MAX_SKILL_LEVEL) return { current: 0, needed: 0 };
  const start = skillXpForLevel(level);
  return { current: xp - start, needed: skillXpForLevel(level + 1) - start };
}

/** Adiciona XP à skill e devolve quantos níveis ela subiu */
export function addSkillXp(
  skills: SkillsState,
  id: SkillId,
  amount: number,
): number {
  if (amount <= 0) return 0;
  const before = skillLevel(skills[id]);
  skills[id] += amount;
  return skillLevel(skills[id]) - before;
}

/** Bônus da skill (fração), limitado ao máximo */
export function skillBonus(skills: SkillsState, id: SkillId): number {
  const info = SKILL_INFO[id];
  return Math.min(info.maxBonus, skillLevel(skills[id]) * info.perLevel);
}
