import type { Equipment } from "./equipment.ts";

/** Bônus de d20 do equipamento vestido, para a disputa de percepção da raid */
export interface GearBonuses {
  /** Soma de `perceptionBonus` (óculos, cobertura do rosto) */
  readonly perception: number;
  /** Soma de `stealthBonus` (óculos, cobertura do rosto) */
  readonly stealth: number;
  /** Soma de `visibility` (mochilas coloridas ou enormes) */
  readonly visibility: number;
}

/** Soma os bônus de percepção, furtividade e visibilidade dos itens vestidos */
export function gearBonuses(equipment: Equipment): GearBonuses {
  let perception = 0;
  let stealth = 0;
  let visibility = 0;
  for (const item of equipment.equipped()) {
    const stats = item.def.stats;
    perception += stats?.perceptionBonus ?? 0;
    stealth += stats?.stealthBonus ?? 0;
    visibility += stats?.visibility ?? 0;
  }
  return { perception, stealth, visibility };
}
