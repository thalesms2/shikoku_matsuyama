import { coreBalance } from "../balance.ts";
import {
  durabilityRatio,
  maxDurability,
  wear,
} from "../inventory/durability.ts";
import type { Item, ItemDef } from "../inventory/item.ts";
import {
  attachMagazine,
  capacity,
  feedOf,
  fireRound,
  hasInternalMagazine,
  isMagazine,
  loadRounds,
  loadedRounds,
  sameCaliber,
  weaponRounds,
} from "../inventory/magazine.ts";
import { autoPlace, detach } from "../inventory/operations.ts";
import { maxStack } from "../inventory/size.ts";
import { damage, isDead } from "../pmc/pmc.ts";
import { addSkillXp, skillBonus } from "../pmc/skills.ts";
import type { SkillId } from "../pmc/skills.ts";
import {
  HIT_ZONES,
  armorWear,
  protectedBy,
  vitalityFactor,
  wornArmorFactor,
} from "../raid/combat.ts";
import type { EnemyDef, EnemyKind } from "../raid/types.ts";
import { fleeRoll } from "./enemies.ts";
import type { MatrixEnemy } from "./enemies.ts";
import type { FightOutcome, FightStart, MatrixRaid } from "./raid.ts";

/** Peça de proteção de um inimigo, gasta durante a briga */
export interface FoeArmor {
  readonly def: ItemDef;
  durability: number;
}

/** Inimigo de uma briga, com o equipamento sorteado */
export interface Foe {
  readonly enemy: MatrixEnemy;
  readonly name: string;
  health: number;
  readonly weapon: ItemDef;
  readonly magazine: ItemDef | null;
  readonly ammo: ItemDef;
  readonly ammoCount: readonly [number, number];
  readonly armor: FoeArmor | null;
  readonly helmet: FoeArmor | null;
}

const NAMES: Record<EnemyKind, string> = {
  scav: "um Scav",
  pmc: "um PMC inimigo",
};

/** Sorteia o equipamento do inimigo (pelos pesos de `EnemyDef.gear`) */
export function armFoe(
  enemy: MatrixEnemy,
  def: EnemyDef,
  raid: MatrixRaid,
): Foe {
  const { rng } = raid;
  const { catalog } = raid.player.factory;
  const gear = def.gear!;
  const pick = <T extends { weight: number }>(list: readonly T[]) =>
    rng.weighted(list.map((value) => ({ value, weight: value.weight })));
  const weapon = pick(gear.weapons);
  const armorId = pick(gear.armor).item;
  const helmetId = pick(gear.helmet).item;
  const piece = (id: string | null): FoeArmor | null => {
    if (!id) return null;
    const d = catalog.get(id);
    return { def: d, durability: maxDurability(d) };
  };
  const b = coreBalance().combat;
  return {
    enemy,
    name: NAMES[enemy.kind],
    health: enemy.kind === "pmc" ? b.pmcHealth : b.scavHealth,
    weapon: catalog.get(weapon.weapon),
    magazine: weapon.magazine ? catalog.get(weapon.magazine) : null,
    ammo: catalog.get(weapon.ammo),
    ammoCount: weapon.ammoCount,
    armor: piece(armorId),
    helmet: piece(helmetId),
  };
}

/** Lados do dado de dano da arma (sem o dado, d6) */
export function damageDie(weapon: ItemDef): number {
  return weapon.stats?.damageDie ?? 6;
}

/** Cartuchos gastos por ataque: rajada nas automáticas, 1 nas outras */
export function roundsPerAttack(weapon: ItemDef): number {
  const auto = ["assaultRifles", "submachineGuns", "lightMachineGuns"];
  return auto.includes(weapon.stats?.weaponClass ?? "")
    ? coreBalance().combat.burstRounds
    : 1;
}

/** Turnos para recarregar: `reloadTurns × (1 − 2 × Manuseio de carregador)`, para cima */
export function reloadTurns(raid: MatrixRaid): number {
  const bonus = skillBonus(raid.player.skills, "magDrills");
  return Math.max(
    0,
    Math.ceil(coreBalance().combat.reloadTurns * (1 - 2 * bonus)),
  );
}

/** Primeira arma vestida com munição */
function readyWeapon(raid: MatrixRaid): Item | null {
  for (const slot of ["primary", "secondary", "holster"] as const) {
    const w = raid.player.inventory.equipment.get(slot);
    if (w && weaponRounds(w) > 0) return w;
  }
  return null;
}

/**
 * Recarrega uma arma vestida: troca o carregador por um com munição do
 * equipamento (o vazio vai para o lugar dele) ou enche o tubo com cartuchos
 * soltos. Devolve se conseguiu.
 */
export function reload(raid: MatrixRaid): boolean {
  const { equipment } = raid.player.inventory;
  const carried = equipment.carryGrids().flatMap((g) => g.items());
  for (const slot of ["primary", "secondary", "holster"] as const) {
    const weapon = equipment.get(slot);
    if (!weapon) continue;
    if (hasInternalMagazine(weapon)) {
      let loaded = 0;
      for (const ammo of carried) {
        if (ammo.def.category === "ammo") loaded += loadRounds(weapon, ammo);
      }
      if (loaded > 0) return true;
      continue;
    }
    const spare = carried.find(
      (i) =>
        isMagazine(i) && loadedRounds(i) > 0 && sameCaliber(i.def, weapon.def),
    );
    if (!spare) continue;
    const empty = weapon.magazine;
    detach(spare);
    if (empty) {
      detach(empty);
      autoPlace(empty, equipment.carryGrids());
    }
    attachMagazine(weapon, spare);
    return true;
  }
  return false;
}

/** Número de um dado técnico do item (0 sem ele) */
export const stat = (
  def: ItemDef,
  key: "armorClass" | "penetration" | "damageBonus",
): number => def.stats?.[key] ?? 0;

/** Rola um dado de `sides` lados */
const die = (raid: MatrixRaid, sides: number) => raid.rng.int(1, sides);

/** Skill de combate da arma (pelo tipo dela; toda arma do catálogo tem um) */
function weaponSkill(weapon: ItemDef): SkillId {
  return (weapon.stats?.weaponClass ?? "aim") as SkillId;
}

/** Bônus de acerto do personagem: (Mira + skill da arma) × 10; o Rato com desvantagem */
export function playerAttackBonus(raid: MatrixRaid, weapon: ItemDef): number {
  const { skills } = raid.player;
  const scale = coreBalance().encounter.skillToD20;
  const skill = weaponSkill(weapon);
  const bonus = (skillBonus(skills, "aim") + skillBonus(skills, skill)) * scale;
  return raid.strategy === "rat"
    ? bonus - coreBalance().combat.ratAimPenalty
    : bonus;
}

/** Chance de headshot do personagem */
export function headshotChance(raid: MatrixRaid, weapon: ItemDef): number {
  const b = coreBalance().combat;
  const { skills } = raid.player;
  const skill = weaponSkill(weapon);
  return Math.min(
    1,
    b.headshotBase +
      skillBonus(skills, "aim") * b.aimHeadshot +
      skillBonus(skills, skill) * b.weaponHeadshot,
  );
}

/** XP de Coletes leves ou pesados pelo tipo do colete */
function vestXp(raid: MatrixRaid, armor: Item, amount: number): void {
  // todo colete tem `vestType` (tests/data/catalog11l.test.ts)
  const skill =
    armor.def.stats!.vestType === "heavy" ? "heavyVests" : "lightVests";
  addSkillXp(raid.player.skills, skill, amount);
}

/** Um ataque do personagem contra o inimigo */
function playerAttack(raid: MatrixRaid, foe: Foe, weapon: Item): void {
  const b = coreBalance().combat;
  const rounds = Math.min(roundsPerAttack(weapon.def), weaponRounds(weapon));
  // a rajada nunca passa da munição carregada
  const ammo = fireRound(weapon)!;
  for (let i = 1; i < rounds; i++) fireRound(weapon);
  const roll = raid.rng.int(1, 20);
  if (roll <= b.failThreshold) {
    raid.log("fight", `Errou ${foe.name}`);
    return;
  }
  const zone = raid.rng.weighted(HIT_ZONES);
  const slot = protectedBy(zone);
  const piece =
    slot === "helmet" ? foe.helmet : slot === "armor" ? foe.armor : null;
  const active = piece && piece.durability > 0 ? piece : null;
  const armorClass = active ? stat(active.def, "armorClass") : 0;
  const pen = stat(ammo, "penetration");
  const dmgRoll = die(raid, damageDie(weapon.def)) + stat(ammo, "damageBonus");
  if (roll + playerAttackBonus(raid, weapon.def) < b.baseDefense + armorClass) {
    active!.durability = Math.max(
      0,
      active!.durability - armorWear(dmgRoll, pen, armorClass),
    );
    raid.log("fight", `${active!.def.name} de ${foe.name} segurou o tiro`);
    return;
  }
  const ratio = active ? active.durability / maxDurability(active.def) : 0;
  const dealt = dmgRoll * wornArmorFactor(pen, armorClass, ratio);
  if (active)
    active.durability = Math.max(
      0,
      active.durability - armorWear(dmgRoll, pen, armorClass),
    );
  foe.health -= dealt;
  addSkillXp(raid.player.skills, "aim", b.aimXpPerHit);
  addSkillXp(raid.player.skills, weaponSkill(weapon.def), b.aimXpPerHit);
  raid.log("fight", `Acertou ${foe.name} (−${Math.round(dealt)})`);
}

/** Um ataque do inimigo contra o personagem */
function enemyAttack(raid: MatrixRaid, foe: Foe): void {
  const b = coreBalance().combat;
  const roll = raid.rng.int(1, 20);
  if (roll <= b.failThreshold) {
    raid.log("fight", `${foe.name} errou`);
    return;
  }
  const { equipment } = raid.player.inventory;
  const { skills } = raid.player;
  const zone = raid.rng.weighted(HIT_ZONES);
  const slot = protectedBy(zone);
  const piece = slot ? equipment.get(slot) : null;
  const active = piece && durabilityRatio(piece) > 0 ? piece : null;
  const armorClass = active ? stat(active.def, "armorClass") : 0;
  const pen = stat(foe.ammo, "penetration");
  const dmgRoll =
    die(raid, damageDie(foe.weapon)) + stat(foe.ammo, "damageBonus");
  const bonus =
    raid.map.difficulty * b.enemyAttackPerDifficulty +
    (foe.enemy.kind === "pmc" ? b.pmcAttackBonus : 0);
  if (roll + bonus < b.baseDefense + armorClass) {
    wear(active!, armorWear(dmgRoll, pen, armorClass));
    if (slot === "armor") vestXp(raid, active!, b.vestXpPerBlock);
    raid.log("fight", `Seu ${active!.def.name} segurou o tiro de ${foe.name}`);
    return;
  }
  const factor = active
    ? wornArmorFactor(pen, armorClass, durabilityRatio(active))
    : 1;
  const dealt = dmgRoll * factor * vitalityFactor(skills);
  damage(raid.player.pmc, zone, dealt);
  addSkillXp(skills, "vitality", dealt * 0.05);
  if (active) {
    wear(active, armorWear(dmgRoll, pen, armorClass));
    if (slot === "armor") vestXp(raid, active, dealt * b.vestXpPerDamage);
  }
  raid.log("fight", `${foe.name} acertou você (−${Math.round(dealt)})`);
}

/** Corpo do inimigo abatido: arma com carregador parcial, proteções gastas e munição */
export function bodyItems(raid: MatrixRaid, foe: Foe): Item[] {
  const { factory } = raid.player;
  const items: Item[] = [];
  const weapon = factory.create(foe.weapon.id);
  if (foe.magazine) attachMagazine(weapon, factory.create(foe.magazine.id));
  const feed = feedOf(weapon)!;
  const max = Math.min(capacity(feed), maxStack(foe.ammo));
  const rounds = raid.rng.int(0, max);
  if (rounds > 0) loadRounds(feed, factory.create(foe.ammo.id, rounds));
  items.push(weapon);
  for (const piece of [foe.armor, foe.helmet]) {
    if (!piece) continue;
    const item = factory.create(piece.def.id);
    if (piece.durability < maxDurability(piece.def))
      item.durability = piece.durability;
    items.push(item);
  }
  const count = Math.min(maxStack(foe.ammo), raid.rng.int(...foe.ammoCount));
  if (count > 0) items.push(factory.create(foe.ammo.id, count));
  return items;
}

/**
 * Combate d20 (12F) para a raid em matriz. Quem ataca primeiro tenta o
 * headshot (o do personagem mata na hora; o do inimigo pode ser segurado
 * pelo capacete). Depois, em turnos alternados (começando por quem ataca
 * primeiro), cada lado rola d20: até `failThreshold` erra; senão, compara
 * com `baseDefense + classe` da proteção da parte atingida (segurou: a
 * proteção se gasta; passou: dano = dado da arma + bônus da munição,
 * reduzido pela proteção, que se gasta). O personagem gasta munição de
 * verdade, recarrega em `reloadTurns` e foge quando a estratégia manda. O
 * Psicopata contra vários inimigos rola d20 depois de cada inimigo (menos o
 * último) e ganha um turno extra com `psychoExtraTurn`. Vencendo, revista
 * o corpo (menos o Rato).
 */
export function createD20Fight(enemies: Readonly<Record<EnemyKind, EnemyDef>>) {
  return (start: FightStart, raid: MatrixRaid): FightOutcome => {
    const b = coreBalance().combat;
    const { player } = raid;
    const extras = raid.enemies.filter(
      (e) =>
        e !== start.enemy &&
        e.x === raid.at[0] &&
        e.y === raid.at[1] &&
        e.chasing,
    );
    const foes = [start.enemy, ...extras].map((e) =>
      armFoe(e, enemies[e.kind], raid),
    );
    const alive = () => foes.filter((f) => f.health > 0);

    if (start.enemyHeadshot) {
      const chance =
        b.enemyHeadshot + raid.map.difficulty * b.enemyHeadshotPerDifficulty;
      if (raid.rng.chance(chance)) {
        const helmet = player.inventory.equipment.get("helmet");
        const save = helmet
          ? stat(helmet.def, "armorClass") *
            b.helmetSavePerClass *
            durabilityRatio(helmet)
          : 0;
        if (helmet && raid.rng.chance(save)) {
          wear(helmet, maxDurability(helmet.def) / 2);
          raid.log("fight", `Seu ${helmet.def.name} segurou um tiro na cabeça`);
        } else {
          damage(player.pmc, "head", player.pmc.health.head);
          raid.log("fight", `${foes[0].name} acertou um tiro na cabeça`);
          return "died";
        }
      }
    }
    const firstWeapon = readyWeapon(raid);
    if (start.playerHeadshot && raid.strategy !== "rat" && firstWeapon) {
      if (raid.rng.chance(headshotChance(raid, firstWeapon.def))) {
        fireRound(firstWeapon);
        foes[0].health = 0;
        raid.log("fight", `Headshot em ${foes[0].name}!`);
      }
    }

    let reloading = 0;
    const playerTurn = (): FightOutcome | null => {
      if (raid.strategy === "rat" || raid.wantsToFlee()) {
        if (fleeRoll(raid.rng, raid.fleeBonus())) return "fled";
      }
      if (reloading > 0) {
        reloading -= 1;
        return null;
      }
      let weapon = readyWeapon(raid);
      if (!weapon) {
        if (!reload(raid)) {
          raid.log("fight", "Sem munição");
          return fleeRoll(raid.rng, raid.fleeBonus()) ? "fled" : null;
        }
        reloading = reloadTurns(raid);
        raid.log("fight", "Recarregando");
        if (reloading > 0) {
          reloading -= 1;
          return null;
        }
        weapon = readyWeapon(raid)!;
      }
      playerAttack(raid, alive()[0], weapon);
      return null;
    };

    let playerNext = start.playerFirst;
    for (let round = 0; round < b.maxRounds && alive().length > 0; round++) {
      raid.turn += 1;
      const order: ("player" | Foe | "extra")[] = [];
      const living = alive();
      if (playerNext) order.push("player");
      living.forEach((foe, i) => {
        order.push(foe);
        if (
          raid.strategy === "psycho" &&
          living.length > 1 &&
          i < living.length - 1
        ) {
          order.push("extra");
        }
      });
      if (!playerNext) order.push("player");
      playerNext = true;
      for (const actor of order) {
        if (alive().length === 0) break;
        if (actor === "extra") {
          if (raid.rng.int(1, 20) < b.psychoExtraTurn) continue;
          raid.log("fight", "Rápido: turno extra");
        }
        if (actor === "player" || actor === "extra") {
          const outcome = playerTurn();
          if (outcome) return outcome;
          continue;
        }
        if (actor.health <= 0) continue;
        enemyAttack(raid, actor);
        if (isDead(player.pmc)) return "died";
      }
    }
    if (alive().length > 0) {
      raid.log("fight", `${alive()[0].name} recuou`);
      return "fled";
    }
    for (const foe of foes.slice(1)) {
      raid.enemies.splice(raid.enemies.indexOf(foe.enemy), 1);
      raid.kills += 1;
      raid.log("fight", `Abateu ${foe.name}`);
    }
    if (raid.strategy !== "rat") {
      for (const foe of foes) {
        for (const item of bodyItems(raid, foe))
          raid.store(item, 3, "um corpo");
      }
    }
    return "won";
  };
}
