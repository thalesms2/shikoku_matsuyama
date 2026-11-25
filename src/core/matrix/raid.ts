import { coreBalance } from "../balance.ts";
import type { Item } from "../inventory/item.ts";
import { detach } from "../inventory/operations.ts";
import { changeEnergy, changeHydration } from "../pmc/pmc.ts";
import { addSkillXp, skillBonus } from "../pmc/skills.ts";
import type { Rng } from "../rng.ts";
import type { PlayerState } from "../state.ts";
import {
  fillRatio,
  findChance,
  fullThreshold,
  leavesWhenFull,
  searchTurns,
  stashFound,
  wantsSearch,
} from "./loot.ts";
import { cellAt, rollContainer } from "./matrix.ts";
import { findPath, stepTurns } from "./path.ts";
import type { Cell } from "./path.ts";
import { cellPenalty, fullKnowledge, planRoute } from "./plan.ts";
import type { MatrixKnowledge } from "./plan.ts";
import { MATRIX_STRATEGY_NAMES } from "./strategy.ts";
import type { MatrixStrategyId } from "./strategy.ts";
import type {
  ContainerDef,
  ContainerKind,
  MatrixExtract,
  MatrixMap,
} from "./types.ts";

/** Tipos de evento do log da raid em matriz */
export type MatrixEventKind =
  | "start"
  | "target"
  | "search"
  | "loot"
  | "lootSwap"
  | "lootLeft"
  | "extract";

export interface MatrixEvent {
  readonly turn: number;
  readonly kind: MatrixEventKind;
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export interface MatrixRaidSetup {
  player: PlayerState;
  map: MatrixMap;
  strategy: MatrixStrategyId;
  rng: Rng;
  containers: Readonly<Record<ContainerKind, ContainerDef>>;
  /** O que o personagem sabe do mapa (padrão: tudo, até a 12C) */
  knowledge?: MatrixKnowledge;
}

export interface MatrixRaidResult {
  readonly events: readonly MatrixEvent[];
  readonly turns: number;
  readonly outcome: "extracted";
  readonly extract: MatrixExtract;
  /** Células percorridas, na ordem (inclui a de entrada) */
  readonly path: readonly Cell[];
  /** Itens achados nesta raid que ficaram com o personagem */
  readonly found: readonly Item[];
}

/** Itens do equipamento que contam para os requisitos (inclui o seguro) */
function carried(player: PlayerState): Item[] {
  const { equipment } = player.inventory;
  return [
    ...equipment.carryGrids(),
    ...(equipment.get("secure")?.grids ?? []),
  ].flatMap((g) => g.items());
}

/** Se o personagem pode usar a extração agora */
export function canUseExtract(
  extract: MatrixExtract,
  player: PlayerState,
): boolean {
  const req = extract.requirement;
  if (!req) return true;
  if (req.kind === "noBackpack") {
    return !player.inventory.equipment.get("backpack");
  }
  const items = carried(player).filter((i) => i.def.id === req.item);
  if (req.kind === "key") return items.length > 0;
  return items.reduce((sum, i) => sum + i.count, 0) >= req.amount;
}

/** Paga a passagem com o dinheiro do equipamento */
function pay(player: PlayerState, item: string, amount: number): void {
  let left = amount;
  for (const stack of carried(player)) {
    if (stack.def.id !== item || left <= 0) continue;
    const take = Math.min(stack.count, left);
    stack.count -= take;
    left -= take;
    if (stack.count === 0) detach(stack);
  }
}

/**
 * Raid em matriz (12B movimento, 12D loot). Entra numa linha sorteada da
 * coluna da esquerda, planeja a rota da estratégia (`planRoute`) e anda
 * célula por célula gastando `stepTurns` turnos (com energia, hidratação e
 * XP de Resistência por turno). Em cada célula com contêiner ainda não
 * revistado, a estratégia decide se revista (`wantsSearch`): gasta
 * `searchTurns`, acha com `findChance` e guarda com `stashFound`. Inventário
 * cheio (`fullThreshold`, ou item que não coube em `leavesWhenFull`) larga o
 * resto da rota e vai para a extração. Sem extração conhecida, vai até a
 * coluna da direita e procura a mais próxima.
 */
export function runMatrixRaid(setup: MatrixRaidSetup): MatrixRaidResult {
  const { player, map, strategy, rng, containers } = setup;
  const knowledge = setup.knowledge ?? fullKnowledge(map);
  const b = coreBalance().matrix;
  const events: MatrixEvent[] = [];
  const found: Item[] = [];
  const origin = new Map<Item, number>();
  const searched = new Set<string>();
  const grids = [
    ...player.inventory.equipment.carryGrids(),
    ...(player.inventory.equipment.get("secure")?.grids ?? []),
  ];
  const carry = player.inventory.equipment.carryGrids();
  let turn = 0;
  let leaving = false;
  let at: Cell = [0, rng.int(0, map.height - 1)];
  const path: Cell[] = [at];
  const log = (kind: MatrixEventKind, text: string) =>
    events.push({ turn, kind, x: at[0], y: at[1], text });
  const spend = (turns: number) => {
    turn += turns;
    const { pmc, skills } = player;
    changeEnergy(
      pmc,
      -b.energyPerTurn * turns * (1 - skillBonus(skills, "endurance")),
    );
    changeHydration(
      pmc,
      -b.hydrationPerTurn * turns * (1 - skillBonus(skills, "metabolism")),
    );
    addSkillXp(skills, "endurance", b.enduranceXpPerTurn * turns);
  };
  const search = () => {
    const kind = cellAt(map, ...at).container;
    const k = `${at[0]},${at[1]}`;
    if (!kind || searched.has(k) || leaving) return;
    const def = containers[kind];
    const turns = searchTurns(def, strategy, knowledge.containers.has(k));
    if (!wantsSearch(strategy, turns)) return;
    searched.add(k);
    spend(turns);
    if (!rng.chance(findChance(def, strategy, player.skills))) {
      log("search", `Revistou ${def.name} e não achou nada`);
      return;
    }
    const item = rollContainer(def, rng, player.factory);
    const name = item.def.name;
    const count = item.count;
    addSkillXp(player.skills, "perception", b.perceptionXpPerLoot);
    const result = stashFound(item, def.rarity, grids, origin, strategy);
    for (const old of result.dropped) {
      log("lootSwap", `Largou ${old.def.name} para levar algo melhor`);
    }
    if (result.stored) {
      found.push(item);
      log(
        "loot",
        `Achou ${count > 1 ? `${name} x${count}` : name} em ${def.name}`,
      );
    } else {
      log("lootLeft", `Sem espaço: deixou ${name}`);
      if (leavesWhenFull(strategy)) leaving = true;
    }
    const full = fullThreshold(strategy);
    if (full !== null && fillRatio(carry) >= full) leaving = true;
    if (leaving) log("extract", "Inventário cheio: indo para a extração");
  };
  const extra = cellPenalty(map, strategy, knowledge);
  const walkTo = (to: Cell) => {
    for (const cell of findPath(map, at, to, strategy, extra)) {
      spend(stepTurns(map, cell, strategy));
      at = cell;
      path.push(cell);
      search();
      if (leaving && !extracting) return;
    }
  };
  let extracting = false;

  log("start", `Entrou em ${map.name} (${MATRIX_STRATEGY_NAMES[strategy]})`);
  const usable = (e: MatrixExtract) => canUseExtract(e, player);
  const rarity = (x: number, y: number) =>
    containers[cellAt(map, x, y).container!].rarity;
  const plan = planRoute(map, at, strategy, knowledge, usable, rarity);
  for (const target of plan.targets) {
    walkTo(target);
    if (leaving) break;
    const poi = map.pois.find(
      (p) => p.cells[0][0] === target[0] && p.cells[0][1] === target[1],
    );
    const kind = cellAt(map, ...target).container!;
    log(
      "target",
      poi ? `Chegou em ${poi.name}` : `Chegou a: ${containers[kind].name}`,
    );
  }
  extracting = true;
  let extract = plan.extract;
  if (!extract) {
    // Não conhece nenhuma: vai para a borda direita e procura
    walkTo([map.width - 1, at[1]]);
    log("search", "Não sabe onde fica a extração: procurando pela borda");
    extract = map.extracts
      .filter(usable)
      .sort(
        (a, c) =>
          Math.abs(a.y - at[1]) +
          Math.abs(a.x - at[0]) -
          (Math.abs(c.y - at[1]) + Math.abs(c.x - at[0])),
      )[0];
  }
  walkTo([extract.x, extract.y]);
  const req = extract.requirement;
  if (req?.kind === "payment") pay(player, req.item, req.amount);
  log("extract", `Extraiu por ${extract.name}`);
  return { events, turns: turn, outcome: "extracted", extract, path, found };
}
