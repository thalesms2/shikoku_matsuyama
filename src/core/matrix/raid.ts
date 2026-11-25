import { coreBalance } from "../balance.ts";
import type { Item } from "../inventory/item.ts";
import { weaponRounds } from "../inventory/magazine.ts";
import { detach } from "../inventory/operations.ts";
import { isConsumable } from "../pmc/consumables.ts";
import {
  changeEnergy,
  changeHydration,
  totalHealth,
  totalMaxHealth,
} from "../pmc/pmc.ts";
import { addSkillXp, skillBonus } from "../pmc/skills.ts";
import type { Rng } from "../rng.ts";
import type { PlayerState } from "../state.ts";
import {
  distance,
  fleeRoll,
  hearingRange,
  moveEnemy,
  perceptionContest,
  rollSpawn,
} from "./enemies.ts";
import type { MatrixEnemy } from "./enemies.ts";
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
  | "spawn"
  | "spotted"
  | "chased"
  | "flee"
  | "fight"
  | "death"
  | "extract";

export interface MatrixEvent {
  readonly turn: number;
  readonly kind: MatrixEventKind;
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

/** Como uma briga começa (12E decide; a 12F resolve) */
export interface FightStart {
  readonly enemy: MatrixEnemy;
  /** O personagem ataca primeiro */
  readonly playerFirst: boolean;
  /** O personagem tenta um headshot antes da briga */
  readonly playerHeadshot: boolean;
  /** O inimigo chegou sem ser notado: tenta um headshot */
  readonly enemyHeadshot: boolean;
}

/** Resultado de uma briga */
export type FightOutcome = "won" | "died" | "fled";

export interface MatrixRaidSetup {
  player: PlayerState;
  map: MatrixMap;
  strategy: MatrixStrategyId;
  rng: Rng;
  containers: Readonly<Record<ContainerKind, ContainerDef>>;
  /** O que o personagem sabe do mapa (padrão: tudo) */
  knowledge?: MatrixKnowledge;
  /** Nível da habilidade do mapa (ajuda a fugir) */
  knowledgeLevel?: number;
  /** Resolve uma briga (a 12F traz o combate d20); padrão: vence */
  fight?: (start: FightStart, raid: MatrixRaid) => FightOutcome;
}

export interface MatrixRaidResult {
  readonly events: readonly MatrixEvent[];
  readonly turns: number;
  readonly outcome: "extracted" | "killed";
  /** Extração usada (`null` se morreu) */
  readonly extract: MatrixExtract | null;
  /** Células percorridas, na ordem (inclui a de entrada) */
  readonly path: readonly Cell[];
  /** Itens achados nesta raid que ficaram com o personagem */
  readonly found: readonly Item[];
  readonly kills: number;
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

const ENEMY_NAMES = { scav: "um Scav", pmc: "um PMC inimigo" } as const;

/**
 * Raid em matriz. Entra numa linha sorteada da coluna da esquerda, planeja a
 * rota da estratégia (`planRoute`) e anda célula por célula; cada turno
 * gasto (andar, revistar) passa pelos inimigos (`enemyTurn`): spawn, movimento
 * e percepção. Revista os contêineres do caminho (12D) e sai pela extração.
 */
export class MatrixRaid {
  readonly events: MatrixEvent[] = [];
  readonly found: Item[] = [];
  readonly enemies: MatrixEnemy[] = [];
  readonly path: Cell[];
  turn = 0;
  kills = 0;
  dead = false;
  /** Largou a rota e vai para a extração */
  leaving = false;
  at: Cell;
  private nextEnemy = 1;
  private readonly origin = new Map<Item, number>();
  private readonly searched = new Set<string>();
  readonly knowledge: MatrixKnowledge;

  constructor(readonly setup: MatrixRaidSetup) {
    this.knowledge = setup.knowledge ?? fullKnowledge(setup.map);
    this.at = [0, setup.rng.int(0, setup.map.height - 1)];
    this.path = [this.at];
  }

  get player() {
    return this.setup.player;
  }
  get map() {
    return this.setup.map;
  }
  get strategy() {
    return this.setup.strategy;
  }
  get rng() {
    return this.setup.rng;
  }

  log(kind: MatrixEventKind, text: string): void {
    this.events.push({
      turn: this.turn,
      kind,
      x: this.at[0],
      y: this.at[1],
      text,
    });
  }

  /** Inimigos que vêm atrás e foram notados: o personagem está fugindo */
  get fleeing(): boolean {
    return this.enemies.some((e) => e.chasing && e.noticed);
  }

  /** Gasta turnos: energia, hidratação, Resistência e os inimigos de cada turno */
  spend(turns: number): void {
    const b = coreBalance().matrix;
    const { pmc, skills } = this.player;
    for (let i = 0; i < turns && !this.dead; i++) {
      this.turn += 1;
      changeEnergy(
        pmc,
        -b.energyPerTurn * (1 - skillBonus(skills, "endurance")),
      );
      changeHydration(
        pmc,
        -b.hydrationPerTurn * (1 - skillBonus(skills, "metabolism")),
      );
      addSkillXp(skills, "endurance", b.enduranceXpPerTurn);
      this.enemyTurn();
    }
  }

  // ---------------------------------------------------------------- inimigos

  private skill(id: "perception" | "stealth" | "endurance"): number {
    return (
      skillBonus(this.player.skills, id) * coreBalance().encounter.skillToD20
    );
  }

  /** Bônus do personagem para perceber */
  playerPerception(): number {
    return this.skill("perception");
  }

  /** Bônus do inimigo para perceber o personagem */
  enemyPerception(): number {
    const b = coreBalance().encounter;
    const visibility =
      this.player.inventory.equipment.get("backpack")?.def.stats?.visibility ??
      0;
    const safe = this.strategy === "safe" ? b.safeStealth : 0;
    return (
      this.map.difficulty * b.enemyPerDifficulty +
      visibility -
      this.skill("stealth") -
      safe
    );
  }

  /** Bônus para fugir: Resistência, Percepção e o conhecimento do mapa; o Rato foge mal */
  fleeBonus(): number {
    const b = coreBalance().encounter;
    const base =
      this.skill("endurance") +
      this.skill("perception") +
      (this.setup.knowledgeLevel ?? 0) * 0.5;
    return this.strategy === "rat" ? base - b.ratFleePenalty : base;
  }

  /** Remédio de cura e arma com munição no equipamento */
  hasSupplies(): boolean {
    const med = carried(this.player).some(
      (i) => isConsumable(i) && (i.def.stats!.heal ?? 0) > 0,
    );
    const ammo = (["primary", "secondary", "holster"] as const).some((slot) => {
      const w = this.player.inventory.equipment.get(slot);
      return w !== null && weaponRounds(w) > 0;
    });
    return med && ammo;
  }

  private healthRatio(): number {
    return totalHealth(this.player.pmc) / totalMaxHealth();
  }

  /** Viu o inimigo primeiro: briga? */
  wantsToFight(): boolean {
    switch (this.strategy) {
      case "rat":
        return false;
      case "safe":
        return this.healthRatio() > 0.6 && this.hasSupplies();
      default:
        return true;
    }
  }

  /** O inimigo vem atrás e foi notado: foge? (o Psicopata nunca foge) */
  wantsToFlee(): boolean {
    switch (this.strategy) {
      case "rat":
      case "safe":
        return true;
      case "neutral":
        return this.healthRatio() < 0.4;
      default:
        return false;
    }
  }

  /** Um turno dos inimigos: spawn, movimento e percepção */
  enemyTurn(): void {
    const spawned = rollSpawn(this.map, this.rng, this.nextEnemy);
    if (spawned) {
      this.nextEnemy += 1;
      this.enemies.push(spawned);
    }
    for (const enemy of this.enemies.slice()) {
      if (this.dead) continue;
      moveEnemy(enemy, this.map, this.at, this.rng);
      this.perceive(enemy);
    }
  }

  private perceive(enemy: MatrixEnemy): void {
    const name = ENEMY_NAMES[enemy.kind];
    const terrain = cellAt(this.map, ...this.at).terrain;
    const dist = distance(this.at, [enemy.x, enemy.y]);
    const inRange = dist <= hearingRange(this.strategy, terrain);
    if (!inRange && !enemy.chasing) {
      enemy.ignored = false;
      return;
    }
    if (enemy.chasing) {
      if (dist === 0) {
        // chegou: briga (de surpresa, se não foi notado)
        if (!enemy.noticed) this.log("fight", `${name} chegou sem ser notado!`);
        const playerFirst =
          enemy.noticed &&
          perceptionContest(
            this.rng,
            this.playerPerception(),
            this.enemyPerception(),
          ) > 0;
        this.startFight({
          enemy,
          playerFirst,
          playerHeadshot: false,
          enemyHeadshot: !enemy.noticed,
        });
        return;
      }
      if (!enemy.noticed) {
        // a cada célula que ele anda, o personagem tenta notar de novo
        if (
          perceptionContest(
            this.rng,
            this.playerPerception(),
            this.enemyPerception(),
          ) > 0
        ) {
          enemy.noticed = true;
          this.log("spotted", `Notou ${name} vindo na sua direção`);
          this.rat();
        }
        return;
      }
      if (this.wantsToFlee()) {
        if (fleeRoll(this.rng, this.fleeBonus())) {
          enemy.chasing = false;
          enemy.noticed = false;
          enemy.ignored = true;
          this.log("flee", `Despistou ${name}`);
          if (this.strategy === "aggressive" || this.strategy === "psycho") {
            this.startFight({
              enemy,
              playerFirst: true,
              playerHeadshot: true,
              enemyHeadshot: false,
            });
          }
        } else {
          this.log("flee", `Tentou despistar ${name}, sem sucesso`);
        }
        return;
      }
      // decide enfrentar: vai para cima com a iniciativa disputada
      const playerFirst =
        perceptionContest(
          this.rng,
          this.playerPerception(),
          this.enemyPerception(),
        ) > 0;
      this.startFight({
        enemy,
        playerFirst,
        playerHeadshot: false,
        enemyHeadshot: false,
      });
      return;
    }
    if (enemy.ignored) return;
    const contest = perceptionContest(
      this.rng,
      this.playerPerception(),
      this.enemyPerception(),
    );
    if (contest > 0) {
      this.log("spotted", `Viu ${name} antes de ser visto`);
      this.rat();
      if (this.wantsToFight()) {
        this.startFight({
          enemy,
          playerFirst: true,
          playerHeadshot: true,
          enemyHeadshot: false,
        });
      } else {
        enemy.ignored = true;
      }
    } else if (contest < 0) {
      enemy.chasing = true;
      this.log("chased", `${name} percebeu você e vem atrás`);
      this.rat();
    }
  }

  /** O Rato, ao entrar numa briga ou na percepção de alguém, vai para a extração */
  private rat(): void {
    if (this.strategy === "rat" && !this.leaving) {
      this.leaving = true;
      this.log("extract", "Com medo: indo direto para a extração");
    }
  }

  private startFight(start: FightStart): void {
    const name = ENEMY_NAMES[start.enemy.kind];
    this.log("fight", `Briga com ${name}`);
    this.rat();
    const outcome = (this.setup.fight ?? (() => "won" as const))(start, this);
    if (outcome === "died") {
      this.dead = true;
      this.log("death", `Morto por ${name}`);
      return;
    }
    if (outcome === "won") {
      this.kills += 1;
      this.enemies.splice(this.enemies.indexOf(start.enemy), 1);
      this.log("fight", `Abateu ${name}`);
      return;
    }
    start.enemy.chasing = false;
    start.enemy.noticed = false;
    start.enemy.ignored = true;
    this.log("flee", `Fugiu de ${name}`);
  }

  // -------------------------------------------------------------------- loot

  private search(): void {
    const { map, strategy, rng, player } = this;
    const b = coreBalance().matrix;
    const kind = cellAt(map, ...this.at).container;
    const k = `${this.at[0]},${this.at[1]}`;
    if (!kind || this.searched.has(k) || this.leaving) return;
    const def = this.setup.containers[kind];
    const turns = searchTurns(def, strategy, this.knowledge.containers.has(k));
    if (!wantsSearch(strategy, turns)) return;
    this.searched.add(k);
    this.spend(turns);
    if (this.dead) return;
    if (!rng.chance(findChance(def, strategy, player.skills))) {
      this.log("search", `Revistou ${def.name} e não achou nada`);
      return;
    }
    const item = rollContainer(def, rng, player.factory);
    addSkillXp(player.skills, "perception", b.perceptionXpPerLoot);
    this.store(item, def.rarity, def.name);
    const full = fullThreshold(strategy);
    const carry = player.inventory.equipment.carryGrids();
    if (full !== null && fillRatio(carry) >= full) this.leaving = true;
    if (this.leaving)
      this.log("extract", "Inventário cheio: indo para a extração");
  }

  /**
   * Guarda um item achado (contêiner ou corpo) pelas regras da estratégia
   * (`stashFound`) e registra no log. Devolve se coube.
   */
  store(item: Item, rarity: number, where: string): boolean {
    const { player, strategy } = this;
    const name = item.def.name;
    const count = item.count;
    const grids = [
      ...player.inventory.equipment.carryGrids(),
      ...(player.inventory.equipment.get("secure")?.grids ?? []),
    ];
    const result = stashFound(item, rarity, grids, this.origin, strategy);
    for (const old of result.dropped) {
      this.log("lootSwap", `Largou ${old.def.name} para levar algo melhor`);
    }
    if (result.stored) {
      this.found.push(item);
      this.log(
        "loot",
        `Achou ${count > 1 ? `${name} x${count}` : name} em ${where}`,
      );
      return true;
    }
    this.log("lootLeft", `Sem espaço: deixou ${name}`);
    if (leavesWhenFull(strategy)) this.leaving = true;
    return false;
  }

  // --------------------------------------------------------------- caminhada

  private walkTo(to: Cell, extracting: boolean): void {
    const extra = cellPenalty(this.map, this.strategy, this.knowledge);
    for (const cell of findPath(this.map, this.at, to, this.strategy, extra)) {
      const fleeing = this.fleeing ? coreBalance().encounter.fleeExtraTurns : 0;
      this.at = cell;
      this.path.push(cell);
      this.spend(stepTurns(this.map, cell, this.strategy) + fleeing);
      if (this.dead) return;
      this.search();
      if (this.dead || (this.leaving && !extracting)) return;
    }
  }

  run(): MatrixRaidResult {
    const { map, player, strategy, setup } = this;
    this.log(
      "start",
      `Entrou em ${map.name} (${MATRIX_STRATEGY_NAMES[strategy]})`,
    );
    const usable = (e: MatrixExtract) => canUseExtract(e, player);
    const rarity = (x: number, y: number) =>
      setup.containers[cellAt(map, x, y).container!].rarity;
    const plan = planRoute(
      map,
      this.at,
      strategy,
      this.knowledge,
      usable,
      rarity,
    );
    for (const target of plan.targets) {
      this.walkTo(target, false);
      if (this.dead || this.leaving) break;
      const poi = map.pois.find(
        (p) => p.cells[0][0] === target[0] && p.cells[0][1] === target[1],
      );
      const kind = cellAt(map, ...target).container!;
      this.log(
        "target",
        poi
          ? `Chegou em ${poi.name}`
          : `Chegou a: ${setup.containers[kind].name}`,
      );
    }
    let extract = plan.extract;
    if (!this.dead && !extract) {
      // Não conhece nenhuma: vai para a borda direita e procura
      this.walkTo([map.width - 1, this.at[1]], true);
      if (!this.dead) {
        this.log(
          "search",
          "Não sabe onde fica a extração: procurando pela borda",
        );
      }
      const [ax, ay] = this.at;
      extract = map.extracts
        .filter(usable)
        .sort(
          (a, c) =>
            Math.abs(a.y - ay) +
            Math.abs(a.x - ax) -
            (Math.abs(c.y - ay) + Math.abs(c.x - ax)),
        )[0];
    }
    if (!this.dead) this.walkTo([extract!.x, extract!.y], true);
    if (this.dead) return this.result("killed", null);
    const req = extract!.requirement;
    if (req?.kind === "payment") pay(player, req.item, req.amount);
    this.log("extract", `Extraiu por ${extract!.name}`);
    return this.result("extracted", extract!);
  }

  private result(
    outcome: "extracted" | "killed",
    extract: MatrixExtract | null,
  ): MatrixRaidResult {
    return {
      events: this.events,
      turns: this.turn,
      outcome,
      extract,
      path: this.path,
      found: this.found,
      kills: this.kills,
    };
  }
}

/** Atalho: cria e roda a raid */
export function runMatrixRaid(setup: MatrixRaidSetup): MatrixRaidResult {
  return new MatrixRaid(setup).run();
}
