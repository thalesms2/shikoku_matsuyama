import type { Clock } from "../clock.ts";
import type { Grid } from "./grid.ts";
import type { Item, ItemFactory } from "./item.ts";
import {
  canLoad,
  freeRounds,
  loadRounds,
  loadedRounds,
  unloadRounds,
} from "./magazine.ts";

/** Tempo para carregar ou descarregar um cartucho */
export const MS_PER_ROUND = 500;

export type LoadJob =
  | { kind: "load"; magazine: Item; ammo: Item }
  | {
      kind: "unload";
      magazine: Item;
      factory: ItemFactory;
      /** Onde guardar a munição tirada, em ordem de preferência */
      grids: () => readonly Grid[];
    };

interface ActiveJob {
  job: LoadJob;
  startedAt: number;
  done: number;
}

/**
 * Carrega/descarrega carregadores um cartucho por vez, de forma idle: o
 * progresso é calculado pelo relógio, então continua certo mesmo que
 * `advance` seja chamado com atraso (ou depois de o jogo ficar fechado).
 */
export class MagazineLoader {
  private active: ActiveJob | null = null;

  constructor(
    private readonly clock: Clock,
    public msPerRound = MS_PER_ROUND,
  ) {
    if (msPerRound <= 0) throw new RangeError("msPerRound deve ser > 0");
  }

  get job(): LoadJob | null {
    return this.active?.job ?? null;
  }

  /** Se o carregador está sendo carregado/descarregado agora */
  isBusy(magazine: Item): boolean {
    return this.active?.job.magazine === magazine;
  }

  /** Começa um trabalho novo (cancela o anterior) */
  start(job: LoadJob): void {
    this.active = { job, startedAt: this.clock.now(), done: 0 };
  }

  /** Estado do trabalho atual, para o save */
  snapshot(): { job: LoadJob; startedAt: number; done: number } | null {
    return this.active ? { ...this.active } : null;
  }

  /** Restaura um trabalho salvo com `snapshot` */
  restore(job: LoadJob, startedAt: number, done: number): void {
    this.active = { job, startedAt, done };
  }

  cancel(): void {
    this.active = null;
  }

  /** Cartuchos feitos e total previsto do trabalho atual */
  progress(): { done: number; total: number } | null {
    const a = this.active;
    if (!a) return null;
    return { done: a.done, total: a.done + remaining(a.job) };
  }

  /**
   * Processa os cartuchos cujo tempo já passou. Devolve quantos foram
   * processados agora; o trabalho termina sozinho quando não há mais o que
   * fazer.
   */
  advance(): number {
    const a = this.active;
    if (!a) return 0;
    const elapsed = this.clock.now() - a.startedAt;
    const due = Math.floor(elapsed / this.msPerRound) - a.done;
    let processed = 0;
    let stuck = false;
    while (processed < due && remaining(a.job) > 0) {
      if (step(a.job) === 0) {
        // Sem espaço para descarregar: o trabalho para aqui
        stuck = true;
        break;
      }
      a.done++;
      processed++;
    }
    if (stuck || remaining(a.job) === 0) this.active = null;
    return processed;
  }
}

function remaining(job: LoadJob): number {
  if (job.kind === "load") {
    return canLoad(job.magazine, job.ammo)
      ? Math.min(job.ammo.count, freeRounds(job.magazine))
      : 0;
  }
  return loadedRounds(job.magazine);
}

function step(job: LoadJob): number {
  return job.kind === "load"
    ? loadRounds(job.magazine, job.ammo, 1)
    : unloadRounds(job.magazine, job.factory, job.grids(), 1);
}
