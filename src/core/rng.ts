/**
 * Gerador de números pseudoaleatórios determinístico (mulberry32).
 *
 * Toda aleatoriedade do core passa por aqui, nunca por `Math.random()`, para
 * que testes e simulações sejam reproduzíveis a partir de uma seed. O estado
 * interno pode ser salvo e restaurado junto com o save do jogo.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Estado interno atual, para salvar no save */
  getState(): number {
    return this.state;
  }

  /** Restaura um estado salvo com `getState` */
  setState(state: number): void {
    this.state = state >>> 0;
  }

  /** Número em [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [min, max], inclusivo nas duas pontas */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Intervalo inválido: [${min}, ${max}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** `true` com probabilidade `p` (0 a 1) */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Um elemento aleatório da lista */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("Não é possível sortear de uma lista vazia");
    }
    return items[this.int(0, items.length - 1)];
  }

  /** Um elemento sorteado proporcionalmente ao seu peso */
  weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    const positive = entries.filter((e) => e.weight > 0);
    if (positive.length === 0) {
      throw new RangeError("É preciso ao menos um peso maior que zero");
    }
    const total = positive.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.next() * total;
    for (let i = 0; i < positive.length - 1; i++) {
      roll -= positive[i].weight;
      if (roll < 0) return positive[i].value;
    }
    return positive[positive.length - 1].value;
  }
}
