import {
  BODY_PARTS,
  changeEnergy,
  changeHydration,
  heal,
  isDead,
  levelForXp,
  restorePart,
} from "../pmc/pmc.ts";
import type { PlayerState } from "../state.ts";
import {
  available,
  createStacks,
  loyaltyLevel,
  storeAll,
  take,
  traderState,
} from "../trade/trade.ts";
import type { TradeResult, TraderDef } from "../trade/types.ts";
import type {
  HideoutData,
  HideoutState,
  ItemAmount,
  ModuleDef,
  ModuleEffects,
  ModuleLevelDef,
  RecipeDef,
} from "./types.ts";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export function createHideoutState(now: number): HideoutState {
  return {
    modules: {},
    construction: null,
    productions: {},
    incomeSince: now,
    lastTick: now,
  };
}

export function moduleLevel(state: HideoutState, id: string): number {
  return state.modules[id] ?? 0;
}

/** Definição do nível atual do módulo (`null` se não construído) */
export function currentLevel(
  state: HideoutState,
  def: ModuleDef,
): ModuleLevelDef | null {
  return def.levels[moduleLevel(state, def.id) - 1] ?? null;
}

/** Próximo nível do módulo (`null` no máximo) */
export function nextModuleLevel(
  state: HideoutState,
  def: ModuleDef,
): ModuleLevelDef | null {
  return def.levels[moduleLevel(state, def.id)] ?? null;
}

/** Soma de um efeito nos níveis atuais de todos os módulos */
export function effect(
  state: HideoutState,
  data: HideoutData,
  key: keyof ModuleEffects,
): number {
  return data.modules.reduce(
    (sum, def) => sum + (currentLevel(state, def)?.effects[key] ?? 0),
    0,
  );
}

const fail = (reason: string): TradeResult => ({ ok: false, reason });

/** O que falta no estoque para pagar os itens, em texto */
function missingItems(player: PlayerState, cost: readonly ItemAmount[]) {
  const { catalog } = player.factory;
  return cost
    .filter((c) => available(player, c.item) < c.count)
    .map(
      (c) =>
        `${catalog.get(c.item).name} (${available(player, c.item)}/${c.count})`,
    );
}

/**
 * Motivos que impedem começar a próxima obra do módulo (vazio = pode).
 * `now` serve para criar o estado do vendedor da lealdade, se faltar.
 */
export function upgradeBlockers(
  player: PlayerState,
  data: HideoutData,
  traders: readonly TraderDef[],
  def: ModuleDef,
  now: number,
): string[] {
  const state = player.hideout;
  const next = nextModuleLevel(state, def);
  if (!next) return ["Nível máximo"];
  const blockers: string[] = [];
  if (state.construction) blockers.push("Outra obra em andamento");
  for (const req of next.requires.modules ?? []) {
    if (moduleLevel(state, req.module) < req.level) {
      const name = data.modules.find((m) => m.id === req.module)!.name;
      blockers.push(`${name} nível ${req.level}`);
    }
  }
  const loyalty = next.requires.loyalty;
  if (loyalty) {
    const trader = traders.find((t) => t.id === loyalty.trader)!;
    const ts = traderState(player.traders, trader, now);
    if (loyaltyLevel(trader, ts, player.pmc.xp).level < loyalty.level) {
      blockers.push(`Lealdade nível ${loyalty.level} com ${trader.name}`);
    }
  }
  const pmc = next.requires.pmcLevel;
  if (pmc && levelForXp(player.pmc.xp) < pmc) {
    blockers.push(`PMC nível ${pmc}`);
  }
  const missing = missingItems(player, next.cost);
  if (missing.length > 0) blockers.push(`Faltam: ${missing.join(", ")}`);
  return blockers;
}

/** Começa a obra do próximo nível: paga do estoque e marca o fim */
export function startUpgrade(
  player: PlayerState,
  data: HideoutData,
  traders: readonly TraderDef[],
  moduleId: string,
  now: number,
): TradeResult {
  const def = data.modules.find((m) => m.id === moduleId);
  if (!def) return fail("Módulo não existe");
  const blockers = upgradeBlockers(player, data, traders, def, now);
  if (blockers.length > 0) return fail(blockers[0]);
  const next = nextModuleLevel(player.hideout, def)!;
  for (const c of next.cost) take(player, c.item, c.count);
  player.hideout.construction = {
    module: def.id,
    level: next.level,
    endsAt: now + next.buildMs,
  };
  return { ok: true, amount: next.level };
}

/** Conclui a obra se já terminou; o estoque cresce na hora */
function finishConstruction(
  player: PlayerState,
  data: HideoutData,
  now: number,
): void {
  const state = player.hideout;
  const job = state.construction;
  if (!job || now < job.endsAt) return;
  const rowsBefore = effect(state, data, "stashRows");
  const incomeBefore = effect(state, data, "incomePerHour");
  state.modules[job.module] = job.level;
  state.construction = null;
  player.inventory.stash.addRows(
    Math.max(0, effect(state, data, "stashRows") - rowsBefore),
  );
  // A renda começa a contar quando a primeira estação fica pronta
  if (incomeBefore === 0) state.incomeSince = job.endsAt;
}

/**
 * Passa o tempo do esconderijo até `now` (também o tempo com o jogo
 * fechado): conclui a obra, cura e alimenta o PMC pelo que os módulos dão
 * por minuto. Devolve os minutos calculados.
 */
export function hideoutTick(
  player: PlayerState,
  data: HideoutData,
  now: number,
): number {
  const state = player.hideout;
  const job = state.construction;
  // A cura até o fim da obra usa o nível antigo; depois, o novo
  if (job && job.endsAt <= now && job.endsAt > state.lastTick) {
    regen(player, data, job.endsAt);
  }
  finishConstruction(player, data, now);
  return regen(player, data, now);
}

function regen(player: PlayerState, data: HideoutData, until: number): number {
  const state = player.hideout;
  const minutes = Math.max(0, until - state.lastTick) / MINUTE;
  state.lastTick = Math.max(state.lastTick, until);
  const { pmc } = player;
  if (minutes === 0 || isDead(pmc)) return minutes;
  const interval = effect(state, data, "surgeryMinutes");
  if (interval > 0) operate(player, minutes, interval);
  const healing = effect(state, data, "healPerMinute") * minutes;
  if (healing > 0) heal(pmc, healing);
  changeEnergy(pmc, effect(state, data, "energyPerMinute") * minutes);
  changeHydration(pmc, effect(state, data, "hydrationPerMinute") * minutes);
  return minutes;
}

/**
 * Cirurgia da enfermaria: a cada `interval` minutos, uma parte destruída
 * volta com 1 PV (na ordem de `BODY_PARTS`). O progresso fica guardado entre
 * os cálculos e some quando não há mais parte destruída.
 */
function operate(player: PlayerState, minutes: number, interval: number) {
  const { pmc, hideout } = player;
  const destroyed = () => BODY_PARTS.find((p) => pmc.health[p] <= 0);
  let progress = (hideout.surgeryProgress ?? 0) + minutes;
  for (
    let part = destroyed();
    part && progress >= interval;
    part = destroyed()
  ) {
    restorePart(pmc, part);
    progress -= interval;
  }
  if (destroyed()) hideout.surgeryProgress = progress;
  else delete hideout.surgeryProgress;
}

/** Duração de uma receita com o desconto do gerador */
export function recipeDuration(
  state: HideoutState,
  data: HideoutData,
  recipe: RecipeDef,
): number {
  const cut = Math.min(0.9, effect(state, data, "productionSpeed"));
  return Math.round(recipe.durationMs * (1 - cut));
}

/** Motivos que impedem começar a receita (vazio = pode) */
export function productionBlockers(
  player: PlayerState,
  data: HideoutData,
  recipe: RecipeDef,
): string[] {
  const state = player.hideout;
  const def = data.modules.find((m) => m.id === recipe.module)!;
  const blockers: string[] = [];
  if (moduleLevel(state, def.id) < recipe.moduleLevel) {
    blockers.push(`${def.name} nível ${recipe.moduleLevel}`);
  }
  if (state.productions[def.id]) blockers.push("Produção em andamento");
  const missing = missingItems(player, recipe.inputs);
  if (missing.length > 0) blockers.push(`Faltam: ${missing.join(", ")}`);
  return blockers;
}

/** Começa a receita: tira os ingredientes do estoque e marca o fim */
export function startProduction(
  player: PlayerState,
  data: HideoutData,
  recipeId: string,
  now: number,
): TradeResult {
  const recipe = data.recipes.find((r) => r.id === recipeId);
  if (!recipe) return fail("Receita não existe");
  const blockers = productionBlockers(player, data, recipe);
  if (blockers.length > 0) return fail(blockers[0]);
  for (const c of recipe.inputs) take(player, c.item, c.count);
  player.hideout.productions[recipe.module] = {
    recipe: recipe.id,
    endsAt: now + recipeDuration(player.hideout, data, recipe),
  };
  return { ok: true, amount: 0 };
}

/** Retira o produto pronto do módulo para o estoque (precisa caber) */
export function collectProduction(
  player: PlayerState,
  data: HideoutData,
  moduleId: string,
  now: number,
): TradeResult {
  const job = player.hideout.productions[moduleId];
  if (!job) return fail("Nada sendo produzido");
  if (now < job.endsAt) return fail("Ainda não terminou");
  const recipe = data.recipes.find((r) => r.id === job.recipe);
  if (recipe) {
    const def = player.factory.catalog.get(recipe.output.item);
    const items = createStacks(player, def, recipe.output.count);
    if (!storeAll(items, player.inventory.stash)) {
      return fail("Sem espaço no estoque");
    }
  }
  // Receita que saiu do jogo: a produção só é descartada
  delete player.hideout.productions[moduleId];
  return { ok: true, amount: recipe?.output.count ?? 0 };
}

/** Rublos acumulados pela renda passiva (limitados ao máximo) */
export function incomeAvailable(
  state: HideoutState,
  data: HideoutData,
  now: number,
): number {
  const perHour = effect(state, data, "incomePerHour");
  const cap = effect(state, data, "incomeCap");
  const earned = Math.floor(
    (perHour * Math.max(0, now - state.incomeSince)) / HOUR,
  );
  return Math.min(cap, earned);
}

/** Coleta a renda passiva para o estoque; recomeça a contar de `now` */
export function collectIncome(
  player: PlayerState,
  data: HideoutData,
  now: number,
): TradeResult {
  const amount = incomeAvailable(player.hideout, data, now);
  if (amount === 0) return fail("Nada para coletar");
  const money = createStacks(
    player,
    player.factory.catalog.get("money_rub"),
    amount,
  );
  if (!storeAll(money, player.inventory.stash)) {
    return fail("Sem espaço no estoque");
  }
  player.hideout.incomeSince = now;
  return { ok: true, amount };
}
