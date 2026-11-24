import { CORE_DEFAULTS, coreBalance } from "../balance.ts";
import type { Clock } from "../clock.ts";
import type { SlotName } from "../inventory/equipment.ts";
import { Equipment } from "../inventory/equipment.ts";
import { Grid } from "../inventory/grid.ts";
import { totalValue } from "../inventory/item.ts";
import type { Item, ItemFactory } from "../inventory/item.ts";
import { attachMagazine, capacity, loadRounds } from "../inventory/magazine.ts";
import { autoPlace, detach } from "../inventory/operations.ts";
import { createPmc } from "../pmc/pmc.ts";
import { Rng } from "../rng.ts";
import { createPlayerState } from "../state.ts";
import type { PlayerState } from "../state.ts";
import { rollLoot, valuePerCell } from "./loot.ts";
import { recordRaid } from "./profile.ts";
import { simulateRaid } from "./simulate.ts";
import type {
  ActiveRaid,
  EnemyDef,
  EnemyKind,
  ItemSummary,
  MapDef,
  RaidModifiers,
  ScavGearSlot,
  ScavLoadout,
  ScavProfile,
  ScavTransfer,
  StrategyId,
} from "./types.ts";

/** Espera entre raids Scav (tempo real) com karma 0 (padrão) */
export const SCAV_COOLDOWN_MS = CORE_DEFAULTS.scav.cooldownMs;

/**
 * Efeito de cada ponto de karma (−10 a 10) na raid Scav (padrão; o valor em
 * uso vem de `coreBalance().scav`):
 * - chance de um Scav não ser hostil = base + por ponto (0,2 a 1);
 * - tocaia na extração × (1 − 0,05 × karma) (1,5 a 0,5);
 * - peso do loot × (1 + 0,03 × karma) (0,7 a 1,3);
 * - qualidade do loot = 0,05 × karma (−0,5 a 0,5);
 * - cooldown × (1 − 0,025 × karma) (1,25 a 0,75).
 */
export const SCAV_KARMA = {
  friendlyBase: CORE_DEFAULTS.scav.friendlyBase,
  friendlyPerKarma: CORE_DEFAULTS.scav.friendlyPerKarma,
  riskPerKarma: CORE_DEFAULTS.scav.riskPerKarma,
  lootPerKarma: CORE_DEFAULTS.scav.lootPerKarma,
  qualityPerKarma: CORE_DEFAULTS.scav.qualityPerKarma,
  cooldownPerKarma: CORE_DEFAULTS.scav.cooldownPerKarma,
} as const;

/** Slot de cada peça do equipamento aleatório */
const GEAR_SLOTS: readonly ScavGearSlot[] = [
  "rig",
  "backpack",
  "armor",
  "helmet",
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Modificadores da raid Scav a partir do karma do PMC */
export function scavModifiers(karma: number): RaidModifiers {
  const k = coreBalance().scav;
  return {
    friendlyScav: clamp01(k.friendlyBase + k.friendlyPerKarma * karma),
    extractRisk: 1 - k.riskPerKarma * karma,
    lootWeight: 1 + k.lootPerKarma * karma,
    lootQuality: k.qualityPerKarma * karma,
  };
}

/**
 * Espera até a próxima raid Scav. `reduction` (0 a 1) vem do esconderijo
 * (Fase 7) e corta uma fração do tempo.
 */
export function scavCooldownMs(karma: number, reduction = 0): number {
  const k = coreBalance().scav;
  const factor = 1 - k.cooldownPerKarma * karma;
  return Math.round(k.cooldownMs * factor * (1 - clamp01(reduction)));
}

/** Milissegundos até a raid Scav ficar liberada (0 = liberada) */
export function scavReadyIn(profile: ScavProfile, now: number): number {
  return Math.max(0, profile.readyAt - now);
}

/** Guarda nas grades do Scav; se não couber, o item fica de fora */
function stow(item: Item, scav: Equipment): void {
  autoPlace(item, scav.carryGrids());
}

/**
 * Sorteia o equipamento do Scav pelas tabelas: colete tático, mochila,
 * colete balístico, capacete, uma arma com carregador (meio cheio ou mais),
 * carregadores extras, munição solta e alguns itens.
 */
export function rollScavEquipment(
  loadout: ScavLoadout,
  rng: Rng,
  factory: ItemFactory,
): Equipment {
  const equipment = new Equipment();
  for (const slot of GEAR_SLOTS) {
    const id = rng.weighted(
      loadout.gear[slot].map((o) => ({ value: o.item, weight: o.weight })),
    );
    if (id) equipment.equip(slot, factory.create(id));
  }

  const option = rng.weighted(
    loadout.weapons.map((o) => ({ value: o, weight: o.weight })),
  );
  const weapon = factory.create(option.weapon);
  /** Carregador com `min` a `capacidade` cartuchos (`min` em fração) */
  const loadMag = (minFraction: number) => {
    const mag = factory.create(option.magazine);
    const full = capacity(mag);
    const rounds = rng.int(Math.ceil(full * minFraction), full);
    loadRounds(mag, factory.create(option.ammo, rounds));
    return mag;
  };
  attachMagazine(weapon, loadMag(0.5));
  const slot: SlotName =
    weapon.def.equipSlot === "pistol" ? "holster" : "primary";
  equipment.equip(slot, weapon);

  const spares = rng.int(...option.spareMags);
  for (let i = 0; i < spares; i++) stow(loadMag(1), equipment);
  const loose = rng.int(...option.looseAmmo);
  if (loose > 0) stow(factory.create(option.ammo, loose), equipment);

  const extras = rng.int(...loadout.extraRolls);
  for (let i = 0; i < extras; i++) {
    stow(rollLoot(loadout.extras, rng, factory), equipment);
  }
  return equipment;
}

/** Monta o Scav: equipamento sorteado, vida cheia e as skills do PMC (cópia) */
export function createScav(
  player: PlayerState,
  loadout: ScavLoadout,
  rng: Rng,
  clock: Clock,
): PlayerState {
  return createPlayerState(
    {
      inventory: {
        // O Scav não tem estoque; a grade só completa o formato
        stash: new Grid(1, 1),
        equipment: rollScavEquipment(loadout, rng, player.factory),
      },
      pmc: createPmc("Scav"),
      skills: { ...player.skills },
      factory: player.factory,
      raid: player.raid,
    },
    clock,
  );
}

function summarize(items: readonly { def: Item["def"]; count: number }[]) {
  const byDef = new Map<string, ItemSummary>();
  for (const { def, count } of items) {
    const prev = byDef.get(def.id);
    byDef.set(def.id, {
      def: def.id,
      name: def.name,
      count: (prev?.count ?? 0) + count,
    });
  }
  return [...byDef.values()];
}

/**
 * Extraiu: tira tudo do Scav (itens soltos das grades, depois as peças
 * vestidas, já vazias) e guarda no estoque, do maior valor por célula para
 * o menor. O que não couber fica para trás.
 */
export function transferToStash(scav: Equipment, stash: Grid): ScavTransfer {
  const items: Item[] = [];
  for (const grid of scav.carryGrids()) {
    for (const item of grid.items()) {
      detach(item);
      items.push(item);
    }
  }
  for (const item of scav.equipped()) {
    detach(item);
    items.push(item);
  }
  items.sort((a, b) => valuePerCell(b) - valuePerCell(a));
  const stored: { def: Item["def"]; count: number }[] = [];
  const left: { def: Item["def"]; count: number }[] = [];
  let storedValue = 0;
  for (const item of items) {
    const start = item.count;
    const perUnit = totalValue(item) / start;
    autoPlace(item, [stash]);
    // Se só parte entrou em pilhas, o resto continua no item
    const placed = item.location ? start : start - item.count;
    if (placed > 0) {
      stored.push({ def: item.def, count: placed });
      storedValue += perUnit * placed;
    }
    if (placed < start) left.push({ def: item.def, count: start - placed });
  }
  return {
    stored: summarize(stored),
    storedValue: Math.round(storedValue),
    left: summarize(left),
  };
}

/**
 * Entra na raid Scav: sorteia o Scav, resolve a raid com os modificadores do
 * karma e, se extrair, leva tudo para o estoque. O PMC não arrisca nada, não
 * ganha XP e o karma não muda. Começa o cooldown.
 */
export function startScavRaid(
  player: PlayerState,
  map: MapDef,
  strategy: StrategyId,
  enemies: Readonly<Record<EnemyKind, EnemyDef>>,
  loadout: ScavLoadout,
  clock: Clock,
  cooldownReduction = 0,
): ActiveRaid {
  const now = clock.now();
  if (scavReadyIn(player.scav, now) > 0) {
    throw new Error("A raid Scav ainda está em espera");
  }
  const profile = player.raid;
  const rng = new Rng(profile.seed);
  const scav = createScav(player, loadout, rng, clock);
  const { events, summary } = simulateRaid({
    player: scav,
    map,
    strategy,
    enemies,
    rng,
    lootRule: profile.lootRule,
    modifiers: scavModifiers(profile.karma),
  });
  profile.seed = Math.floor(rng.next() * 2 ** 32);
  const transfer =
    summary.outcome === "extracted"
      ? transferToStash(scav.inventory.equipment, player.inventory.stash)
      : { stored: [], storedValue: 0, left: [] };
  recordRaid(player.scav.stats, summary);
  player.scav.readyAt = now + scavCooldownMs(profile.karma, cooldownReduction);
  profile.active = {
    startedAt: now,
    events,
    summary: { ...summary, xp: 0, skillXp: {}, karma: 0, scav: transfer },
  };
  return profile.active;
}
