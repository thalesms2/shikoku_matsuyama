import type { GridFilter, Item } from "./item.ts";
import { footprint } from "./size.ts";

export interface Spot {
  x: number;
  y: number;
  rotated: boolean;
}

/**
 * Grade de células onde itens retangulares são guardados ("tetris").
 * A posição de cada item fica em `item.location`; a grade mantém o mapa de
 * ocupação das células.
 */
export class Grid {
  private readonly cells: (Item | null)[];
  private readonly contents = new Set<Item>();
  private rows: number;

  constructor(
    readonly width: number,
    height: number,
    readonly filter: GridFilter = {},
    /** Item dono desta grade (mochila, colete...), `null` para o estoque */
    readonly owner: Item | null = null,
  ) {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new RangeError("O tamanho da grade deve ser inteiro");
    }
    if (width < 1 || height < 1) {
      throw new RangeError("A grade deve ter ao menos 1x1");
    }
    this.rows = height;
    this.cells = Array.from({ length: width * height }, () => null);
  }

  get height(): number {
    return this.rows;
  }

  /** Aumenta a grade em `rows` linhas embaixo; os itens ficam onde estão */
  addRows(rows: number): void {
    if (!Number.isInteger(rows) || rows < 0) {
      throw new RangeError("Linhas a adicionar devem ser inteiro ≥ 0");
    }
    this.rows += rows;
    for (let i = 0; i < this.width * rows; i++) this.cells.push(null);
  }

  /** Itens guardados nesta grade (sem os de grades internas) */
  items(): Item[] {
    return [...this.contents];
  }

  has(item: Item): boolean {
    return this.contents.has(item);
  }

  get isEmpty(): boolean {
    return this.contents.size === 0;
  }

  /** Item que ocupa a célula, ou `null` */
  itemAt(x: number, y: number): Item | null {
    if (!this.inBounds(x, y, 1, 1)) return null;
    return this.cells[y * this.width + x];
  }

  /** Células livres */
  freeCells(): number {
    return this.cells.filter((c) => c === null).length;
  }

  /**
   * Se a categoria é aceita e se colocar o item aqui não cria um ciclo
   * (um contêiner dentro dele mesmo).
   */
  accepts(item: Item): boolean {
    const { allow, deny } = this.filter;
    const category = item.def.category;
    if (allow && !allow.includes(category)) return false;
    if (deny?.includes(category)) return false;

    let owner = this.owner;
    while (owner) {
      if (owner === item) return false;
      const loc: Item["location"] = owner.location;
      owner = loc?.kind === "grid" ? loc.grid.owner : null;
    }
    return true;
  }

  /** Se o retângulo está livre (células do próprio `ignore` contam como livres) */
  isAreaFree(
    x: number,
    y: number,
    w: number,
    h: number,
    ignore: Item | null = null,
  ): boolean {
    if (!this.inBounds(x, y, w, h)) return false;
    for (let cy = y; cy < y + h; cy++) {
      for (let cx = x; cx < x + w; cx++) {
        const cell = this.cells[cy * this.width + cx];
        if (cell !== null && cell !== ignore) return false;
      }
    }
    return true;
  }

  /** Se o item cabe na posição. Se ele já está nesta grade, ignora o próprio espaço. */
  canPlace(item: Item, x: number, y: number, rotated = false): boolean {
    if (!this.accepts(item)) return false;
    const { w, h } = footprint(item.def, rotated);
    return this.isAreaFree(x, y, w, h, this.has(item) ? item : null);
  }

  /** Coloca um item solto (`location === null`) na posição */
  place(item: Item, x: number, y: number, rotated = false): void {
    if (item.location !== null) {
      throw new Error(`O item ${item.uid} precisa ser removido antes`);
    }
    if (!this.canPlace(item, x, y, rotated)) {
      throw new Error(`O item ${item.uid} não cabe em (${x}, ${y})`);
    }
    this.fill(item, x, y, rotated, item);
    this.contents.add(item);
    item.location = { kind: "grid", grid: this, x, y, rotated };
  }

  /** Remove o item desta grade, deixando-o solto */
  remove(item: Item): boolean {
    const loc = item.location;
    if (loc?.kind !== "grid" || loc.grid !== this) return false;
    this.fill(item, loc.x, loc.y, loc.rotated, null);
    this.contents.delete(item);
    item.location = null;
    return true;
  }

  /**
   * Primeira posição livre, varrendo linha a linha de cima para baixo.
   * Tenta sem rotação e depois rotacionado.
   */
  findFreeSpot(item: Item): Spot | null {
    if (!this.accepts(item)) return null;
    const square = item.def.width === item.def.height;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.canPlace(item, x, y, false)) return { x, y, rotated: false };
        if (!square && this.canPlace(item, x, y, true)) {
          return { x, y, rotated: true };
        }
      }
    }
    return null;
  }

  private inBounds(x: number, y: number, w: number, h: number): boolean {
    return x >= 0 && y >= 0 && x + w <= this.width && y + h <= this.height;
  }

  private fill(
    item: Item,
    x: number,
    y: number,
    rotated: boolean,
    value: Item | null,
  ): void {
    const { w, h } = footprint(item.def, rotated);
    for (let cy = y; cy < y + h; cy++) {
      for (let cx = x; cx < x + w; cx++) {
        this.cells[cy * this.width + cx] = value;
      }
    }
  }
}
