import { Container } from "pixi.js";

import { Button } from "./Button.ts";

export interface MenuOption {
  label: string;
  run: () => void;
}

export const MENU_WIDTH = 170;
export const MENU_ITEM_HEIGHT = 24;

/** Menu de opções aberto com o botão direito */
export class ContextMenu extends Container {
  buttons: Button[] = [];

  constructor() {
    super({ label: "context-menu", eventMode: "static", visible: false });
  }

  /** Abre o menu em (x, y). Sem opções, não abre. */
  show(x: number, y: number, options: readonly MenuOption[]): void {
    this.clear();
    if (options.length === 0) return;
    this.buttons = options.map((option, i) => {
      const button = new Button(
        option.label,
        () => {
          this.hide();
          option.run();
        },
        MENU_WIDTH,
        MENU_ITEM_HEIGHT,
      );
      button.position.set(0, i * MENU_ITEM_HEIGHT);
      return button;
    });
    this.addChild(...this.buttons);
    this.position.set(x, y);
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.clear();
  }

  private clear(): void {
    for (const button of this.buttons) button.destroy({ children: true });
    this.buttons = [];
  }
}
