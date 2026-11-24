import { CORE_DEFAULTS, coreBalance } from "../balance.ts";
import type { Item, ItemStats } from "../inventory/item.ts";
import { detach } from "../inventory/operations.ts";
import { changeEnergy, changeHydration, heal } from "./pmc.ts";
import type { PmcState } from "./pmc.ts";
import { addSkillXp, skillBonus } from "./skills.ts";
import type { SkillsState } from "./skills.ts";

/** XP de skill por uso de consumível */
export const CONSUMABLE_SKILL_XP = CORE_DEFAULTS.xp.consumableSkill;
/** XP de "Manuseio de carregador" por cartucho carregado/descarregado */
export const MAG_DRILLS_XP_PER_ROUND = CORE_DEFAULTS.xp.magDrillsPerRound;

/** Se o item pode ser usado pelo PMC (cura, energia ou hidratação) */
export function isConsumable(item: Item): boolean {
  const s = item.def.stats;
  return (
    (item.def.category === "medical" || item.def.category === "food") &&
    !!s &&
    (s.heal !== undefined ||
      s.energy !== undefined ||
      s.hydration !== undefined)
  );
}

export interface UseResult {
  healed: number;
  energy: number;
  hydration: number;
}

/**
 * Usa uma unidade do item no PMC. Remédios curam (com bônus da skill Saúde),
 * comida e bebida recuperam energia e hidratação (com bônus de Metabolismo).
 * A unidade é consumida; o item some se a pilha acabar. Devolve `null` se o
 * item não for consumível.
 */
export function useConsumable(
  item: Item,
  pmc: PmcState,
  skills: SkillsState,
): UseResult | null {
  if (!isConsumable(item)) return null;
  // isConsumable garante que há stats
  const s = item.def.stats as ItemStats;
  const before = { energy: pmc.energy, hydration: pmc.hydration };

  let healed = 0;
  if (s.heal !== undefined) {
    healed = heal(pmc, s.heal * (1 + skillBonus(skills, "health")));
    addSkillXp(skills, "health", coreBalance().xp.consumableSkill);
  }
  const food = 1 + skillBonus(skills, "metabolism");
  if (s.energy !== undefined) changeEnergy(pmc, s.energy * food);
  if (s.hydration !== undefined) changeHydration(pmc, s.hydration * food);
  if (s.energy !== undefined || s.hydration !== undefined) {
    addSkillXp(skills, "metabolism", coreBalance().xp.consumableSkill);
  }

  item.count -= 1;
  if (item.count <= 0) detach(item);
  return {
    healed,
    energy: pmc.energy - before.energy,
    hydration: pmc.hydration - before.hydration,
  };
}

/** XP de Manuseio de carregador por cartucho (valor atual do balanceamento) */
export function magDrillsXpPerRound(): number {
  return coreBalance().xp.magDrillsPerRound;
}
