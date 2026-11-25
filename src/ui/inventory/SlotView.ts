import { Container, Graphics, Text } from "pixi.js";

import type { Equipment, SlotName } from "../../core/inventory/equipment.ts";
import { theme } from "../theme.ts";
import { HIGHLIGHT_BAD, HIGHLIGHT_OK } from "./GridView.ts";
import { ItemView } from "./ItemView.ts";
import { CELL, fitScale } from "./layout.ts";

/** Tamanho da caixa de cada slot, em células */
export const SLOT_BOX: Record<SlotName, { w: number; h: number }> = {
  primary: { w: 5, h: 2 },
  secondary: { w: 5, h: 2 },
  holster: { w: 2, h: 2 },
  helmet: { w: 2, h: 2 },
  armor: { w: 2, h: 2 },
  rig: { w: 2, h: 2 },
  backpack: { w: 2, h: 2 },
  secure: { w: 2, h: 2 },
  eyewear: { w: 2, h: 1 },
  face: { w: 2, h: 1 },
};

export const SLOT_LABELS: Record<SlotName, string> = {
  primary: "Arma primária",
  secondary: "Arma secundária",
  holster: "Coldre",
  helmet: "Capacete",
  armor: "Colete balístico",
  rig: "Colete tático",
  backpack: "Mochila",
  secure: "Contêiner seguro",
  eyewear: "Óculos",
  face: "Cobertura do rosto",
};

/** Caixa de um slot de equipamento, com o item equipado reduzido para caber */
export class SlotView extends Container {
  readonly frame = new Graphics();
  readonly highlight = new Graphics();
  readonly title: Text;
  itemView: ItemView | null = null;

  constructor(
    readonly equipment: Equipment,
    readonly slot: SlotName,
  ) {
    super({ label: `slot:${slot}` });
    this.title = new Text({
      text: SLOT_LABELS[slot],
      anchor: { x: 0, y: 1 },
      position: { x: 0, y: -2 },
      style: {
        fill: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 11,
      },
    });
    this.frame
      .rect(0, 0, this.pixelWidth, this.pixelHeight)
      .fill({ color: 0x0d0f12 })
      .stroke({ width: 1, color: theme.textMuted, alpha: 0.5 });
    this.highlight
      .rect(0, 0, this.pixelWidth, this.pixelHeight)
      .fill({ color: 0xffffff, alpha: 0.35 });
    this.highlight.visible = false;
    this.addChild(this.frame, this.highlight, this.title);
    this.refresh();
  }

  get pixelWidth(): number {
    return SLOT_BOX[this.slot].w * CELL;
  }

  get pixelHeight(): number {
    return SLOT_BOX[this.slot].h * CELL;
  }

  containsLocal(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.pixelWidth && y < this.pixelHeight;
  }

  /** Recria a view do item equipado */
  refresh(): void {
    this.itemView?.destroy({ children: true });
    this.itemView = null;
    const item = this.equipment.get(this.slot);
    if (!item) return;
    const view = new ItemView(item);
    const { w, h } = view.pixelSize;
    const scale = fitScale(w, h, this.pixelWidth, this.pixelHeight);
    view.scale.set(scale);
    view.position.set(
      (this.pixelWidth - w * scale) / 2,
      (this.pixelHeight - h * scale) / 2,
    );
    this.itemView = view;
    this.addChild(view);
  }

  showHighlight(ok: boolean): void {
    this.highlight.tint = ok ? HIGHLIGHT_OK : HIGHLIGHT_BAD;
    this.highlight.visible = true;
  }

  hideHighlight(): void {
    this.highlight.visible = false;
  }
}
