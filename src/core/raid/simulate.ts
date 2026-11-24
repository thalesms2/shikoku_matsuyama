import { SLOT_NAMES } from "../inventory/equipment.ts";
import type { Grid } from "../inventory/grid.ts";
import { totalValue } from "../inventory/item.ts";
import type { Item } from "../inventory/item.ts";
import {
  freeRounds,
  isMagazine,
  loadRounds,
  loadedRounds,
  popRound,
  sameCaliber,
  weaponRounds,
} from "../inventory/magazine.ts";
import { detach } from "../inventory/operations.ts";
import {
  MAG_DRILLS_XP_PER_ROUND,
  isConsumable,
  useConsumable,
} from "../pmc/consumables.ts";
import {
  BODY_PARTS,
  BODY_PART_LABELS,
  MAX_ENERGY,
  MAX_HEALTH,
  MAX_HYDRATION,
  VITAL_PARTS,
  addPmcXp,
  changeEnergy,
  changeHydration,
  damage,
  isDead,
  restorePart,
  totalHealth,
  totalMaxHealth,
} from "../pmc/pmc.ts";
import type { BodyPart } from "../pmc/pmc.ts";
import { SKILLS, addSkillXp, skillBonus } from "../pmc/skills.ts";
import type { SkillId } from "../pmc/skills.ts";
import type { Rng } from "../rng.ts";
import type { PlayerState } from "../state.ts";
import {
  HIT_ZONES,
  armorFactor,
  burstFor,
  enemyHitChance,
  firstShotChance,
  playerHitChance,
  protectedBy,
  vitalityFactor,
} from "./combat.ts";
import { rollLoot, stashLoot } from "./loot.ts";
import { KARMA, STRATEGIES } from "./strategy.ts";
import type { Strategy } from "./strategy.ts";
import { NO_MODIFIERS } from "./types.ts";
import type {
  EnemyDef,
  EnemyKind,
  ExtractDef,
  ItemSummary,
  LootRule,
  MapDef,
  RaidEvent,
  RaidModifiers,
  RaidEventKind,
  RaidOutcome,
  RaidSummary,
  StrategyId,
} from "./types.ts";

/** Duração de cada passo da raid, em minutos (antes da estratégia) */
export const STEP_MINUTES: readonly [number, number] = [2, 5];
/** Peso de cada tipo de evento a cada passo */
export const EVENT_WEIGHTS = { loot: 4, hazard: 0.4, quiet: 2.5 } as const;
/** Gasto por minuto de raid */
export const ENERGY_PER_MINUTE = 0.15;
export const HYDRATION_PER_MINUTE = 0.2;
/** Dano por minuto no estômago com energia ou hidratação zerada */
export const STARVING_DAMAGE_PER_MINUTE = 0.6;
/** Passo mais lento por perna destruída */
export const LEG_PACE_PENALTY = 0.25;
/** Trocas de tiro até o inimigo recuar */
export const MAX_EXCHANGES = 6;
export const MINUTES_PER_EXCHANGE = 0.5;
/** Chance de fugir quando não há munição */
export const FLEE_CHANCE = 0.4;
/** Usa remédio abaixo desta fração da vida total ou de uma parte vital */
export const HEAL_BELOW = 0.6;
/** Come ou bebe abaixo deste valor */
export const EAT_BELOW = 35;
export const EXTRACT_MINUTES = 2;

/** XP do PMC, recebido só ao extrair */
export const RAID_XP = {
  extract: 300,
  perMinute: 5,
  kill: { scav: 120, pmc: 400 } as Record<EnemyKind, number>,
  /** XP por 1000 de valor de loot */
  per1000Value: 1,
} as const;

/** XP de skills, mantido mesmo quando o PMC morre */
export const RAID_SKILL_XP = {
  endurancePerMinute: 0.5,
  perceptionPerLoot: 2,
  stealthPerAvoid: 4,
  aimPerHit: 1,
  vitalityPerDamage: 0.05,
  strengthPerCell: 0.2,
} as const;

export const HAZARDS: readonly {
  text: string;
  parts: readonly BodyPart[];
  damage: readonly [number, number];
}[] = [
  {
    text: "Tropeçou em arame farpado",
    parts: ["leftLeg", "rightLeg"],
    damage: [8, 18],
  },
  {
    text: "Caiu de uma escada podre",
    parts: ["leftLeg", "rightLeg"],
    damage: [10, 25],
  },
  {
    text: "Cortou o braço em vidro quebrado",
    parts: ["leftArm", "rightArm"],
    damage: [8, 16],
  },
  {
    text: "Atingido por estilhaços de uma explosão distante",
    parts: ["thorax", "stomach", "leftArm", "rightArm"],
    damage: [10, 22],
  },
];

export const QUIET_TEXTS: readonly string[] = [
  "Atravessou a área sem ser visto",
  "Esperou um tiroteio distante acabar",
  "Ouviu passos e ficou parado até sumirem",
  "Contornou um prédio desabado",
  "Observou a rua antes de seguir",
];

export interface RaidSetup {
  player: PlayerState;
  map: MapDef;
  strategy: StrategyId;
  enemies: Readonly<Record<EnemyKind, EnemyDef>>;
  rng: Rng;
  lootRule: LootRule;
  /** Ajustes da raid Scav (karma); sem eles, nada muda */
  modifiers?: RaidModifiers;
}

export interface RaidRun {
  events: RaidEvent[];
  summary: RaidSummary;
}

const WEAPON_SLOTS = ["primary", "secondary", "holster"] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

const label = (def: Item["def"], n: number) =>
  n > 1 ? `${def.name} x${n}` : def.name;

/** Valor numérico de um stat do item (0 se não tiver) */
export function statOf(
  def: Item["def"],
  key:
    | "damage"
    | "penetration"
    | "armorClass"
    | "heal"
    | "energy"
    | "hydration",
): number {
  return def.stats?.[key] ?? 0;
}

/** Item ainda está com o PMC (em algum slot ou bolso, direta ou indiretamente) */
export function isCarried(item: Item, player: PlayerState): boolean {
  let current: Item = item;
  for (;;) {
    const loc = current.location;
    if (!loc) return false;
    if (loc.kind === "slot") return true;
    if (loc.kind === "weapon") current = loc.weapon;
    else if (loc.grid.owner) current = loc.grid.owner;
    else return player.inventory.equipment.pockets.includes(loc.grid);
  }
}

function summarize(items: Iterable<{ def: Item["def"]; count: number }>) {
  const byDef = new Map<string, ItemSummary>();
  for (const { def, count } of items) {
    if (count <= 0) continue;
    const prev = byDef.get(def.id);
    byDef.set(def.id, {
      def: def.id,
      name: def.name,
      count: (prev?.count ?? 0) + count,
    });
  }
  return [...byDef.values()];
}

/** Simulação de uma raid; altera o `PlayerState` e produz o log */
export class RaidSimulation {
  readonly events: RaidEvent[] = [];
  readonly strategy: Strategy;
  readonly mods: RaidModifiers;
  t = 0;
  karma = 0;
  readonly kills: Record<EnemyKind, number> = { scav: 0, pmc: 0 };
  /** Loot desta raid (instâncias) */
  readonly found = new Set<Item>();
  /** Unidades de loot guardadas por tipo (inclui as que entraram em pilhas) */
  readonly gained = new Map<string, { def: Item["def"]; count: number }>();
  killedBy: string | null = null;
  extract: ExtractDef | null = null;
  private readonly skillsBefore: Record<SkillId, number>;

  constructor(private readonly setup: RaidSetup) {
    this.strategy = STRATEGIES[setup.strategy];
    this.mods = setup.modifiers ?? NO_MODIFIERS;
    this.skillsBefore = { ...setup.player.skills };
  }

  get player() {
    return this.setup.player;
  }
  get rng() {
    return this.setup.rng;
  }
  get equipment() {
    return this.player.inventory.equipment;
  }

  log(kind: RaidEventKind, text: string): void {
    this.events.push({ t: round1(this.t), kind, text });
  }

  /** Grades onde o loot é guardado: equipamento e, por último, o contêiner seguro */
  lootGrids(): Grid[] {
    return [
      ...this.equipment.carryGrids(),
      ...(this.equipment.get("secure")?.grids ?? []),
    ];
  }

  /** Itens no equipamento (sem entrar em sub-contêineres) */
  carriedItems(): Item[] {
    return this.lootGrids().flatMap((g) => g.items());
  }

  // ------------------------------------------------------------------ fluxo

  run(): RaidRun {
    const { map } = this.setup;
    this.player.loader.cancel();
    this.log("start", `Entrou em ${map.name} (${this.strategy.name})`);
    const [from, to] = this.strategy.extractAt;
    const extractAt = map.duration * (from + this.rng.next() * (to - from));
    let outcome: RaidOutcome | null = null;
    while (outcome === null) {
      const legs = (["leftLeg", "rightLeg"] as const).filter(
        (p) => this.player.pmc.health[p] <= 0,
      ).length;
      const step =
        this.rng.int(...STEP_MINUTES) *
        this.strategy.pace *
        (1 + LEG_PACE_PENALTY * legs);
      this.advance(step);
      if (isDead(this.player.pmc)) outcome = "killed";
      else if (this.t > map.duration) outcome = "mia";
      else if (this.t >= extractAt) outcome = this.tryExtract();
      else this.event();
      if (outcome === null && isDead(this.player.pmc)) outcome = "killed";
    }
    if (outcome === "mia") {
      this.t = Math.max(this.t, map.duration);
      this.log("mia", "O tempo acabou. Desaparecido em combate (MIA)");
    } else if (outcome === "killed") {
      this.log("death", `Morto${this.killedBy ? ` por ${this.killedBy}` : ""}`);
    }
    return this.finish(outcome);
  }

  /** Passa o tempo: gasta energia e hidratação e dá XP de Resistência */
  advance(minutes: number): void {
    this.t += minutes;
    const { pmc, skills } = this.player;
    changeEnergy(
      pmc,
      -ENERGY_PER_MINUTE * minutes * (1 - skillBonus(skills, "endurance")),
    );
    changeHydration(
      pmc,
      -HYDRATION_PER_MINUTE * minutes * (1 - skillBonus(skills, "metabolism")),
    );
    addSkillXp(skills, "endurance", RAID_SKILL_XP.endurancePerMinute * minutes);
    if (pmc.energy <= 0 || pmc.hydration <= 0) {
      damage(pmc, "stomach", STARVING_DAMAGE_PER_MINUTE * minutes);
      this.log("starving", "Sem energia ou água: o corpo começa a falhar");
    }
    this.selfCare();
  }

  event(): void {
    const { map } = this.setup;
    const perception = 1 + skillBonus(this.player.skills, "perception");
    const kind = this.rng.weighted<"loot" | EnemyKind | "hazard" | "quiet">([
      {
        value: "loot",
        weight:
          EVENT_WEIGHTS.loot *
          this.strategy.loot *
          perception *
          this.mods.lootWeight,
      },
      { value: "scav", weight: map.threats.scav * this.strategy.encounter },
      { value: "pmc", weight: map.threats.pmc * this.strategy.encounter },
      { value: "hazard", weight: EVENT_WEIGHTS.hazard },
      { value: "quiet", weight: EVENT_WEIGHTS.quiet },
    ]);
    if (kind === "loot") this.searchLoot(perception - 1);
    else if (kind === "hazard") this.hazard();
    else if (kind === "quiet") this.log("quiet", this.rng.pick(QUIET_TEXTS));
    else this.fight(kind);
  }

  // ------------------------------------------------------------------- loot

  searchLoot(extraChance: number): void {
    this.takeLoot(this.rollLoot());
    if (this.rng.chance(extraChance)) {
      this.takeLoot(this.rollLoot(), " (olhar atento)");
    }
  }

  /**
   * Sorteia um item da tabela do mapa. Com `lootQuality`, pode sortear de
   * novo e ficar com o mais valioso (positivo) ou o menos valioso (negativo).
   */
  rollLoot(): Item {
    const roll = () =>
      rollLoot(this.setup.map.loot, this.rng, this.player.factory);
    const item = roll();
    const quality = this.mods.lootQuality;
    if (quality === 0 || !this.rng.chance(Math.abs(quality))) return item;
    const other = roll();
    const otherIsBetter = totalValue(other) > totalValue(item);
    return otherIsBetter === quality > 0 ? other : item;
  }

  takeLoot(item: Item, where = ""): void {
    const { def } = item;
    const total = item.count;
    const result = stashLoot(
      item,
      this.lootGrids(),
      this.found,
      this.setup.lootRule,
    );
    addSkillXp(
      this.player.skills,
      "perception",
      RAID_SKILL_XP.perceptionPerLoot,
    );
    for (const dropped of result.dropped) {
      this.addGained(dropped.def, -dropped.count);
      this.log(
        "lootSwap",
        `Largou ${label(dropped.def, dropped.count)} para abrir espaço`,
      );
    }
    if (result.stored > 0) {
      if (item.location) this.found.add(item);
      this.addGained(def, result.stored);
      addSkillXp(
        this.player.skills,
        "strength",
        RAID_SKILL_XP.strengthPerCell * def.width * def.height,
      );
      this.log("loot", `Encontrou ${label(def, result.stored)}${where}`);
    }
    if (result.stored < total) {
      this.log(
        "lootLeft",
        `Sem espaço: deixou ${label(def, total - result.stored)}`,
      );
    }
  }

  addGained(def: Item["def"], count: number): void {
    const prev = this.gained.get(def.id);
    this.gained.set(def.id, { def, count: (prev?.count ?? 0) + count });
  }

  // ---------------------------------------------------------------- perigos

  hazard(): void {
    const hazard = this.rng.pick(HAZARDS);
    const part = this.rng.pick(hazard.parts);
    const amount = this.rng.int(...hazard.damage);
    this.hurt(part, amount);
    this.log(
      "hazard",
      `${hazard.text}: ${BODY_PART_LABELS[part]} −${Math.round(amount * vitalityFactor(this.player.skills))}`,
    );
    this.selfCare();
  }

  /** Dano no PMC já reduzido pela Vitalidade; dá XP de Vitalidade */
  hurt(part: BodyPart, amount: number): number {
    const dealt = amount * vitalityFactor(this.player.skills);
    damage(this.player.pmc, part, dealt);
    addSkillXp(
      this.player.skills,
      "vitality",
      dealt * RAID_SKILL_XP.vitalityPerDamage,
    );
    return dealt;
  }

  // ------------------------------------------------------------- cuidados

  /** Usa remédios, comida e água do equipamento quando precisa */
  selfCare(): void {
    const { pmc, skills } = this.player;
    if (isDead(pmc)) return;
    // Só conta o que um remédio consegue curar (partes destruídas não)
    const healable = () =>
      BODY_PARTS.some(
        (p) => pmc.health[p] > 0 && pmc.health[p] < MAX_HEALTH[p],
      );
    const needsHeal = () =>
      healable() &&
      (totalHealth(pmc) / totalMaxHealth() < HEAL_BELOW ||
        VITAL_PARTS.some((p) => pmc.health[p] / MAX_HEALTH[p] < HEAL_BELOW));
    while (needsHeal()) {
      const med = this.bestConsumable("heal");
      if (!med) break;
      const name = med.def.name;
      const used = useConsumable(med, pmc, skills);
      this.log("heal", `Usou ${name} (+${Math.round(used!.healed)} PV)`);
    }
    for (const stat of ["energy", "hydration"] as const) {
      if (pmc[stat] >= EAT_BELOW) continue;
      const food = this.bestConsumable(stat);
      if (!food) continue;
      const name = food.def.name;
      useConsumable(food, pmc, skills);
      this.log("eat", `Consumiu ${name}`);
    }
  }

  /** Consumível do equipamento com o maior valor positivo de `stat` */
  bestConsumable(stat: "heal" | "energy" | "hydration"): Item | null {
    let best: Item | null = null;
    for (const item of this.carriedItems()) {
      const value = statOf(item.def, stat);
      if (!isConsumable(item) || value <= 0) continue;
      if (!best || value > statOf(best.def, stat)) best = item;
    }
    return best;
  }

  // ------------------------------------------------------------ armas

  /** Primeira arma equipada com munição no carregador */
  readyWeapon(): Item | null {
    for (const slot of WEAPON_SLOTS) {
      const weapon = this.equipment.get(slot);
      if (weapon && weaponRounds(weapon) > 0) return weapon;
    }
    return null;
  }

  /**
   * Troca o carregador vazio de uma arma equipada por um carregador com
   * munição do equipamento. O vazio vai para o lugar do novo.
   */
  swapMagazine(): boolean {
    for (const slot of WEAPON_SLOTS) {
      const weapon = this.equipment.get(slot);
      if (!weapon) continue;
      const spare = this.carriedItems().find(
        (i) =>
          isMagazine(i) &&
          loadedRounds(i) > 0 &&
          sameCaliber(i.def, weapon.def),
      );
      if (!spare) continue;
      const spot = spare.location as Extract<
        Item["location"],
        { kind: "grid" }
      >;
      const empty = weapon.magazine;
      detach(spare);
      if (empty) {
        detach(empty);
        if (spot.grid.canPlace(empty, spot.x, spot.y, spot.rotated)) {
          spot.grid.place(empty, spot.x, spot.y, spot.rotated);
        }
      }
      weapon.magazine = spare;
      spare.location = { kind: "weapon", weapon };
      this.log("reload", `Trocou o carregador de ${weapon.def.name}`);
      return true;
    }
    return false;
  }

  /**
   * Fora de combate: completa os carregadores (das armas e do equipamento)
   * com munição solta do equipamento. Dá XP de Manuseio de carregador.
   */
  topUpMagazines(): void {
    const mags = [
      ...WEAPON_SLOTS.flatMap((s) => this.equipment.get(s)?.magazine ?? []),
      ...this.carriedItems().filter(isMagazine),
    ];
    let loaded = 0;
    for (const mag of mags) {
      for (const ammo of this.carriedItems()) {
        if (freeRounds(mag) === 0) break;
        if (ammo.def.category !== "ammo") continue;
        loaded += loadRounds(mag, ammo);
      }
    }
    if (loaded > 0) {
      addSkillXp(
        this.player.skills,
        "magDrills",
        loaded * MAG_DRILLS_XP_PER_ROUND,
      );
      this.log("reload", `Recarregou ${loaded} cartuchos`);
    }
  }

  // ---------------------------------------------------------------- combate

  fight(kind: EnemyKind): void {
    const { player, rng, strategy } = this;
    const enemy = this.setup.enemies[kind];
    const friendly = this.mods.friendlyScav;
    if (kind === "scav" && friendly > 0 && rng.chance(friendly)) {
      this.log(
        "avoid",
        `Cruzou com ${enemy.name}, que reconheceu você e seguiu em frente`,
      );
      return;
    }
    const armorClass = rng.pick(enemy.armorClasses);
    let health = enemy.health;
    this.log(
      "encounter",
      `Avistou ${enemy.name}${armorClass > 0 ? ` (colete classe ${armorClass})` : ""}`,
    );
    const avoid = strategy.avoid + skillBonus(player.skills, "stealth") / 2;
    if (rng.chance(avoid)) {
      this.karma += KARMA.avoid;
      addSkillXp(player.skills, "stealth", RAID_SKILL_XP.stealthPerAvoid);
      this.log("avoid", `Evitou ${enemy.name} sem ser visto`);
      return;
    }
    const playerFirst = rng.chance(
      firstShotChance(player.skills, strategy.initiative),
    );
    const enemyHit = enemyHitChance(enemy, this.setup.map.difficulty);
    for (let exchange = 0; exchange < MAX_EXCHANGES; exchange++) {
      this.t += MINUTES_PER_EXCHANGE;
      for (const side of playerFirst ? [0, 1] : [1, 0]) {
        if (side === 0) {
          const result = this.playerTurn(enemy, armorClass);
          if (result === "fled") return;
          health -= result;
          if (health <= 0) {
            this.won(enemy);
            return;
          }
        } else {
          this.enemyTurn(enemy, enemyHit);
          if (isDead(player.pmc)) {
            this.killedBy = enemy.name;
            return;
          }
        }
      }
    }
    this.log("disengage", `${enemy.name} recuou`);
    this.afterFight();
  }

  /** Dispara uma rajada; devolve o dano causado ou `"fled"` se fugiu */
  playerTurn(enemy: EnemyDef, armorClass: number): number | "fled" {
    const weapon = this.readyWeapon();
    if (!weapon) {
      if (this.swapMagazine()) return 0;
      if (this.rng.chance(FLEE_CHANCE)) {
        this.log("flee", `Sem munição, fugiu de ${enemy.name}`);
        this.afterFight();
        return "fled";
      }
      this.log("flee", "Sem munição, tentou fugir e não conseguiu");
      return 0;
    }
    const chance = playerHitChance(this.player.pmc, this.player.skills);
    const shots = Math.min(burstFor(weapon.def), weaponRounds(weapon));
    let hits = 0;
    let dealt = 0;
    for (let i = 0; i < shots; i++) {
      // A rajada nunca passa da munição carregada
      const ammo = popRound(weapon.magazine!)!;
      if (!this.rng.chance(chance)) continue;
      hits++;
      dealt +=
        statOf(ammo, "damage") *
        armorFactor(statOf(ammo, "penetration"), armorClass);
    }
    addSkillXp(this.player.skills, "aim", hits * RAID_SKILL_XP.aimPerHit);
    this.log(
      "hit",
      `${shots} disparo(s) com ${weapon.def.shortName}: ${hits} acerto(s)${hits > 0 ? ` (−${Math.round(dealt)})` : ""}`,
    );
    return dealt;
  }

  enemyTurn(enemy: EnemyDef, chance: number): void {
    const wounds: string[] = [];
    for (let i = 0; i < enemy.burst; i++) {
      if (!this.rng.chance(chance)) continue;
      const part = this.rng.weighted(HIT_ZONES);
      const slot = protectedBy(part);
      const armor = slot ? this.equipment.get(slot) : null;
      const armorClass = armor ? statOf(armor.def, "armorClass") : 0;
      const dealt = this.hurt(
        part,
        enemy.damage * armorFactor(enemy.penetration, armorClass),
      );
      wounds.push(`${BODY_PART_LABELS[part]} −${Math.round(dealt)}`);
      if (isDead(this.player.pmc)) break;
    }
    this.log(
      "wounded",
      wounds.length > 0
        ? `${enemy.name} acertou: ${wounds.join(", ")}`
        : `${enemy.name} errou`,
    );
  }

  won(enemy: EnemyDef): void {
    this.kills[enemy.kind]++;
    this.karma += enemy.kind === "scav" ? KARMA.killScav : KARMA.killPmc;
    this.log("kill", `Abateu ${enemy.name}`);
    if (this.rng.chance(this.strategy.searchBody)) {
      this.takeLoot(this.rollLoot(), " no corpo");
    }
    this.afterFight();
  }

  afterFight(): void {
    this.selfCare();
    this.topUpMagazines();
  }

  // -------------------------------------------------------------- extração

  canUse(extract: ExtractDef): boolean {
    const req = extract.requirement;
    if (!req) return true;
    if (req.kind === "noBackpack") return !this.equipment.get("backpack");
    const items = this.carriedItems().filter((i) => i.def.id === req.item);
    if (req.kind === "key") return items.length > 0;
    return items.reduce((sum, i) => sum + i.count, 0) >= req.amount;
  }

  pay(item: string, amount: number): void {
    let left = amount;
    for (const stack of this.carriedItems()) {
      if (stack.def.id !== item || left <= 0) continue;
      const take = Math.min(stack.count, left);
      stack.count -= take;
      left -= take;
      if (stack.count === 0) detach(stack);
    }
  }

  tryExtract(): RaidOutcome | null {
    const options = this.setup.map.extracts
      .filter((e) => this.canUse(e))
      .sort((a, b) => a.risk - b.risk);
    // Todo mapa tem uma extração sem requisito
    const extract = options[0];
    const req = extract.requirement;
    this.log("extract", `Indo para a extração: ${extract.name}`);
    if (req?.kind === "payment") {
      this.pay(req.item, req.amount);
      this.log("extract", `Pagou ${req.amount} pela passagem`);
    }
    const ambush =
      extract.risk * this.strategy.encounter * this.mods.extractRisk;
    if (this.rng.chance(ambush)) {
      const kind = this.rng.weighted([
        { value: "scav" as const, weight: this.setup.map.threats.scav },
        { value: "pmc" as const, weight: this.setup.map.threats.pmc },
      ]);
      this.log("encounter", "Alguém de tocaia perto da saída!");
      this.fight(kind);
      if (isDead(this.player.pmc)) return "killed";
    }
    this.t += EXTRACT_MINUTES;
    if (this.t > this.setup.map.duration) return "mia";
    this.extract = extract;
    this.karma += KARMA.extract;
    this.log("extract", `Extraiu por ${extract.name}`);
    return "extracted";
  }

  // ---------------------------------------------------------------- final

  finish(outcome: RaidOutcome): RaidRun {
    const { player } = this;
    const { pmc, skills } = player;
    const valueOf = (list: readonly ItemSummary[]) =>
      list.reduce(
        (sum, l) => sum + player.factory.catalog.get(l.def).basePrice * l.count,
        0,
      );
    const loot = summarize(this.gained.values());
    const lootValue = valueOf(loot);
    let xp = 0;
    let lost: ItemSummary[] = [];
    let kept = loot;
    if (outcome === "extracted") {
      xp =
        RAID_XP.extract +
        Math.round(this.t * RAID_XP.perMinute) +
        this.kills.scav * RAID_XP.kill.scav +
        this.kills.pmc * RAID_XP.kill.pmc +
        Math.floor((lootValue / 1000) * RAID_XP.per1000Value);
      addPmcXp(pmc, xp);
      // Cirurgia de campo na saída (até existir a enfermaria)
      for (const part of BODY_PARTS) restorePart(pmc, part);
    } else {
      lost = this.loseGear();
      // O que sobra é o loot guardado no contêiner seguro
      kept = summarize([...this.found].filter((i) => isCarried(i, player)));
      pmc.health = { ...MAX_HEALTH };
      pmc.energy = MAX_ENERGY;
      pmc.hydration = MAX_HYDRATION;
    }
    const skillXp: Partial<Record<SkillId, number>> = {};
    for (const id of SKILLS) {
      const gained = round1(skills[id] - this.skillsBefore[id]);
      if (gained > 0) skillXp[id] = gained;
    }
    return {
      events: this.events,
      summary: {
        outcome,
        map: this.setup.map.id,
        strategy: this.setup.strategy,
        minutes: round1(this.t),
        kills: { ...this.kills },
        loot: kept,
        lootValue: valueOf(kept),
        lost,
        xp,
        skillXp,
        karma: Math.round(this.karma * 100) / 100,
        extract: this.extract?.name ?? null,
        killedBy: this.killedBy,
      },
    };
  }

  /** Morte: perde tudo que estava vestido e nos bolsos, menos o contêiner seguro */
  loseGear(): ItemSummary[] {
    const lost: Item[] = [];
    for (const slot of SLOT_NAMES) {
      if (slot === "secure") continue;
      const item = this.equipment.unequip(slot);
      if (item) lost.push(item);
    }
    for (const pocket of this.equipment.pockets) {
      for (const item of pocket.items()) {
        pocket.remove(item);
        lost.push(item);
      }
    }
    return summarize(lost);
  }
}

/**
 * Resolve uma raid inteira de uma vez, de forma determinística pela `rng`.
 * Altera o estado do jogador (vida, energia, munição, loot, perdas e XP) e
 * devolve o log de eventos e o resumo.
 */
export function simulateRaid(setup: RaidSetup): RaidRun {
  return new RaidSimulation(setup).run();
}
