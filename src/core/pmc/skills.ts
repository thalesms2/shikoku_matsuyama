/** Skills do PMC, na ordem das categorias */
export const SKILLS = [
  "endurance",
  "strength",
  "health",
  "metabolism",
  "stressResistance",
  "vitality",
  "aim",
  "assaultRifles",
  "boltActionRifles",
  "dmrs",
  "heavyMachineGuns",
  "lightMachineGuns",
  "melee",
  "pistols",
  "revolvers",
  "grenadeLaunchers",
  "shotguns",
  "submachineGuns",
  "throwables",
  "troubleshooting",
  "stealth",
  "crafting",
  "heavyVests",
  "lightVests",
  "hideoutManagement",
  "magDrills",
  "search",
  "surgery",
  "weaponMaintenance",
  "vestMaintenance",
  "attention",
  "charisma",
  "intellect",
  "perception",
] as const;

export type SkillId = (typeof SKILLS)[number];

/** Categorias das skills, na ordem da tela */
export const SKILL_CATEGORIES = [
  "physical",
  "combat",
  "practical",
  "mental",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_CATEGORY_NAMES: Record<SkillCategory, string> = {
  physical: "Físicas",
  combat: "Combate",
  practical: "Práticas",
  mental: "Mentais",
};

export interface SkillInfo {
  name: string;
  description: string;
  category: SkillCategory;
  /** Bônus por nível (fração: 0.01 = 1%) */
  perLevel: number;
  /** Bônus máximo (fração) */
  maxBonus: number;
}

export const SKILL_INFO: Record<SkillId, SkillInfo> = {
  endurance: {
    name: "Resistência",
    description: "Menos cansaço durante a raid.",
    category: "physical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  strength: {
    name: "Força",
    description: "Carrega mais peso sem perder velocidade.",
    category: "physical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  health: {
    name: "Saúde",
    description: "Remédios curam mais.",
    category: "physical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  metabolism: {
    name: "Metabolismo",
    description: "Comida e bebida rendem mais.",
    category: "physical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  stressResistance: {
    name: "Resistência ao estresse",
    description: "Mantém a calma sob fogo (efeito a definir).",
    category: "physical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  vitality: {
    name: "Vitalidade",
    description: "Mais chance de sobreviver a ferimentos graves.",
    category: "physical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  aim: {
    name: "Mira",
    description: "Acerta mais nos combates.",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  assaultRifles: {
    name: "Fuzis de assalto",
    description: "Manejo de fuzis de assalto (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  boltActionRifles: {
    name: "Fuzis de ferrolho",
    description: "Manejo de fuzis de ferrolho (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  dmrs: {
    name: "Fuzis de precisão (DMR)",
    description:
      "Manejo de fuzis de precisão semiautomáticos (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  heavyMachineGuns: {
    name: "Metralhadoras pesadas",
    description: "Manejo de metralhadoras pesadas (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  lightMachineGuns: {
    name: "Metralhadoras leves",
    description: "Manejo de metralhadoras leves (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  melee: {
    name: "Corpo a corpo",
    description: "Luta com armas brancas (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  pistols: {
    name: "Pistolas",
    description: "Manejo de pistolas (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  revolvers: {
    name: "Revólveres",
    description: "Manejo de revólveres (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  grenadeLaunchers: {
    name: "Lança-granadas",
    description: "Manejo de lança-granadas (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  shotguns: {
    name: "Escopetas",
    description: "Manejo de escopetas (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  submachineGuns: {
    name: "Submetralhadoras",
    description: "Manejo de submetralhadoras (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  throwables: {
    name: "Arremessáveis",
    description: "Granadas e outros arremessáveis (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  troubleshooting: {
    name: "Solução de panes",
    description: "Resolve panes da arma mais rápido (efeito a definir).",
    category: "combat",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  stealth: {
    name: "Furtividade",
    description: "Menos chance de ser notado.",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  crafting: {
    name: "Fabricação",
    description: "Produções do esconderijo (efeito a definir).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  heavyVests: {
    name: "Coletes pesados",
    description: "Uso de coletes pesados (efeito a definir).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  lightVests: {
    name: "Coletes leves",
    description: "Uso de coletes leves (efeito a definir).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  hideoutManagement: {
    name: "Gestão do esconderijo",
    description: "Rendimento dos módulos (efeito a definir).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  magDrills: {
    name: "Manuseio de carregador",
    description: "Recarrega mais rápido em combate (efeito na raid nova).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  search: {
    name: "Busca",
    description: "Revista contêineres mais rápido (efeito a definir).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  surgery: {
    name: "Cirurgia",
    description: "Operações mais seguras (efeito a definir).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  weaponMaintenance: {
    name: "Manutenção de armas",
    description: "Cuidado com as armas (efeito a definir).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  vestMaintenance: {
    name: "Manutenção de coletes",
    description: "Cuidado com os coletes (efeito a definir).",
    category: "practical",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  attention: {
    name: "Atenção",
    description:
      "Nota detalhes que passariam despercebidos (efeito a definir).",
    category: "mental",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  charisma: {
    name: "Carisma",
    description: "Negocia melhor com os vendedores (efeito a definir).",
    category: "mental",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  intellect: {
    name: "Intelecto",
    description: "Aprende e analisa mais rápido (efeito a definir).",
    category: "mental",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
  perception: {
    name: "Percepção",
    description: "Encontra mais loot e percebe perigos antes.",
    category: "mental",
    perLevel: 0.01,
    maxBonus: 0.5,
  },
};

/** Skills de uma categoria, na ordem de `SKILLS` */
export function skillsIn(category: SkillCategory): SkillId[] {
  return SKILLS.filter((id) => SKILL_INFO[id].category === category);
}

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
