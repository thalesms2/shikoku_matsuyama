import { Container, Graphics, Sprite, Text } from "pixi.js";

import type { Item } from "../../core/inventory/item.ts";
import {
  capacity,
  feedOf,
  isMagazine,
  isWeapon,
  loadedRounds,
} from "../../core/inventory/magazine.ts";
import { footprint, maxStack } from "../../core/inventory/size.ts";
import { theme } from "../theme.ts";
import { CATEGORY_COLORS, CELL, formatCount } from "./layout.ts";
import { itemTexture } from "./textures.ts";

/** Desenho de um item: retângulo do tamanho das células, nome e quantidade */
export class ItemView extends Container {
  readonly background = new Graphics();
  readonly nameText: Text;
  readonly countLabel: Text;
  /** Imagem do item, se a textura estiver carregada */
  readonly sprite: Sprite | null;
  /** Barra de progresso (carregamento de carregador) */

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
    const texture = itemTexture(item.def.id);
    this.sprite = texture ? new Sprite({ texture }) : null;
    this.addChild(this.background);
    if (this.sprite) this.addChild(this.sprite);
    this.addChild(this.nameText, this.countLabel);
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
    if (this.sprite) {
      // A imagem é desenhada em pé; girada 90° quando o item está rotacionado
      const { def } = this.item;
      this.sprite.setSize(def.width * CELL - 2, def.height * CELL - 2);
      this.sprite.rotation = this.rotated ? Math.PI / 2 : 0;
      this.sprite.position.set(this.rotated ? w - 1 : 1, 1);
    }
    this.nameText.position.set(w - 4, 2);
    this.countLabel.position.set(w - 4, h - 2);
    this.countLabel.text = countText(this.item);
  }
}

/**
 * Texto do canto inferior: pilha, munição do carregador ou da arma (o
 * cartucho da câmara aparece como "+1")
 */
export function countText(item: Item): string {
  if (isMagazine(item)) return `${loadedRounds(item)}/${capacity(item)}`;
  if (isWeapon(item)) {
    const feed = feedOf(item);
    const chamber = item.chamber ? "+1" : "";
    if (feed) return `${loadedRounds(feed)}${chamber}/${capacity(feed)}`;
    if (item.chamber) return "1";
  }
  return maxStack(item.def) > 1 ? formatCount(item.count) : "";
}
