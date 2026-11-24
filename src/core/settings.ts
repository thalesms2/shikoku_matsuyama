import type { SaveStorage } from "./save/storage.ts";

/** Chave das configurações (separadas do save: são do aparelho) */
export const SETTINGS_KEY = "escape-from-idle:settings";

export const VOLUMES = [0, 0.25, 0.5, 0.75, 1] as const;
export const TOOLTIP_DELAYS = [0, 300, 600] as const;
export const RAID_SPEEDS = [1, 4, 16] as const;

export interface Settings {
  /** Volume dos efeitos sonoros (0 a 1) */
  volume: number;
  /** Atraso do tooltip no inventário (ms) */
  tooltipDelayMs: number;
  /** Velocidade inicial do log da raid */
  raidSpeed: number;
  /** Animações (transição entre telas) */
  animations: boolean;
  /** Próximo passo do tutorial (passou do fim = concluído) */
  tutorialStep: number;
}

export function defaultSettings(): Settings {
  return {
    volume: 0.5,
    tooltipDelayMs: 300,
    raidSpeed: 1,
    animations: true,
    tutorialStep: 0,
  };
}

const oneOf = <T>(values: readonly T[], value: unknown, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback;

/**
 * Lê as configurações; o que faltar ou for inválido (inclusive JSON
 * ilegível) volta ao padrão.
 */
export function loadSettings(storage: SaveStorage): Settings {
  const base = defaultSettings();
  let raw: Partial<Settings> = {};
  try {
    raw = (JSON.parse(storage.read() ?? "{}") ?? {}) as Partial<Settings>;
  } catch {
    return base;
  }
  return {
    volume: oneOf(VOLUMES, raw.volume, base.volume),
    tooltipDelayMs: oneOf(
      TOOLTIP_DELAYS,
      raw.tooltipDelayMs,
      base.tooltipDelayMs,
    ),
    raidSpeed: oneOf(RAID_SPEEDS, raw.raidSpeed, base.raidSpeed),
    animations:
      typeof raw.animations === "boolean" ? raw.animations : base.animations,
    tutorialStep:
      Number.isInteger(raw.tutorialStep) && raw.tutorialStep! >= 0
        ? raw.tutorialStep!
        : base.tutorialStep,
  };
}

export function saveSettings(storage: SaveStorage, settings: Settings): void {
  storage.write(JSON.stringify(settings));
}
