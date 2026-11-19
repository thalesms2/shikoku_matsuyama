import type { ItemDef } from "./item.ts";

/** Máximo por pilha (1 = não empilhável) */
export function maxStack(def: ItemDef): number {
  return def.maxStack ?? 1;
}

/** Tamanho ocupado pelo item em células, considerando a rotação */
export function footprint(
  def: ItemDef,
  rotated: boolean,
): { w: number; h: number } {
  return rotated
    ? { w: def.height, h: def.width }
    : { w: def.width, h: def.height };
}
