import { CORE_DEFAULTS, coreBalance } from "../balance.ts";
import type { Item, ItemDef } from "./item.ts";

/** Fração do valor que sobra com a durabilidade em 0 */
export const BROKEN_VALUE = CORE_DEFAULTS.durability.brokenValue;

/** Durabilidade máxima do tipo (0 = o item não tem durabilidade) */
export function maxDurability(def: ItemDef): number {
  return def.stats?.durability ?? 0;
}

/** Durabilidade atual (sem o campo = inteira) */
export function durabilityOf(item: Item): number {
  return item.durability ?? maxDurability(item.def);
}

/** Durabilidade atual / máxima (1 para itens sem durabilidade) */
export function durabilityRatio(item: Item): number {
  const max = maxDurability(item.def);
  return max > 0 ? durabilityOf(item) / max : 1;
}

/** Se o item tem durabilidade e ela não está cheia */
export function isDamaged(item: Item): boolean {
  return durabilityRatio(item) < 1;
}

/** Tira durabilidade (sem passar de 0); devolve quanto tirou */
export function wear(item: Item, amount: number): number {
  const current = durabilityOf(item);
  const next = Math.max(0, current - amount);
  item.durability = next;
  return current - next;
}

/** Volta a durabilidade ao máximo */
export function restoreDurability(item: Item): void {
  delete item.durability;
}

/**
 * Multiplicador do valor pela durabilidade: `BROKEN_VALUE` em 0, 1 inteira
 * (e para itens sem durabilidade).
 */
export function durabilityValueFactor(item: Item): number {
  const ratio = durabilityRatio(item);
  // inteira = exatamente 1 (sem erro de ponto flutuante)
  const broken = coreBalance().durability.brokenValue;
  return ratio === 1 ? 1 : broken + (1 - broken) * ratio;
}
