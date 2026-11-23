/** Partes do corpo do PMC */
export const BODY_PARTS = [
  "head",
  "thorax",
  "stomach",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

/** Vida máxima de cada parte do corpo */
export const MAX_HEALTH: Record<BodyPart, number> = {
  head: 35,
  thorax: 85,
  stomach: 70,
  leftArm: 60,
  rightArm: 60,
  leftLeg: 65,
  rightLeg: 65,
};

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  head: "Cabeça",
  thorax: "Tórax",
  stomach: "Estômago",
  leftArm: "Braço esquerdo",
  rightArm: "Braço direito",
  leftLeg: "Perna esquerda",
  rightLeg: "Perna direita",
};

/** Partes que matam o PMC quando chegam a zero */
export const VITAL_PARTS: readonly BodyPart[] = ["head", "thorax"];

/** Fração do dano em parte destruída que se espalha para as outras */
export const SPREAD_FACTOR = 0.7;

export const MAX_ENERGY = 100;
export const MAX_HYDRATION = 100;
/** Nível máximo do PMC */
export const MAX_LEVEL = 60;

export interface PmcState {
  name: string;
  xp: number;
  health: Record<BodyPart, number>;
  energy: number;
  hydration: number;
}

/** PMC novo, com vida, energia e hidratação cheias */
export function createPmc(name = "PMC"): PmcState {
  return {
    name,
    xp: 0,
    health: { ...MAX_HEALTH },
    energy: MAX_ENERGY,
    hydration: MAX_HYDRATION,
  };
}

/** XP total necessário para chegar ao nível `level` (nível 1 = 0 XP) */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return (1000 * n * (n - 1)) / 2;
}

/** Nível correspondente ao XP total */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Progresso dentro do nível atual: XP ganho e XP necessário */
export function levelProgress(xp: number): { current: number; needed: number } {
  const level = levelForXp(xp);
  if (level === MAX_LEVEL) return { current: 0, needed: 0 };
  const start = xpForLevel(level);
  return { current: xp - start, needed: xpForLevel(level + 1) - start };
}

/** Adiciona XP ao PMC e devolve quantos níveis ele subiu */
export function addPmcXp(pmc: PmcState, amount: number): number {
  if (amount <= 0) return 0;
  const before = levelForXp(pmc.xp);
  pmc.xp += amount;
  return levelForXp(pmc.xp) - before;
}

export function totalHealth(pmc: PmcState): number {
  return BODY_PARTS.reduce((sum, part) => sum + pmc.health[part], 0);
}

export function totalMaxHealth(): number {
  return BODY_PARTS.reduce((sum, part) => sum + MAX_HEALTH[part], 0);
}

export function isDead(pmc: PmcState): boolean {
  return VITAL_PARTS.some((part) => pmc.health[part] <= 0);
}

/**
 * Aplica dano em uma parte do corpo. Dano em parte já destruída (que não seja
 * vital) se espalha para as outras partes vivas, multiplicado por
 * `SPREAD_FACTOR` e dividido igualmente. O excesso de dano em uma parte viva
 * é perdido.
 */
export function damage(pmc: PmcState, part: BodyPart, amount: number): void {
  if (amount <= 0 || isDead(pmc)) return;
  if (pmc.health[part] > 0) {
    pmc.health[part] = Math.max(0, pmc.health[part] - amount);
    return;
  }
  const alive = BODY_PARTS.filter((p) => pmc.health[p] > 0);
  const share = (amount * SPREAD_FACTOR) / alive.length;
  for (const p of alive) {
    pmc.health[p] = Math.max(0, pmc.health[p] - share);
  }
}

/**
 * Cura até `amount` pontos de vida, distribuídos pelas partes mais feridas
 * primeiro (vitais têm prioridade em empate). Partes destruídas (0) não são
 * curadas por remédios comuns. Devolve quanto foi curado.
 */
export function heal(pmc: PmcState, amount: number): number {
  let left = Math.max(0, amount);
  const injured = BODY_PARTS.filter(
    (p) => pmc.health[p] > 0 && pmc.health[p] < MAX_HEALTH[p],
  ).sort(
    (a, b) =>
      pmc.health[a] / MAX_HEALTH[a] - pmc.health[b] / MAX_HEALTH[b] ||
      Number(VITAL_PARTS.includes(b)) - Number(VITAL_PARTS.includes(a)),
  );
  for (const part of injured) {
    if (left <= 0) break;
    const missing = MAX_HEALTH[part] - pmc.health[part];
    const amountHere = Math.min(missing, left);
    pmc.health[part] += amountHere;
    left -= amountHere;
  }
  return Math.max(0, amount) - left;
}

/** Recupera uma parte destruída para 1 PV (cirurgia, Fase 3) */
export function restorePart(pmc: PmcState, part: BodyPart): boolean {
  if (pmc.health[part] > 0) return false;
  pmc.health[part] = 1;
  return true;
}

/** Soma energia (negativo gasta), limitada entre 0 e o máximo */
export function changeEnergy(pmc: PmcState, amount: number): void {
  pmc.energy = Math.min(MAX_ENERGY, Math.max(0, pmc.energy + amount));
}

/** Soma hidratação (negativo gasta), limitada entre 0 e o máximo */
export function changeHydration(pmc: PmcState, amount: number): void {
  pmc.hydration = Math.min(MAX_HYDRATION, Math.max(0, pmc.hydration + amount));
}
