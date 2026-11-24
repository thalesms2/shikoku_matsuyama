import { Container, Graphics, Text } from "pixi.js";
import type { FederatedPointerEvent } from "pixi.js";

import type { Item } from "../../core/inventory/item.ts";
import { Button } from "../components/Button.ts";
import { theme } from "../theme.ts";
import { GridView } from "./GridView.ts";

const PAD = 10;
/** Altura da barra de título, por onde a janela é arrastada */
export const WINDOW_HEADER = 30;
const HEADER = WINDOW_HEADER;
const GAP = 6;

/**
 * Janela que mostra as grades internas de um contêiner aberto. Arrasta pela
 * barra de título; qualquer clique nela chama `onFocus` (trazer para frente).
 */
export class ContainerWindow extends Container {
  readonly frame = new Graphics();
  readonly title: Text;
  readonly closeButton: Button;
  readonly gridViews: GridView[];
  /** Arrastando a janela: distância entre o ponteiro e o canto da janela */
  private grab: { x: number; y: number } | null = null;

  constructor(
    readonly item: Item,
    onClose: () => void,
    onFocus: () => void = () => {},
  ) {
    super({ label: `window:${item.uid}`, eventMode: "static" });
    this.gridViews = item.grids.map((grid) => new GridView(grid));
    let x = PAD;
    let height = 0;
    for (const view of this.gridViews) {
      view.position.set(x, HEADER);
      x += view.pixelWidth + GAP;
      height = Math.max(height, view.pixelHeight);
    }
    const width = Math.max(x - GAP + PAD, 160);
    this.frame
      .rect(0, 0, width, HEADER + height + PAD)
      .fill({ color: 0x17191d, alpha: 0.98 })
      .stroke({ width: 1, color: theme.accent });
    this.title = new Text({
      text: item.def.name,
      position: { x: PAD, y: 7 },
      style: { fill: theme.text, fontFamily: theme.fontFamily, fontSize: 14 },
    });
    this.closeButton = new Button("X", onClose, 22, 20);
    this.closeButton.position.set(width - 26, 5);
    this.addChild(this.frame, this.title, this.closeButton, ...this.gridViews);

    this.on("pointerdown", (e: FederatedPointerEvent) => {
      onFocus();
      const local = this.toLocal(e.global);
      if (local.y < HEADER && e.target !== this.closeButton) {
        this.grab = { x: local.x, y: local.y };
      }
    });
    this.on("globalpointermove", (e: FederatedPointerEvent) => {
      this.dragTo(e.global);
    });
    const release = () => {
      this.grab = null;
    };
    this.on("pointerup", release);
    this.on("pointerupoutside", release);
  }

  /** Se a janela está sendo arrastada pela barra de título */
  get dragging(): boolean {
    return this.grab !== null;
  }

  /** Move a janela para o ponto global, mantendo onde ela foi agarrada */
  dragTo(global: { x: number; y: number }): void {
    const grab = this.grab;
    if (!grab || !this.parent) return;
    const p = this.parent.toLocal(global);
    this.position.set(p.x - grab.x, p.y - grab.y);
  }

  refresh(): void {
    for (const view of this.gridViews) view.refresh();
  }
}
