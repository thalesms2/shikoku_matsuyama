/**
 * Fonte de tempo do jogo. Timers idle (cooldown da raid scav, produção do
 * esconderijo, progresso offline) leem o tempo daqui, nunca de `Date.now()`
 * direto, para poderem ser testados com um relógio manual.
 */
export interface Clock {
  /** Tempo atual em milissegundos desde a época Unix */
  now(): number;
}

/** Relógio real do sistema */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/** Relógio controlado manualmente, para testes e simulações */
export class ManualClock implements Clock {
  private time: number;

  constructor(start = 0) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  /** Avança o relógio em `ms` milissegundos */
  advance(ms: number): void {
    if (ms < 0) throw new RangeError("O relógio não pode voltar no tempo");
    this.time += ms;
  }

  set(time: number): void {
    this.time = time;
  }
}

/** Milissegundos que faltam até `readyAt` (nunca negativo) */
export function remaining(clock: Clock, readyAt: number): number {
  return Math.max(0, readyAt - clock.now());
}

/** Formata uma duração em ms como `1h 02m 03s`, `2m 05s` ou `9s` */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}
