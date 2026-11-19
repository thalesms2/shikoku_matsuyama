import { Container, Graphics, Text } from "pixi.js";

import type { Item } from "../../core/inventory/item.ts";
import { footprint, maxStack } from "../../core/inventory/size.ts";
import { theme } from "../theme.ts";
import { CATEGORY_COLORS, CELL, formatCount } from "./layout.ts";

/** Desenho de um item: retângulo do tamanho das células, nome e quantidade */
export class ItemView extends Container {
  readonly background = new Graphics();
  readonly nameText: Text;
  readonly countLabel: Text;

  constructor(
    readonly item: Item,
    public rotated = false,
  ) {
    super({ label: `item:${item.uid}` });
    this.nameText = new Text({
      text: item.def.shortName,
      anchor: { x: 1, y: 0 },
      style: {
        fill: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: 11,
      },
    });
    this.countLabel = new Text({
      text: "",
      anchor: { x: 1, y: 1 },
      style: {
        fill: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: 12,
        fontWeight: "bold",
      },
    });
    this.addChild(this.background, this.nameText, this.countLabel);
    this.redraw();
  }

  /** Tamanho em pixels, considerando a rotação */
  get pixelSize(): { w: number; h: number } {
    const { w, h } = footprint(this.item.def, this.rotated);
    return { w: w * CELL, h: h * CELL };
  }

  setRotated(rotated: boolean): void {
    this.rotated = rotated;
    this.redraw();
  }

  /** Redesenha a partir do estado atual do item */
  redraw(): void {
    const { w, h } = this.pixelSize;
    this.background
      .clear()
      .rect(1, 1, w - 2, h - 2)
      .fill({ color: CATEGORY_COLORS[this.item.def.category] })
      .stroke({ width: 1, color: theme.textMuted, alpha: 0.6 });
    this.nameText.position.set(w - 4, 2);
    this.countLabel.position.set(w - 4, h - 2);
    this.countLabel.text =
      maxStack(this.item.def) > 1 ? formatCount(this.item.count) : "";
  }
}
