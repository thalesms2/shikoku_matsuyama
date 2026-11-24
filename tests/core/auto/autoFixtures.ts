import type { AutoContext } from "../../../src/core/auto/types.ts";
import type { QuestDef } from "../../../src/core/quests/types.ts";
import type {
  EnemyDef,
  EnemyKind,
  MapDef,
} from "../../../src/core/raid/types.ts";
import { TEST_FLEA } from "../flea/fleaFixtures.ts";
import { TEST_HIDEOUT } from "../hideout/hideoutFixtures.ts";
import { TEST_ENEMIES, TEST_MAP, armedPlayer } from "../raid/raidFixtures.ts";
import { TEST_TRADER } from "../trade/tradeFixtures.ts";

/** Sem inimigos e sem tocaia: sempre extrai */
export const SAFE_MAP: MapDef = {
  ...TEST_MAP,
  id: "safe",
  name: "Seguro",
  threats: { scav: 0, pmc: 0 },
};

/** Só PMCs imortais que acertam sempre: sempre morre */
export const DEADLY_MAP: MapDef = {
  ...TEST_MAP,
  id: "deadly",
  name: "Mortal",
  threats: { scav: 0, pmc: 1000 },
};

/** A raid passa da duração antes de extrair: MIA */
export const SHORT_MAP: MapDef = { ...SAFE_MAP, id: "short", duration: 1 };

export const DEADLY_ENEMIES: Record<EnemyKind, EnemyDef> = {
  ...TEST_ENEMIES,
  pmc: {
    ...TEST_ENEMIES.pmc,
    health: 1_000_000,
    accuracy: 1,
    damage: 10_000,
    penetration: 100,
  },
};

export const EXTRACT_QUEST: QuestDef = {
  id: "go",
  trader: "test",
  name: "Ir e voltar",
  description: "",
  requires: {},
  objectives: [{ kind: "extract", count: 10, map: "safe" }],
  rewards: {},
};

export function autoCtx(maps: MapDef[] = [SAFE_MAP]): AutoContext {
  return {
    maps,
    enemies: DEADLY_ENEMIES,
    quests: { quests: [EXTRACT_QUEST], traders: [TEST_TRADER], maps },
    hideout: TEST_HIDEOUT,
    shop: { traders: [TEST_TRADER], flea: TEST_FLEA },
  };
}

/** PMC armado (pistola cheia) com as regras apontando para o mapa dado */
export function autoPlayer(map = "safe") {
  const { player, pistol } = armedPlayer();
  player.auto.rules.map = map;
  player.auto.rules.minHealth = 0;
  return { player, pistol };
}
