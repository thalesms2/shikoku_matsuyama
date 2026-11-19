import type { ItemCategory } from "../../core/inventory/item.ts";

/** Tamanho de uma célula da grade, em pixels de layout */
export const CELL = 48;

/** Cor de fundo de cada categoria de item */
export const CATEGORY_COLORS: Record<ItemCategory, number> = {
  weapon: 0x3b3f36,
  ammo: 0x5a4a2a,
  armor: 0x2f3b4a,
  helmet: 0x2f3b4a,
  rig: 0x3a3a4f,
  backpack: 0x3a3a4f,
  container: 0x2d4040,
  medical: 0x5a2d2d,
  food: 0x3d4a2a,
  barter: 0x4a3f2a,
  key: 0x4a4a2a,
  money: 0x2d4a33,
};

/** Nome de cada categoria mostrado ao jogador */
export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: "Arma",
  ammo: "Munição",
  armor: "Colete balístico",
  helmet: "Capacete",
  rig: "Colete tático",
  backpack: "Mochila",
  container: "Contêiner",
  medical: "Médico",
  food: "Comida",
  barter: "Troca",
  key: "Chave",
  money: "Dinheiro",
};

/**
 * Célula onde o canto superior esquerdo do item cai ao soltar, a partir da
 * posição do ponteiro na grade (`localX/Y`) e de onde o item foi agarrado
 * (`grabX/Y`, relativo ao canto do item). Arredonda para a célula mais próxima.
 */
export function dropCell(
  localX: number,
  localY: number,
  grabX: number,
  grabY: number,
  cell = CELL,
): { x: number; y: number } {
  return {
    x: Math.round((localX - grabX) / cell),
    y: Math.round((localY - grabY) / cell),
  };
}

/** Célula sob o ponteiro */
export function cellAt(
  localX: number,
  localY: number,
  cell = CELL,
): { x: number; y: number } {
  return { x: Math.floor(localX / cell), y: Math.floor(localY / cell) };
}

/** Escala para caber um retângulo `w×h` dentro de `boxW×boxH`, sem aumentar */
export function fitScale(
  w: number,
  h: number,
  boxW: number,
  boxH: number,
): number {
  return Math.min(1, boxW / w, boxH / h);
}

/** Formata um preço: 12500 -> "12.500 ₽" */
export function formatPrice(value: number): string {
  return `${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₽`;
}

/** Quantidade compacta para caber na célula: 150000 -> "150k", 2500000 -> "2.5M" */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`;
  return String(n);
}
