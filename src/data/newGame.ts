import type { Clock } from "../core/clock.ts";
import { ItemFactory } from "../core/inventory/item.ts";
import { createPmc } from "../core/pmc/pmc.ts";
import { createSkills } from "../core/pmc/skills.ts";
import { loadGame } from "../core/save/storage.ts";
import type { SaveStorage } from "../core/save/storage.ts";
import { createPlayerState } from "../core/state.ts";
import type { PlayerState } from "../core/state.ts";
import { catalog } from "./items.ts";
import { createStarterInventory } from "./starter.ts";

/** Estado de um jogo novo: kit inicial, PMC nível 1 e skills zeradas */
export function createNewPlayer(clock: Clock): PlayerState {
  const factory = new ItemFactory(catalog);
  return createPlayerState(
    {
      inventory: createStarterInventory(factory),
      pmc: createPmc(),
      skills: createSkills(),
      factory,
    },
    clock,
  );
}

/**
 * Carrega o jogo salvo ou começa um novo. Um save que não pode ser lido
 * (corrompido, de versão mais nova, inválido) é copiado para `backup` antes
 * de começar um jogo novo, para não ser perdido.
 */
export function loadOrCreatePlayer(
  storage: SaveStorage,
  backup: SaveStorage,
  clock: Clock,
): { player: PlayerState; warnings: string[]; error: string | null } {
  try {
    const loaded = loadGame(storage, catalog, clock);
    if (loaded) {
      return { player: loaded.state, warnings: loaded.warnings, error: null };
    }
  } catch (e) {
    // Só há erro se havia um save para ler
    backup.write(storage.read() as string);
    return {
      player: createNewPlayer(clock),
      warnings: [],
      error: (e as Error).message,
    };
  }
  return { player: createNewPlayer(clock), warnings: [], error: null };
}
