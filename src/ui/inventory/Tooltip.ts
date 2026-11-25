import { Container, Graphics, Sprite, Text } from "pixi.js";

import type { Item, RoundStack } from "../../core/inventory/item.ts";
import { totalValue } from "../../core/inventory/item.ts";
import {
  capacity,
  hasInternalMagazine,
  isMagazine,
  loadedRounds,
} from "../../core/inventory/magazine.ts";
import { maxStack } from "../../core/inventory/size.ts";
import { SKILL_INFO } from "../../core/pmc/skills.ts";
import type { SkillId } from "../../core/pmc/skills.ts";
import { theme } from "../theme.ts";
import { CATEGORY_LABELS, fitScale, formatPrice } from "./layout.ts";
import { itemTexture } from "./textures.ts";

export const TOOLTIP_WIDTH = 240;
const LINE = 16;
const PAD = 8;
const GAP = 6;
/** Altura máxima da imagem no tooltip */
export const TOOLTIP_IMAGE_MAX = 96;
/** Caracteres por linha da descrição (fonte de 12px em 224px) */
export const DESCRIPTION_CHARS = 36;
/** Distância entre o ponteiro e o tooltip */
const OFFSET = 16;

/** Linhas de texto descrevendo o item */
export function describeItem(item: Item): string[] {
  const { def } = item;
  const lines = [
    def.name,
    `${def.width}x${def.height} · ${CATEGORY_LABELS[def.category]}`,
  ];
  if (maxStack(def) > 1)
    lines.push(`Quantidade: ${item.count}/${maxStack(def)}`);
  lines.push(`Valor: ${formatPrice(totalValue(item))}`);
  if (item.grids.length > 0) {
    const cells = item.grids.reduce((n, g) => n + g.width * g.height, 0);
    lines.push(`Contêiner: ${cells} células (duplo clique para abrir)`);
  }
  if (item.fir) lines.push("Encontrado na raid ✓");
  return lines;
}

const CALIBERS: Record<string, string> = {
  Caliber545x39: "5.45x39",
  Caliber556x45NATO: "5.56x45 NATO",
  Caliber762x39: "7.62x39",
  Caliber762x51: "7.62x51 NATO",
  Caliber762x54R: "7.62x54R",
  Caliber9x19PARA: "9x19 Parabellum",
  Caliber9x18PM: "9x18 PM",
  Caliber9x39: "9x39",
  Caliber1143x23ACP: ".45 ACP",
  Caliber12g: "12 gauge",
  Caliber20g: "20 gauge",
  Caliber357Magnum: ".357 Magnum",
};

/** Nome legível do calibre: "Caliber545x39" -> "5.45x39" */
export function formatCaliber(caliber: string): string {
  return CALIBERS[caliber] ?? caliber.replace(/^Caliber/, "");
}

/** Cartuchos do carregador ou do tubo, do topo para baixo */
function roundLines(feed: Item, label: string): string[] {
  const lines = [`${label}: ${loadedRounds(feed)}/${capacity(feed)}`];
  // Carregadores e tubos sempre têm `rounds`
  const rounds = feed.rounds as RoundStack[];
  for (const round of [...rounds].reverse()) {
    lines.push(`  ${round.def.name} x${round.count}`);
  }
  return lines;
}

/**
 * Munição carregada (carregadores e tubos), carregador encaixado (armas) e o
 * cartucho na câmara
 */
export function ammoSheet(item: Item): string[] {
  if (isMagazine(item)) return roundLines(item, "Munição");
  const chamber = item.chamber ? [`Câmara: ${item.chamber.name}`] : [];
  if (hasInternalMagazine(item)) {
    return [...roundLines(item, "Tubo"), ...chamber];
  }
  if (item.magazine === undefined) return [];
  const mag = item.magazine;
  return [
    mag
      ? `Carregador: ${mag.def.name} (${loadedRounds(mag)}/${capacity(mag)})`
      : "Sem carregador",
    ...chamber,
  ];
}

/** Ficha técnica conforme os dados do item */
export function itemSheet(item: Item): string[] {
  const stats = item.def.stats;
  if (!stats) return ammoSheet(item);
  const lines: string[] = [];
  if (stats.caliber) lines.push(`Calibre: ${formatCaliber(stats.caliber)}`);
  if (stats.damage !== undefined) lines.push(`Dano: ${stats.damage}`);
  if (stats.penetration !== undefined) {
    lines.push(`Penetração: ${stats.penetration}`);
  }
  if (stats.armorClass !== undefined) {
    lines.push(`Classe de proteção: ${stats.armorClass}`);
  }
  if (stats.durability !== undefined) {
    // gasta: atual/máx. (arredondado para cima: 0 só quando quebrou)
    lines.push(
      item.durability === undefined
        ? `Durabilidade: ${stats.durability}`
        : `Durabilidade: ${Math.ceil(item.durability)}/${stats.durability}`,
    );
  }
  if (stats.capacity !== undefined) {
    lines.push(`Capacidade: ${stats.capacity} cartuchos`);
  }
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (stats.heal !== undefined) lines.push(`Cura: ${stats.heal} PV`);
  if (stats.energy !== undefined) {
    lines.push(`Energia: ${signed(stats.energy)}`);
  }
  if (stats.hydration !== undefined) {
    lines.push(`Hidratação: ${signed(stats.hydration)}`);
  }
  if (stats.surgery !== undefined) {
    lines.push(`Cirurgia na raid: ${stats.surgery} min`);
  }
  if (stats.weaponClass && stats.weaponClass in SKILL_INFO) {
    lines.push(`Tipo: ${SKILL_INFO[stats.weaponClass as SkillId].name}`);
  }
  if (stats.damageDie !== undefined) {
    lines.push(`Dado de dano: d${stats.damageDie}`);
  }
  if (stats.damageBonus !== undefined) {
    lines.push(`Bônus de dano: ${signed(stats.damageBonus)}`);
  }
  if (stats.vestType) {
    lines.push(stats.vestType === "heavy" ? "Colete pesado" : "Colete leve");
  }
  if (stats.visibility !== undefined && stats.visibility > 0) {
    lines.push(`Chama atenção: +${stats.visibility}`);
  }
  if (stats.perceptionBonus !== undefined) {
    lines.push(`Percepção: ${signed(stats.perceptionBonus)}`);
  }
  if (stats.stealthBonus !== undefined) {
    lines.push(`Furtividade: ${signed(stats.stealthBonus)}`);
  }
  return [...lines, ...ammoSheet(item)];
}

/** Quebra o texto em linhas de até `maxChars` caracteres, por palavras */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      while (word.length > maxChars) {
        if (line) lines.push(line);
        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
        line = "";
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Área visível onde o tooltip deve caber */
export interface TooltipBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Caixa de informações mostrada ao passar o mouse sobre um item */
export class Tooltip extends Container {
  readonly background = new Graphics();
  /** Nome, dados básicos e ficha técnica */
  readonly text: Text;
  readonly descriptionText: Text;
  image: Sprite | null = null;
  private size = { width: TOOLTIP_WIDTH, height: 0 };

  constructor() {
    super({ label: "tooltip", eventMode: "none", visible: false });
    const style = {
      fill: theme.text,
      fontFamily: theme.fontFamily,
      fontSize: 12,
      lineHeight: LINE,
    };
    this.text = new Text({ text: "", style });
    this.descriptionText = new Text({
      text: "",
      style: { ...style, fill: theme.textMuted, fontStyle: "italic" },
    });
    this.addChild(this.background, this.text, this.descriptionText);
  }

  get boxWidth(): number {
    return this.size.width;
  }

  get boxHeight(): number {
    return this.size.height;
  }

  /**
   * Mostra o tooltip perto de (x, y). Com `bounds`, muda de lado ou sobe
   * para não sair da área visível.
   */
  show(item: Item, x: number, y: number, bounds?: TooltipBounds): void {
    let top = PAD;

    this.image?.destroy();
    this.image = null;
    const texture = itemTexture(item.def.id);
    if (texture) {
      const image = new Sprite({ texture });
      const w = item.def.width * 64;
      const h = item.def.height * 64;
      const scale = fitScale(w, h, TOOLTIP_WIDTH - PAD * 2, TOOLTIP_IMAGE_MAX);
      image.setSize(w * scale, h * scale);
      image.position.set((TOOLTIP_WIDTH - w * scale) / 2, top);
      this.addChild(image);
      this.image = image;
      top += h * scale + GAP;
    }

    const lines = [...describeItem(item), ...itemSheet(item)];
    this.text.text = lines.join("\n");
    this.text.position.set(PAD, top);
    top += lines.length * LINE;

    const description = item.def.description
      ? wrapText(item.def.description, DESCRIPTION_CHARS)
      : [];
    this.descriptionText.text = description.join("\n");
    this.descriptionText.visible = description.length > 0;
    if (description.length > 0) {
      top += GAP;
      this.descriptionText.position.set(PAD, top);
      top += description.length * LINE;
    }

    this.size = { width: TOOLTIP_WIDTH, height: top + PAD };
    this.background
      .clear()
      .rect(0, 0, this.size.width, this.size.height)
      .fill({ color: 0x0b0c0e, alpha: 0.95 })
      .stroke({ width: 1, color: theme.accent, alpha: 0.6 });

    this.position.set(...this.place(x, y, bounds));
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  private place(x: number, y: number, b?: TooltipBounds): [number, number] {
    let px = x + OFFSET;
    let py = y + OFFSET;
    if (!b) return [px, py];
    const { width, height } = this.size;
    if (px + width > b.x + b.width) px = x - OFFSET - width;
    if (py + height > b.y + b.height) py = b.y + b.height - height;
    return [Math.max(b.x, px), Math.max(b.y, py)];
  }
}
