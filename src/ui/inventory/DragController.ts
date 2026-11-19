import type { Container, PointData } from "pixi.js";

import type { GridLocation, Item } from "../../core/inventory/item.ts";
import {
  canStack,
  dropOnItem,
  moveToGrid,
  moveToSlot,
} from "../../core/inventory/operations.ts";
import { footprint } from "../../core/inventory/size.ts";
import type { GridView } from "./GridView.ts";
import { ItemView } from "./ItemView.ts";
import { cellAt, dropCell } from "./layout.ts";
import type { SlotView } from "./SlotView.ts";

export interface DropTargets {
  grids: readonly GridView[];
  slots: readonly SlotView[];
}

/** Onde o item seria solto na posição atual do ponteiro */
export type Drop =
  | { kind: "grid"; view: GridView; x: number; y: number; ok: boolean }
  | { kind: "item"; view: GridView; target: Item; ok: boolean }
  | { kind: "slot"; view: SlotView; ok: boolean };

interface DragState {
  item: Item;
  source: ItemView;
  ghost: ItemView;
  grabX: number;
  grabY: number;
  rotated: boolean;
}

/**
 * Arrastar e soltar itens entre grades e slots, com prévia verde/vermelha e
 * rotação durante o arraste.
 */
export class DragController {
  private state: DragState | null = null;

  constructor(
    /** Camada acima de tudo onde o "fantasma" do item é desenhado */
    private readonly overlay: Container,
    private readonly targets: () => DropTargets,
    /** Chamado depois que o inventário mudou */
    private readonly onChange: () => void,
  ) {}

  get dragging(): Item | null {
    return this.state?.item ?? null;
  }

  get rotated(): boolean {
    return this.state?.rotated ?? false;
  }

  /** Começa a arrastar o item da view, agarrado no ponto global */
  begin(source: ItemView, global: PointData): void {
    this.cancel();
    const grab = source.toLocal(global);
    const ghost = new ItemView(source.item, source.rotated);
    ghost.eventMode = "none";
    ghost.alpha = 0.85;
    this.overlay.addChild(ghost);
    source.alpha = 0.35;
    this.state = {
      item: source.item,
      source,
      ghost,
      grabX: grab.x,
      grabY: grab.y,
      rotated: source.rotated,
    };
    this.move(global);
  }

  /** Atualiza o fantasma e a prévia na posição do ponteiro */
  move(global: PointData): void {
    const s = this.state;
    if (!s) return;
    const local = this.overlay.toLocal(global);
    s.ghost.position.set(local.x - s.grabX, local.y - s.grabY);
    this.clearHighlights();
    const drop = this.resolve(global);
    if (!drop) return;
    if (drop.kind === "slot") {
      drop.view.showHighlight(drop.ok);
    } else if (drop.kind === "grid") {
      const { w, h } = footprint(s.item.def, s.rotated);
      drop.view.showHighlight(drop.x, drop.y, w, h, drop.ok);
    } else {
      const loc = drop.target.location as GridLocation;
      const { w, h } = footprint(drop.target.def, loc.rotated);
      drop.view.showHighlight(loc.x, loc.y, w, h, drop.ok);
    }
  }

  /** Gira o item sendo arrastado (tecla R) */
  rotate(global?: PointData): void {
    const s = this.state;
    if (!s) return;
    s.rotated = !s.rotated;
    [s.grabX, s.grabY] = [s.grabY, s.grabX];
    s.ghost.setRotated(s.rotated);
    if (global) this.move(global);
  }

  /** Solta o item. Devolve `true` se o inventário mudou. */
  end(global: PointData): boolean {
    const s = this.state;
    if (!s) return false;
    const drop = this.resolve(global);
    this.cancel();
    if (!drop?.ok) return false;

    let changed: boolean;
    if (drop.kind === "grid" && this.isSameSpot(s, drop)) {
      // Um clique simples também é um "arrastar e soltar" no mesmo lugar
      changed = false;
    } else if (drop.kind === "grid") {
      changed = moveToGrid(s.item, drop.view.grid, drop.x, drop.y, s.rotated);
    } else if (drop.kind === "item") {
      changed = dropOnItem(s.item, drop.target);
    } else if (drop.view.equipment.get(drop.view.slot) === s.item) {
      changed = false;
    } else {
      changed = moveToSlot(s.item, drop.view.equipment, drop.view.slot);
    }
    if (changed) this.onChange();
    return changed;
  }

  /** Cancela o arraste sem mudar nada */
  cancel(): void {
    const s = this.state;
    if (!s) return;
    this.state = null;
    s.ghost.destroy({ children: true });
    if (!s.source.destroyed) s.source.alpha = 1;
    this.clearHighlights();
  }

  /** Calcula onde o item cairia no ponto global */
  resolve(global: PointData): Drop | null {
    const s = this.state;
    if (!s) return null;
    const { grids, slots } = this.targets();

    for (const view of grids) {
      const local = view.toLocal(global);
      if (!view.containsLocal(local.x, local.y)) continue;
      const cell = cellAt(local.x, local.y);
      const hovered = view.grid.itemAt(cell.x, cell.y);
      if (hovered && hovered !== s.item) {
        if (canStack(s.item, hovered)) {
          return { kind: "item", view, target: hovered, ok: true };
        }
        if (hovered.grids.length > 0) {
          const ok = hovered.grids.some((g) => g.findFreeSpot(s.item) !== null);
          return { kind: "item", view, target: hovered, ok };
        }
      }
      const { x, y } = dropCell(local.x, local.y, s.grabX, s.grabY);
      const ok = view.grid.canPlace(s.item, x, y, s.rotated);
      return { kind: "grid", view, x, y, ok };
    }

    for (const view of slots) {
      const local = view.toLocal(global);
      if (!view.containsLocal(local.x, local.y)) continue;
      const ok =
        view.equipment.get(view.slot) === s.item ||
        view.equipment.canEquip(view.slot, s.item);
      return { kind: "slot", view, ok };
    }
    return null;
  }

  private isSameSpot(
    s: DragState,
    drop: Extract<Drop, { kind: "grid" }>,
  ): boolean {
    const loc = s.item.location;
    return (
      loc?.kind === "grid" &&
      loc.grid === drop.view.grid &&
      loc.x === drop.x &&
      loc.y === drop.y &&
      loc.rotated === s.rotated
    );
  }

  private clearHighlights(): void {
    const { grids, slots } = this.targets();
    for (const view of grids) view.hideHighlight();
    for (const view of slots) view.hideHighlight();
  }
}
