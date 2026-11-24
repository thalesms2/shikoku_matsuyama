import { Container, Graphics, Rectangle, Text } from "pixi.js";
import type {
  FederatedPointerEvent,
  FederatedWheelEvent,
  PointData,
} from "pixi.js";

import { systemClock } from "../../core/clock.ts";
import type { Clock } from "../../core/clock.ts";
import type { SlotName } from "../../core/inventory/equipment.ts";
import type { Grid } from "../../core/inventory/grid.ts";
import { ItemFactory } from "../../core/inventory/item.ts";
import type { Item } from "../../core/inventory/item.ts";
import { loadInto } from "../../core/inventory/magazine.ts";
import { sortGrid } from "../../core/inventory/operations.ts";
import { quickMove } from "../../core/inventory/quickMove.ts";
import {
  MAG_DRILLS_XP_PER_ROUND,
  useConsumable,
} from "../../core/pmc/consumables.ts";
import { addSkillXp } from "../../core/pmc/skills.ts";
import { storageFor } from "../../core/state.ts";
import type { PlayerState } from "../../core/state.ts";
import { stashItems } from "../../core/trade/trade.ts";
import { catalog } from "../../data/items.ts";
import type { InventoryState } from "../../data/starter.ts";
import { Button } from "../components/Button.ts";
import { ContextMenu } from "../components/ContextMenu.ts";
import type { TutorialPanel } from "../components/TutorialPanel.ts";
import { itemActions } from "../inventory/actions.ts";
import { ContainerWindow } from "../inventory/ContainerWindow.ts";
import { DragController } from "../inventory/DragController.ts";
import type { DropTargets } from "../inventory/DragController.ts";
import { GridView } from "../inventory/GridView.ts";
import type { ItemView } from "../inventory/ItemView.ts";
import { CELL } from "../inventory/layout.ts";
import { SlotView } from "../inventory/SlotView.ts";
import { Tooltip } from "../inventory/Tooltip.ts";
import type { TooltipBounds } from "../inventory/Tooltip.ts";
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
/** Linhas do estoque visíveis de uma vez; o resto rola */
export const STASH_VISIBLE_ROWS = 14;
/** Linhas roladas por passo da roda do mouse */
export const WHEEL_ROWS = 2;
/** Arrastando perto da borda do estoque: uma linha a cada intervalo */
export const AUTOSCROLL_MS = 150;
/** Largura da barra de rolagem do estoque */
export const SCROLLBAR_WIDTH = 6;
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
  readonly contextMenu = new ContextMenu();
  readonly factory: ItemFactory;
  readonly player: PlayerState | null;
  characterButton: Button | null = null;
  raidButton: Button | null = null;
  tradersButton: Button | null = null;
  questsButton: Button | null = null;
  hideoutButton: Button | null = null;
  fleaButton: Button | null = null;
  readonly stashView: GridView;
  readonly slotViews = new Map<SlotName, SlotView>();
  readonly pocketViews: GridView[];
  readonly containerPanel = new Container({ label: "containers" });
  readonly sortButton: Button;
  /** Máscara da janela visível do estoque */
  readonly stashMask = new Graphics();
  /** Barra de rolagem à direita do estoque (só quando rola) */
  readonly scrollBar = new Graphics();
  /** Primeira linha do estoque visível */
  stashScroll = 0;
  private autoscrollMs = 0;
  readonly drag: DragController;
  window: ContainerWindow | null = null;
  private containerGridViews: GridView[] = [];
  private lastTap: { item: Item; time: number } | null = null;
  private lastPointer = { x: 0, y: 0 };
  private contentHeight = 0;
  private lastSize = { width: 0, height: 0 };
  private readonly clock: Clock;
  /** Tempo com o mouse parado sobre o item antes de mostrar o tooltip */
  readonly tooltipDelayMs: number;
  /** Painel do tutorial (se houver) */
  readonly tutorial: TutorialPanel | null;
  private readonly onSellItem: ((item: Item) => void) | null;
  private pendingTooltip: {
    item: Item;
    x: number;
    y: number;
    remaining: number;
  } | null = null;

  constructor(
    readonly state: InventoryState,
    options: {
      clock?: Clock;
      tooltipDelayMs?: number;
      /** Cria itens novos (munição descarregada, pilhas separadas) */
      factory?: ItemFactory;
      /**
       * Estado do jogador: usa a fábrica e o carregamento dele (que
       * sobrevivem à troca de cena), habilita "Usar" em remédios e comida e
       * o XP/bônus de "Manuseio de carregador".
       */
      player?: PlayerState;
      /** Mostra o botão "Personagem" */
      onOpenCharacter?: () => void;
      /** Mostra o botão "Raid" */
      onOpenRaid?: () => void;
      /** Mostra o botão "Vendedores" */
      onOpenTraders?: () => void;
      /**
       * Item do estoque solto sobre o botão "Vendedores": abre a venda já
       * com ele escolhido (precisa de `onOpenTraders`)
       */
      onSellItem?: (item: Item) => void;
      /** Mostra o botão "Quests" */
      onOpenQuests?: () => void;
      /** Mostra o botão "Esconderijo" */
      onOpenHideout?: () => void;
      onOpenFlea?: () => void;
      /** Painel do tutorial, por cima de tudo, no canto da tela */
      tutorial?: TutorialPanel;
    } = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.tooltipDelayMs = options.tooltipDelayMs ?? 0;
    this.tutorial = options.tutorial ?? null;
    this.onSellItem = options.onSellItem ?? null;
    this.player = options.player ?? null;
    this.factory =
      options.player?.factory ?? options.factory ?? new ItemFactory(catalog);
    this.drag = new DragController(
      this.overlay,
      () => this.targets(),
      () => this.refresh(),
      {
        // Carregar (carregador, tubo ou arma) é instantâneo; com PMC, dá XP
        onLoad: (magazine, ammo) => {
          this.magDrillsXp(loadInto(magazine, ammo));
        },
        // Só itens do estoque podem ser vendidos
        onSell: (item) => this.onSellItem?.(item),
        canSell: (item) => stashItems(this.state.stash).includes(item),
      },
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
    this.stashView.mask = this.stashMask;
    this.stashView.eventMode = "static";
    this.stashView.on("wheel", (e: FederatedWheelEvent) => {
      this.scrollStash(Math.sign(e.deltaY) * WHEEL_ROWS);
    });
    this.content.addChild(
      this.stashMask,
      this.stashView,
      this.scrollBar,
      this.sortButton,
    );
    if (options.onOpenCharacter) {
      this.characterButton = new Button("Personagem", options.onOpenCharacter);
      this.characterButton.position.set(
        this.sortButton.x - this.characterButton.buttonWidth - GAP,
        2,
      );
      this.content.addChild(this.characterButton);
    }
    if (options.onOpenRaid) {
      this.raidButton = new Button("Raid", options.onOpenRaid);
      const left = this.characterButton ?? this.sortButton;
      this.raidButton.position.set(
        left.x - this.raidButton.buttonWidth - GAP,
        2,
      );
      this.content.addChild(this.raidButton);
    }
    if (options.onOpenTraders) {
      // À esquerda do título "Estoque", no espaço livre acima do equipamento
      this.tradersButton = new Button("Vendedores", options.onOpenTraders);
      this.tradersButton.position.set(
        STASH_X - this.tradersButton.buttonWidth - GAP,
        2,
      );
      this.content.addChild(this.tradersButton);
    }
    if (options.onOpenQuests) {
      this.questsButton = new Button("Quests", options.onOpenQuests);
      const right = this.tradersButton?.x ?? STASH_X;
      this.questsButton.position.set(
        right - this.questsButton.buttonWidth - GAP,
        2,
      );
      this.content.addChild(this.questsButton);
    }
    if (options.onOpenHideout) {
      this.hideoutButton = new Button("Esconderijo", options.onOpenHideout);
      const right = this.questsButton?.x ?? this.tradersButton?.x ?? STASH_X;
      this.hideoutButton.position.set(
        right - this.hideoutButton.buttonWidth - GAP,
        2,
      );
      this.content.addChild(this.hideoutButton);
    }
    if (options.onOpenFlea) {
      this.fleaButton = new Button("Mercado", options.onOpenFlea);
      const right =
        this.hideoutButton?.x ??
        this.questsButton?.x ??
        this.tradersButton?.x ??
        STASH_X;
      this.fleaButton.position.set(
        right - this.fleaButton.buttonWidth - GAP,
        2,
      );
      this.content.addChild(this.fleaButton);
    }

    this.view.addChild(this.content);
    if (options.tutorial) this.view.addChild(options.tutorial);
    this.content.addChild(this.overlay);
    this.overlay.addChild(this.tooltip, this.contextMenu);
    // Clique fora do menu fecha o menu
    this.view.on("pointerdown", (e: FederatedPointerEvent) => {
      if (e.button === 2) return;
      let target = e.target as Container | null;
      while (target && target !== this.contextMenu) target = target.parent;
      if (!target) this.contextMenu.hide();
    });

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
      ...(this.tradersButton &&
        this.onSellItem && {
          sell: {
            view: this.tradersButton,
            width: this.tradersButton.buttonWidth,
            height: this.tradersButton.buttonHeight,
          },
        }),
    };
  }

  /** Redesenha tudo a partir do estado do inventário */
  refresh(): void {
    this.stashView.refresh();
    this.applyStashScroll();
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

  /** Linhas do estoque visíveis (menos se o estoque for menor) */
  get stashVisibleRows(): number {
    return Math.min(STASH_VISIBLE_ROWS, this.state.stash.height);
  }

  /** Maior rolagem possível do estoque, em linhas */
  get maxStashScroll(): number {
    return Math.max(0, this.state.stash.height - STASH_VISIBLE_ROWS);
  }

  /**
   * Rola o estoque `rows` linhas (positivo = para baixo), sem passar dos
   * limites. Durante um arraste, a prévia acompanha. Devolve se mudou.
   */
  scrollStash(rows: number): boolean {
    const next = Math.max(
      0,
      Math.min(this.maxStashScroll, this.stashScroll + rows),
    );
    if (next === this.stashScroll) return false;
    this.stashScroll = next;
    this.applyStashScroll();
    if (this.drag.dragging) this.drag.move(this.lastPointer);
    return true;
  }

  /** Posiciona o estoque, a máscara, a área de clique e a barra de rolagem */
  private applyStashScroll(): void {
    this.stashScroll = Math.min(this.stashScroll, this.maxStashScroll);
    const view = this.stashView;
    const top = this.stashScroll * CELL;
    const height = this.stashVisibleRows * CELL;
    view.y = ROW_TOP - top;
    view.clip = { top, bottom: top + height };
    view.hitArea = new Rectangle(0, top, view.pixelWidth, height);
    this.stashMask
      .clear()
      .rect(STASH_X, ROW_TOP, view.pixelWidth, height)
      .fill({ color: 0xffffff });
    const bar = this.scrollBar.clear();
    bar.visible = this.maxStashScroll > 0;
    if (!bar.visible) return;
    const x = STASH_X + view.pixelWidth + 4;
    const total = this.state.stash.height;
    bar
      .rect(x, ROW_TOP, SCROLLBAR_WIDTH, height)
      .fill({ color: 0x0d0f12 })
      .rect(
        x,
        ROW_TOP + (this.stashScroll / total) * height,
        SCROLLBAR_WIDTH,
        (this.stashVisibleRows / total) * height,
      )
      .fill({ color: theme.accent, alpha: 0.8 });
  }

  /**
   * Arrastando um item perto da borda de cima ou de baixo do estoque (meia
   * célula para dentro ou fora dele), rola uma linha a cada `AUTOSCROLL_MS`.
   */
  private autoscroll(deltaMs: number): void {
    const direction = this.drag.dragging ? this.edgeDirection() : 0;
    if (direction === 0) {
      this.autoscrollMs = 0;
      return;
    }
    this.autoscrollMs += deltaMs;
    if (this.autoscrollMs < AUTOSCROLL_MS) return;
    this.autoscrollMs = 0;
    this.scrollStash(direction);
  }

  /** −1 perto do topo da janela do estoque, +1 perto do fundo, senão 0 */
  private edgeDirection(): number {
    const p = this.content.toLocal(this.lastPointer);
    const right = STASH_X + this.stashView.pixelWidth;
    if (p.x < STASH_X || p.x >= right) return 0;
    const top = ROW_TOP;
    const bottom = ROW_TOP + this.stashVisibleRows * CELL;
    const zone = CELL / 2;
    if (p.y >= top - zone && p.y < top + zone) return -1;
    if (p.y >= bottom - zone && p.y < bottom + zone) return 1;
    return 0;
  }

  sortStash(): boolean {
    const sorted = sortGrid(this.state.stash);
    this.refresh();
    return sorted;
  }

  resize(width: number, height: number): void {
    this.tutorial?.layout(width, height);
    this.lastSize = { width, height };
    this.layout();
  }

  /** Conta o atraso do tooltip e rola o estoque durante o arraste */
  update(deltaMs: number): void {
    this.autoscroll(deltaMs);
    const pending = this.pendingTooltip;
    if (!pending) return;
    pending.remaining -= deltaMs;
    if (pending.remaining > 0) return;
    this.pendingTooltip = null;
    this.showTooltip(pending.item, pending.x, pending.y);
  }

  /**
   * Onde guardar o que sai de um item (munição descarregada, carregador
   * removido, metade de pilha): a grade do próprio item, o equipamento e o
   * estoque, sem repetir.
   */
  storageFor(item: Item): Grid[] {
    return storageFor(this.state, item);
  }

  /** Abre o menu de contexto do item na posição global */
  openContextMenu(item: Item, global: PointData): void {
    this.hideTooltip();
    const p = this.overlay.toLocal(global);
    this.contextMenu.show(
      p.x,
      p.y,
      itemActions(item, {
        factory: this.factory,
        roundsMoved: (n) => this.magDrillsXp(n),
        storageFor: (i) => this.storageFor(i),
        openWindow: (i) => this.openWindow(i),
        changed: () => this.refresh(),
        ...(this.player && { use: (i: Item) => this.useItem(i) }),
      }),
    );
  }

  /** XP de Manuseio de carregador por cartucho carregado ou descarregado */
  private magDrillsXp(rounds: number): void {
    const skills = this.player?.skills;
    if (skills)
      addSkillXp(skills, "magDrills", rounds * MAG_DRILLS_XP_PER_ROUND);
  }

  /** Usa um remédio ou comida no PMC */
  useItem(item: Item): boolean {
    if (!this.player) return false;
    return useConsumable(item, this.player.pmc, this.player.skills) !== null;
  }

  /** Área visível da tela em coordenadas do conteúdo, ou `undefined` */
  visibleBounds(): TooltipBounds | undefined {
    const { width, height } = this.lastSize;
    if (width === 0 || height === 0) return undefined;
    const scale = this.content.scale.x;
    return {
      x: -this.content.x / scale,
      y: -this.content.y / scale,
      width: width / scale,
      height: height / scale,
    };
  }

  private showTooltip(item: Item, x: number, y: number): void {
    this.tooltip.show(item, x, y, this.visibleBounds());
  }

  private hideTooltip(): void {
    this.pendingTooltip = null;
    this.tooltip.hide();
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
      ROW_TOP + this.stashVisibleRows * CELL,
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
        if (e.button === 2) {
          this.openContextMenu(view.item, e.global);
          return;
        }
        if (e.button !== 0) return;
        this.hideTooltip();
        // Ctrl+clique (⌘ no Mac): move direto entre estoque e equipamento
        if (e.ctrlKey || e.metaKey) {
          if (quickMove(view.item, this.state)) this.refresh();
          return;
        }
        this.drag.begin(view, e.global);
      });
      const release = (e: FederatedPointerEvent) => this.drag.end(e.global);
      view.on("pointerup", release);
      view.on("pointerupoutside", release);
      view.on("pointertap", () => this.onTap(view.item));
      view.on("pointerover", (e: FederatedPointerEvent) => {
        if (this.drag.dragging) return;
        const p = this.overlay.toLocal(e.global);
        if (this.tooltipDelayMs <= 0) {
          this.showTooltip(view.item, p.x, p.y);
        } else {
          this.pendingTooltip = {
            item: view.item,
            x: p.x,
            y: p.y,
            remaining: this.tooltipDelayMs,
          };
        }
      });
      view.on("pointerout", () => this.hideTooltip());
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
