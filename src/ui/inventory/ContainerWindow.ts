import { Container, Graphics, Text } from "pixi.js";

import type { Item } from "../../core/inventory/item.ts";
import { Button } from "../components/Button.ts";
import { theme } from "../theme.ts";
import { GridView } from "./GridView.ts";

const PAD = 10;
const HEADER = 30;
const GAP = 6;

/** Janela que mostra as grades internas de um contêiner aberto */
export class ContainerWindow extends Container {
  readonly frame = new Graphics();
  readonly title: Text;
  readonly closeButton: Button;
  readonly gridViews: GridView[];

  constructor(
    readonly item: Item,
    onClose: () => void,
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
  }

  refresh(): void {
    for (const view of this.gridViews) view.refresh();
  }
}
