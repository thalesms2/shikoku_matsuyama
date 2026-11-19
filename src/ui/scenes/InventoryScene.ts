import { Container, Text } from "pixi.js";
import type { FederatedPointerEvent } from "pixi.js";

import { systemClock } from "../../core/clock.ts";
import type { Clock } from "../../core/clock.ts";
import type { SlotName } from "../../core/inventory/equipment.ts";
import type { Item } from "../../core/inventory/item.ts";
import { sortGrid } from "../../core/inventory/operations.ts";
import type { InventoryState } from "../../data/starter.ts";
import { Button } from "../components/Button.ts";
import { ContainerWindow } from "../inventory/ContainerWindow.ts";
import { DragController } from "../inventory/DragController.ts";
import type { DropTargets } from "../inventory/DragController.ts";
import { GridView } from "../inventory/GridView.ts";
import type { ItemView } from "../inventory/ItemView.ts";
import { CELL } from "../inventory/layout.ts";
import { SlotView } from "../inventory/SlotView.ts";
import { Tooltip } from "../inventory/Tooltip.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";

/** Intervalo máximo entre dois cliques para contar como duplo clique */
export const DOUBLE_CLICK_MS = 350;

const GAP = 12;
const LABEL = 18;
const ROW_TOP = 40;
const SLOT_ROWS: SlotName[][] = [
  ["helmet", "armor", "rig", "backpack", "secure"],
  ["primary", "secondary"],
  ["holster"],
];
const CONTAINER_SECTIONS: [SlotName, string][] = [
  ["rig", "Colete tático"],
  ["backpack", "Mochila"],
  ["secure", "Contêiner seguro"],
];
export const STASH_X = 700;
const MARGIN = 32;

/** Tela do inventário: equipamento, bolsos, contêineres equipados e estoque */
export class InventoryScene implements Scene {
  readonly view = new Container({
    label: "InventoryScene",
    eventMode: "static",
  });
  readonly content = new Container({ label: "content" });
  readonly overlay = new Container({ label: "overlay" });
  readonly tooltip = new Tooltip();
  readonly stashView: GridView;
  readonly slotViews = new Map<SlotName, SlotView>();
  readonly pocketViews: GridView[];
  readonly containerPanel = new Container({ label: "containers" });
  readonly sortButton: Button;
  readonly drag: DragController;
  window: ContainerWindow | null = null;
  private containerGridViews: GridView[] = [];
  private lastTap: { item: Item; time: number } | null = null;
  private lastPointer = { x: 0, y: 0 };
  private contentHeight = 0;
  private lastSize = { width: 0, height: 0 };
  private readonly clock: Clock;

  constructor(
    readonly state: InventoryState,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.drag = new DragController(
      this.overlay,
      () => this.targets(),
      () => this.refresh(),
    );

    this.content.addChild(this.heading("Equipamento", 0, 0));

    // Slots de equipamento em linhas
    let y = ROW_TOP + LABEL;
    for (const row of SLOT_ROWS) {
      let x = 0;
      let rowHeight = 0;
      for (const slot of row) {
        const view = new SlotView(state.equipment, slot);
        view.position.set(x, y);
        this.slotViews.set(slot, view);
        this.content.addChild(view);
        x += view.pixelWidth + GAP;
        rowHeight = Math.max(rowHeight, view.pixelHeight);
      }
      y += rowHeight + LABEL + GAP;
    }

    // Bolsos ao lado do coldre
    const holster = this.slotViews.get("holster")!;
    const pocketsX = holster.x + holster.pixelWidth + GAP * 2;
    this.content.addChild(this.label("Bolsos", pocketsX, holster.y - 2));
    this.pocketViews = state.equipment.pockets.map((pocket, i) => {
      const view = new GridView(pocket);
      view.position.set(pocketsX + i * (CELL + 6), holster.y);
      this.content.addChild(view);
      return view;
    });

    this.containerPanel.position.set(0, y);
    this.content.addChild(this.containerPanel);

    // Estoque
    this.content.addChild(this.heading("Estoque", STASH_X, 0));
    this.sortButton = new Button("Organizar", () => this.sortStash());
    this.stashView = new GridView(state.stash);
    this.stashView.position.set(STASH_X, ROW_TOP);
    this.sortButton.position.set(
      STASH_X + this.stashView.pixelWidth - this.sortButton.buttonWidth,
      2,
    );
    this.content.addChild(this.stashView, this.sortButton);

    this.view.addChild(this.content);
    this.content.addChild(this.overlay);
    this.overlay.addChild(this.tooltip);

    this.view.on("globalpointermove", (e: FederatedPointerEvent) => {
      this.lastPointer = { x: e.global.x, y: e.global.y };
      this.drag.move(e.global);
    });
    window.addEventListener("keydown", this.onKeyDown);

    this.refresh();
  }

  /** Largura natural do conteúdo, antes de escalar */
  get contentWidth(): number {
    return STASH_X + this.stashView.pixelWidth;
  }

  /** Grades e slots que aceitam itens soltos */
  targets(): DropTargets {
    return {
      grids: [
        ...(this.window?.gridViews ?? []),
        ...this.pocketViews,
        ...this.containerGridViews,
        this.stashView,
      ],
      slots: [...this.slotViews.values()],
    };
  }

  /** Redesenha tudo a partir do estado do inventário */
  refresh(): void {
    this.stashView.refresh();
    for (const view of this.pocketViews) view.refresh();
    for (const view of this.slotViews.values()) view.refresh();
    this.buildContainerPanel();
    if (this.window && this.window.item.location === null) this.closeWindow();
    this.window?.refresh();
    this.wireItems();
    this.layout();
  }

  /** Abre a janela de um item contêiner (mochila, caixa...) */
  openWindow(item: Item): void {
    this.closeWindow();
    const win = new ContainerWindow(item, () => this.closeWindow());
    win.position.set(STASH_X - 60, ROW_TOP + 60);
    this.window = win;
    this.overlay.addChildAt(win, 0);
    this.wireItems();
  }

  closeWindow(): void {
    this.window?.destroy({ children: true });
    this.window = null;
  }

  sortStash(): boolean {
    const sorted = sortGrid(this.state.stash);
    this.refresh();
    return sorted;
  }

  resize(width: number, height: number): void {
    this.lastSize = { width, height };
    this.layout();
  }

  destroy(): void {
    this.drag.cancel();
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private layout(): void {
    const { width, height } = this.lastSize;
    if (width === 0 || height === 0) return;
    const w = this.contentWidth + MARGIN * 2;
    const h = this.contentHeight + MARGIN * 2;
    const scale = Math.min(width / w, height / h, 1.5);
    this.content.scale.set(scale);
    this.content.position.set(
      (width - this.contentWidth * scale) / 2,
      (height - this.contentHeight * scale) / 2,
    );
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "r" || event.key === "R") {
      this.drag.rotate(this.lastPointer);
    } else if (event.key === "Escape") {
      this.drag.cancel();
    }
  };

  private buildContainerPanel(): void {
    this.containerPanel
      .removeChildren()
      .forEach((c) => c.destroy({ children: true }));
    this.containerGridViews = [];
    let x = 0;
    let height = 0;
    for (const [slot, title] of CONTAINER_SECTIONS) {
      const item = this.state.equipment.get(slot);
      if (!item) continue;
      this.containerPanel.addChild(this.label(title, x, LABEL - 2));
      for (const grid of item.grids) {
        const view = new GridView(grid);
        view.position.set(x, LABEL);
        this.containerPanel.addChild(view);
        this.containerGridViews.push(view);
        x += view.pixelWidth + 6;
        height = Math.max(height, view.pixelHeight);
      }
      x += GAP * 2;
    }
    this.contentHeight = Math.max(
      this.containerPanel.y + LABEL + height,
      ROW_TOP + this.stashView.pixelHeight,
    );
  }

  /** Liga os eventos de ponteiro em todas as views de itens */
  private wireItems(): void {
    const views: ItemView[] = [];
    for (const grid of this.targets().grids)
      views.push(...grid.itemViews.values());
    for (const slot of this.slotViews.values()) {
      if (slot.itemView) views.push(slot.itemView);
    }
    for (const view of views) {
      if (view.eventMode === "static") continue;
      view.eventMode = "static";
      view.cursor = "grab";
      view.on("pointerdown", (e: FederatedPointerEvent) => {
        if (e.button !== 0) return;
        this.tooltip.hide();
        this.drag.begin(view, e.global);
      });
      const release = (e: FederatedPointerEvent) => this.drag.end(e.global);
      view.on("pointerup", release);
      view.on("pointerupoutside", release);
      view.on("pointertap", () => this.onTap(view.item));
      view.on("pointerover", (e: FederatedPointerEvent) => {
        if (this.drag.dragging) return;
        const p = this.overlay.toLocal(e.global);
        this.tooltip.show(view.item, p.x, p.y);
      });
      view.on("pointerout", () => this.tooltip.hide());
    }
  }

  private onTap(item: Item): void {
    const now = this.clock.now();
    const last = this.lastTap;
    if (last && last.item === item && now - last.time <= DOUBLE_CLICK_MS) {
      this.lastTap = null;
      if (item.grids.length > 0) this.openWindow(item);
      return;
    }
    this.lastTap = { item, time: now };
  }

  private heading(text: string, x: number, y: number): Text {
    return new Text({
      text,
      position: { x, y },
      style: {
        fill: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: 20,
        fontWeight: "bold",
      },
    });
  }

  private label(text: string, x: number, y: number): Text {
    return new Text({
      text,
      anchor: { x: 0, y: 1 },
      position: { x, y },
      style: {
        fill: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 11,
      },
    });
  }
}
