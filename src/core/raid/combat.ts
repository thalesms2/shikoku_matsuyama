import type { ItemDef } from "../inventory/item.ts";
import type { BodyPart, PmcState } from "../pmc/pmc.ts";
import { skillBonus } from "../pmc/skills.ts";
import type { SkillsState } from "../pmc/skills.ts";
import type { EnemyDef } from "./types.ts";

/** Onde os disparos inimigos acertam o PMC, com o peso de cada parte */
export const HIT_ZONES: readonly { value: BodyPart; weight: number }[] = [
  { value: "head", weight: 10 },
  { value: "thorax", weight: 30 },
  { value: "stomach", weight: 15 },
  { value: "leftArm", weight: 10 },
  { value: "rightArm", weight: 10 },
  { value: "leftLeg", weight: 12.5 },
  { value: "rightLeg", weight: 12.5 },
];

/** Classe que protege cada parte do corpo: capacete (cabeça) e colete (tronco) */
export function protectedBy(part: BodyPart): "helmet" | "armor" | null {
  if (part === "head") return "helmet";
  if (part === "thorax" || part === "stomach") return "armor";
  return null;
}

/** Fração mínima do dano que sempre passa pela armadura */
export const MIN_ARMOR_FACTOR = 0.2;

/**
 * Fração do dano que passa pela armadura. A classe `c` segura munição com
 * penetração abaixo de `c × 10`: o dano cai na proporção
 * `penetração / (c × 10)`, nunca abaixo de `MIN_ARMOR_FACTOR`. Penetração
 * igual ou maior passa inteira.
 */
export function armorFactor(penetration: number, armorClass: number): number {
  if (armorClass <= 0) return 1;
  const threshold = armorClass * 10;
  if (penetration >= threshold) return 1;
  return Math.max(MIN_ARMOR_FACTOR, penetration / threshold);
}

/** Durabilidade perdida por ponto de dano de um acerto na armadura */
export const ARMOR_WEAR = 0.05;

/**
 * Fração do dano que passa por uma armadura gasta: a proteção cai na mesma
 * proporção da durabilidade (`1 − (1 − armorFactor) × durabilidade/máx.`).
 * Quebrada (0), não protege.
 */
export function wornArmorFactor(
  penetration: number,
  armorClass: number,
  durabilityRatio: number,
): number {
  return 1 - (1 - armorFactor(penetration, armorClass)) * durabilityRatio;
}

/**
 * Durabilidade perdida num acerto: `dano × ARMOR_WEAR`, pela metade contra
 * munição fraca e inteira quando a penetração chega à classe
 * (`× (0,5 + 0,5 × min(1, pen / (classe × 10)))`).
 */
export function armorWear(
  damage: number,
  penetration: number,
  armorClass: number,
): number {
  const share =
    armorClass > 0 ? Math.min(1, penetration / (armorClass * 10)) : 1;
  return damage * ARMOR_WEAR * (0.5 + 0.5 * share);
}

export const BASE_HIT_CHANCE = 0.5;
/** Perda de precisão por braço destruído */
export const ARM_PENALTY = 0.15;
export const MAX_HIT_CHANCE = 0.95;
export const MIN_HIT_CHANCE = 0.05;

const clampHit = (p: number) =>
  Math.min(MAX_HIT_CHANCE, Math.max(MIN_HIT_CHANCE, p));

/** Chance de acerto do PMC: base × (1 + Mira), menos braços destruídos */
export function playerHitChance(pmc: PmcState, skills: SkillsState): number {
  const arms = (["leftArm", "rightArm"] as const).filter(
    (p) => pmc.health[p] <= 0,
  ).length;
  return clampHit(
    BASE_HIT_CHANCE * (1 + skillBonus(skills, "aim")) - arms * ARM_PENALTY,
  );
}

/** Precisão extra dos inimigos por nível de dificuldade do mapa acima de 1 */
export const DIFFICULTY_ACCURACY = 0.03;

export function enemyHitChance(enemy: EnemyDef, difficulty: number): number {
  return clampHit(
    enemy.accuracy + DIFFICULTY_ACCURACY * Math.max(0, difficulty - 1),
  );
}

/** Chance do PMC atirar primeiro: 50% + estratégia + metade da Percepção */
export function firstShotChance(
  skills: SkillsState,
  initiative: number,
): number {
  return Math.min(0.9, 0.5 + initiative + skillBonus(skills, "perception") / 2);
}

/** Disparos por troca de tiros: 1 para escopeta, 3 para fuzil, 2 para pistola */
export function burstFor(weapon: ItemDef): number {
  if (weapon.stats?.caliber === "Caliber12g") return 1;
  return weapon.equipSlot === "longWeapon" ? 3 : 2;
}

/** Dano recebido reduzido pela skill Vitalidade (metade do bônus) */
export function vitalityFactor(skills: SkillsState): number {
  return 1 - skillBonus(skills, "vitality") / 2;
}
