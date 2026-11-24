import { Container, Graphics } from "pixi.js";

import type { Grid } from "../../core/inventory/grid.ts";
import type { GridLocation, Item } from "../../core/inventory/item.ts";
import { theme } from "../theme.ts";
import { ItemView } from "./ItemView.ts";
import { CELL } from "./layout.ts";

export const HIGHLIGHT_OK = 0x4caf50;
export const HIGHLIGHT_BAD = 0xd9534f;

/** Desenho de uma grade com os itens dentro dela */
export class GridView extends Container {
  readonly cells = new Graphics();
  readonly itemLayer = new Container();
  readonly highlight = new Graphics();
  readonly itemViews = new Map<Item, ItemView>();

  constructor(readonly grid: Grid) {
    super({ label: "grid" });
    this.drawCells();
    this.highlight.visible = false;
    this.addChild(this.cells, this.highlight, this.itemLayer);
    this.refresh();
  }

  get pixelWidth(): number {
    return this.grid.width * CELL;
  }

  get pixelHeight(): number {
    return this.grid.height * CELL;
  }

  /**
   * Faixa visível da grade (y local, em pixels), quando ela rola dentro de
   * uma janela; `null` = toda visível
   */
  clip: { top: number; bottom: number } | null = null;

  /** Se o ponto (em coordenadas locais) está dentro da parte visível da grade */
  containsLocal(x: number, y: number): boolean {
    const top = this.clip?.top ?? 0;
    const bottom = Math.min(this.pixelHeight, this.clip?.bottom ?? Infinity);
    return x >= 0 && y >= top && x < this.pixelWidth && y < bottom;
  }

  /** Recria as views dos itens a partir da grade */
  refresh(): void {
    for (const view of this.itemViews.values())
      view.destroy({ children: true });
    this.itemViews.clear();
    for (const item of this.grid.items()) {
      // Itens de uma grade sempre têm location de grade
      const loc = item.location as GridLocation;
      const view = new ItemView(item, loc.rotated);
      view.position.set(loc.x * CELL, loc.y * CELL);
      this.itemViews.set(item, view);
      this.itemLayer.addChild(view);
    }
  }

  /** Mostra um retângulo de prévia (em células) verde ou vermelho */
  showHighlight(x: number, y: number, w: number, h: number, ok: boolean): void {
    // Limita a prévia à área da grade
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.grid.width, x + w);
    const y1 = Math.min(this.grid.height, y + h);
    this.highlight
      .clear()
      .rect(x0 * CELL, y0 * CELL, (x1 - x0) * CELL, (y1 - y0) * CELL)
      .fill({ color: ok ? HIGHLIGHT_OK : HIGHLIGHT_BAD, alpha: 0.35 });
    this.highlight.visible = true;
  }

  hideHighlight(): void {
    this.highlight.visible = false;
  }

  private drawCells(): void {
    const g = this.cells;
    g.rect(0, 0, this.pixelWidth, this.pixelHeight).fill({
      color: 0x0d0f12,
    });
    for (let x = 0; x <= this.grid.width; x++) {
      g.moveTo(x * CELL, 0).lineTo(x * CELL, this.pixelHeight);
    }
    for (let y = 0; y <= this.grid.height; y++) {
      g.moveTo(0, y * CELL).lineTo(this.pixelWidth, y * CELL);
    }
    g.stroke({ width: 1, color: theme.textMuted, alpha: 0.25 });
  }
}
