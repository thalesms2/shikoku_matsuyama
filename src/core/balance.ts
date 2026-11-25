/**
 * Valores de balanceamento usados pela lógica do jogo, num lugar só. O
 * jogo começa com `CORE_DEFAULTS`; a janela de admin (e o servidor) trocam
 * os valores em tempo de execução com `setCoreBalance`, e o core sempre lê o
 * valor atual por `coreBalance()` no momento do cálculo.
 *
 * Os valores da raid nova (Fase 12) entram aqui conforme forem criados.
 */
export interface CoreBalance {
  durability: {
    /** Durabilidade perdida por ponto de dano de um acerto na armadura */
    armorWear: number;
    /** Fração do preço que um item quebrado ainda vale */
    brokenValue: number;
  };
  xp: {
    /** XP de Saúde/Metabolismo por consumível usado */
    consumableSkill: number;
    /** XP de Manuseio de carregador por cartucho carregado ou descarregado */
    magDrillsPerRound: number;
  };
  trade: {
    /** Reputação ganha a cada 100.000 ₽ negociados com um vendedor */
    reputationPer100k: number;
  };
  scav: {
    /** Espera entre raids Scav com karma 0 (ms) */
    cooldownMs: number;
    /** Efeito de cada ponto de karma (−10 a 10) */
    friendlyBase: number;
    friendlyPerKarma: number;
    riskPerKarma: number;
    lootPerKarma: number;
    qualityPerKarma: number;
    cooldownPerKarma: number;
  };
  matrix: {
    /** Turnos para atravessar cada terreno (antes da estratégia) */
    roadTurns: number;
    grassTurns: number;
    metalTurns: number;
    rubbleTurns: number;
    buildingTurns: number;
    /** Multiplicador dos turnos por célula de cada estratégia */
    ratMove: number;
    safeMove: number;
    neutralMove: number;
    aggressiveMove: number;
    psychoMove: number;
    /** Custo extra (em turnos) para o Rato e o Seguro passarem perto de um spawn conhecido */
    spawnAvoidCost: number;
    /** Custo extra para o Rato andar fora das bordas do mapa */
    ratInteriorCost: number;
    /** Desvio máximo do Neutro para visitar um ponto de interesse (0,3 = 30%) */
    neutralDetour: number;
    /** Gasto por turno (antes das skills) */
    energyPerTurn: number;
    hydrationPerTurn: number;
    /** XP de Resistência por turno */
    enduranceXpPerTurn: number;
    /** Ritmo do log na tela (ms por turno, em x1) */
    msPerTurn: number;
    /** Turnos a menos para revistar um contêiner conhecido */
    knownSearchDiscount: number;
    /** Turnos a menos para o Agressivo e o Psicopata revistarem */
    fastSearchDiscount: number;
    /** O Seguro pula contêineres que levariam mais turnos que isto */
    safeMaxSearchTurns: number;
    /** Chance de achar do Seguro × isto (anda em silêncio, acha menos) */
    safeFindFactor: number;
    /** Fração das células de carga ocupadas que manda para a extração */
    ratFullAt: number;
    neutralFullAt: number;
    /** XP de Percepção por item achado */
    perceptionXpPerLoot: number;
  };
  encounter: {
    /** Aparece inimigo com d10 ≥ spawnBase − ⌈spawnPerDifficulty × dificuldade⌉ */
    spawnBase: number;
    spawnPerDifficulty: number;
    /** Peso de cada spawn de PMC frente a um de Scav no sorteio do lugar */
    pmcSpawnWeight: number;
    /** O inimigo anda com d6 ≥ moveBase − dificuldade */
    moveBase: number;
    /** Distância (células) em que os dois disputam a percepção */
    hearingRange: number;
    /** Células a mais de alcance para ouvir o Agressivo e o Psicopata */
    aggressiveNoise: number;
    psychoNoise: number;
    /** Mais 1 célula para o Psicopata em mato e metal */
    psychoTerrainNoise: number;
    /** Pontos de d20 por 100% de bônus das skills (Percepção, Furtividade) */
    skillToD20: number;
    /** Bônus de furtividade do Seguro (pontos de d20) */
    safeStealth: number;
    /** Pontos de d20 do inimigo por nível de dificuldade */
    enemyPerDifficulty: number;
    /** Fuga: o d20 do personagem precisa ser ≥ fleeFactor × o do inimigo */
    fleeFactor: number;
    /** Desvantagem do Rato na fuga (pontos de d20, antes das skills) */
    ratFleePenalty: number;
    /** Turnos a mais por célula enquanto foge */
    fleeExtraTurns: number;
  };
  knowledge: {
    /** XP por célula percorrida */
    cellXp: number;
    /** XP por sobreviver à raid */
    surviveXp: number;
    /** XP na primeira vez que acha cada contêiner */
    containerXp: number;
    /** XP por nível da habilidade do mapa */
    xpPerLevel: number;
    /** Pontos do mapa lembrados a cada nível */
    revealPerLevel: number;
  };
  repeatable: {
    /** Peso de cada tipo de objetivo no sorteio (0 = nunca) */
    killWeight: number;
    findWeight: number;
    /** Scavs a abater (de/até) */
    killMin: number;
    killMax: number;
    /** Unidades do item a achar (de/até) */
    findMin: number;
    findMax: number;
    /** Peso de cada categoria no sorteio do item (0 = nunca) */
    barterWeight: number;
    foodWeight: number;
    medicalWeight: number;
    /** Rublos por Scav abatido */
    moneyPerKill: number;
    /** Rublos por item achado = preço base × isto */
    findValueFactor: number;
    /** XP do PMC e reputação por unidade do objetivo */
    xpPerUnit: number;
    reputationPerUnit: number;
  };
  hideout: {
    /** Multiplicador da duração das obras */
    buildTime: number;
    /** Multiplicador da duração das produções */
    productionTime: number;
    /** Multiplicador da renda passiva (por hora e limite) */
    income: number;
  };
}

/** Valores padrão (os mesmos de antes da centralização) */
export const CORE_DEFAULTS: CoreBalance = {
  durability: { armorWear: 0.05, brokenValue: 0.3 },
  xp: { consumableSkill: 5, magDrillsPerRound: 0.5 },
  trade: { reputationPer100k: 0.02 },
  scav: {
    cooldownMs: 20 * 60 * 1000,
    friendlyBase: 0.6,
    friendlyPerKarma: 0.04,
    riskPerKarma: 0.05,
    lootPerKarma: 0.03,
    qualityPerKarma: 0.05,
    cooldownPerKarma: 0.025,
  },
  matrix: {
    roadTurns: 1,
    grassTurns: 1,
    metalTurns: 1,
    rubbleTurns: 2,
    buildingTurns: 1,
    ratMove: 2,
    safeMove: 1.25,
    neutralMove: 1,
    aggressiveMove: 0.75,
    psychoMove: 0.5,
    spawnAvoidCost: 6,
    ratInteriorCost: 2,
    neutralDetour: 0.3,
    energyPerTurn: 0.4,
    hydrationPerTurn: 0.5,
    enduranceXpPerTurn: 0.25,
    msPerTurn: 1000,
    knownSearchDiscount: 1,
    fastSearchDiscount: 1,
    safeMaxSearchTurns: 4,
    safeFindFactor: 0.8,
    ratFullAt: 0.8,
    neutralFullAt: 0.9,
    perceptionXpPerLoot: 2,
  },
  encounter: {
    spawnBase: 11,
    spawnPerDifficulty: 1.5,
    pmcSpawnWeight: 0.3,
    moveBase: 7,
    hearingRange: 2,
    aggressiveNoise: 1,
    psychoNoise: 2,
    psychoTerrainNoise: 1,
    skillToD20: 10,
    safeStealth: 3,
    enemyPerDifficulty: 1,
    fleeFactor: 2,
    ratFleePenalty: 4,
    fleeExtraTurns: 1,
  },
  knowledge: {
    cellXp: 1,
    surviveXp: 20,
    containerXp: 5,
    xpPerLevel: 60,
    revealPerLevel: 2,
  },
  repeatable: {
    killWeight: 1,
    findWeight: 1,
    killMin: 3,
    killMax: 8,
    findMin: 1,
    findMax: 3,
    barterWeight: 1,
    foodWeight: 1,
    medicalWeight: 1,
    moneyPerKill: 5000,
    findValueFactor: 1.5,
    xpPerUnit: 150,
    reputationPerUnit: 0.005,
  },
  hideout: { buildTime: 1, productionTime: 1, income: 1 },
};

let current: CoreBalance = structuredClone(CORE_DEFAULTS);

/** Valores atuais */
export function coreBalance(): CoreBalance {
  return current;
}

/** Troca todos os valores (uma cópia; quem passou pode continuar mexendo) */
export function setCoreBalance(values: CoreBalance): void {
  current = structuredClone(values);
}

/** Volta aos valores padrão */
export function resetCoreBalance(): void {
  setCoreBalance(CORE_DEFAULTS);
}

type Section = Record<string, number>;

/**
 * Valores vindos de fora (save do servidor, JSON): cada número precisa ser
 * finito e ≥ 0; o que faltar ou for inválido fica com o padrão.
 */
export function readCoreBalance(raw: unknown): CoreBalance {
  const result = structuredClone(CORE_DEFAULTS);
  if (typeof raw !== "object" || raw === null) return result;
  const input = raw as Record<string, unknown>;
  for (const [name, section] of Object.entries(result) as [string, Section][]) {
    const given = input[name];
    if (typeof given !== "object" || given === null) continue;
    for (const key of Object.keys(section)) {
      const value = (given as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        section[key] = value;
      }
    }
  }
  return result;
}
