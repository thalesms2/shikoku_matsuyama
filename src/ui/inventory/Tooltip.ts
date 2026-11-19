import { Container, Graphics, Text } from "pixi.js";

import type { Item } from "../../core/inventory/item.ts";
import { totalValue } from "../../core/inventory/item.ts";
import { maxStack } from "../../core/inventory/size.ts";
import { theme } from "../theme.ts";
import { CATEGORY_LABELS, formatPrice } from "./layout.ts";

const WIDTH = 220;
const LINE = 16;

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
  return lines;
}

/** Caixa de informações mostrada ao passar o mouse sobre um item */
export class Tooltip extends Container {
  readonly background = new Graphics();
  readonly text: Text;

  constructor() {
    super({ label: "tooltip", eventMode: "none", visible: false });
    this.text = new Text({
      text: "",
      position: { x: 8, y: 6 },
      style: {
        fill: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: 12,
        lineHeight: LINE,
        wordWrap: true,
        wordWrapWidth: WIDTH - 16,
      },
    });
    this.addChild(this.background, this.text);
  }

  show(item: Item, x: number, y: number): void {
    const lines = describeItem(item);
    this.text.text = lines.join("\n");
    this.background
      .clear()
      .rect(0, 0, WIDTH, lines.length * LINE + 12)
      .fill({ color: 0x0b0c0e, alpha: 0.95 })
      .stroke({ width: 1, color: theme.accent, alpha: 0.6 });
    this.position.set(x + 16, y + 16);
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
