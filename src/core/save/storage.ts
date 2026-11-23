import type { Clock } from "../clock.ts";
import type { Catalog } from "../inventory/item.ts";
import type { PlayerState } from "../state.ts";
import { SaveError, migrate } from "./migrations.ts";
import { deserializeGame, serializeGame } from "./serialize.ts";

export const SAVE_KEY = "escape-from-idle:save";

/** Onde o save fica guardado (localStorage no navegador) */
export interface SaveStorage {
  read(): string | null;
  write(data: string): void;
  clear(): void;
}

/**
 * Save no `localStorage`. Erros de acesso (modo privado, cota cheia) não
 * derrubam o jogo: a leitura devolve `null` e a escrita é ignorada.
 */
export function browserStorage(
  key: string = SAVE_KEY,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
): SaveStorage {
  return {
    read: () => {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    write: (data) => {
      try {
        storage.setItem(key, data);
      } catch {
        // sem espaço ou sem permissão: o próximo autosave tenta de novo
      }
    },
    clear: () => {
      try {
        storage.removeItem(key);
      } catch {
        // nada a fazer
      }
    },
  };
}

/** Grava o estado no armazenamento */
export function saveGame(
  state: PlayerState,
  storage: SaveStorage,
  clock: Clock,
): void {
  storage.write(JSON.stringify(serializeGame(state, clock.now())));
}

/**
 * Lê o save. Devolve `null` se não houver save; lança `SaveError` se ele
 * estiver corrompido ou for de uma versão mais nova.
 */
export function loadGame(
  storage: SaveStorage,
  catalog: Catalog,
  clock: Clock,
): { state: PlayerState; warnings: string[] } | null {
  const text = storage.read();
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError("Save corrompido (JSON inválido)");
  }
  return deserializeGame(migrate(raw), catalog, clock);
}

/** Salva automaticamente a cada `intervalMs` de jogo */
export class AutoSaver {
  private elapsed = 0;

  constructor(
    private readonly save: () => void,
    readonly intervalMs = 5000,
  ) {}

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    if (this.elapsed < this.intervalMs) return;
    this.elapsed = 0;
    this.save();
  }
}
