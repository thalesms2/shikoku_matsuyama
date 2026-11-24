import type { Clock } from "../clock.ts";
import { Equipment, SLOT_NAMES } from "../inventory/equipment.ts";
import { Grid } from "../inventory/grid.ts";
import { ItemFactory } from "../inventory/item.ts";
import type { Catalog, GridLocation, Item } from "../inventory/item.ts";
import type { LoadJob } from "../inventory/loading.ts";
import { attachMagazine } from "../inventory/magazine.ts";
import { autoPlace } from "../inventory/operations.ts";
import { createPmc } from "../pmc/pmc.ts";
import type { PmcState } from "../pmc/pmc.ts";
import { createSkills } from "../pmc/skills.ts";
import type { SkillsState } from "../pmc/skills.ts";
import { createRaidProfile, createScavProfile } from "../raid/profile.ts";
import { LOOT_RULES } from "../raid/types.ts";
import type { RaidProfile, ScavProfile } from "../raid/types.ts";
import { createPlayerState, storageFor } from "../state.ts";
import type { PlayerState } from "../state.ts";
import { SAVE_VERSION } from "./format.ts";
import type {
  SaveData,
  SavedItem,
  SavedLoadJob,
  SavedPlacedItem,
} from "./format.ts";

// ------------------------------------------------------------- serialização

function saveItem(item: Item): SavedItem {
  const saved: SavedItem = {
    uid: item.uid,
    def: item.def.id,
    count: item.count,
  };
  if (item.grids.length > 0) saved.grids = item.grids.map(saveGrid);
  if (item.rounds) saved.rounds = item.rounds.map((r) => [r.def.id, r.count]);
  if (item.magazine) saved.magazine = saveItem(item.magazine);
  return saved;
}

function saveGrid(grid: Grid): SavedPlacedItem[] {
  return grid.items().map((item) => {
    const loc = item.location as GridLocation;
    return { ...saveItem(item), x: loc.x, y: loc.y, r: loc.rotated };
  });
}

function saveJob(state: PlayerState): SavedLoadJob | null {
  const snap = state.loader.snapshot();
  if (!snap) return null;
  const { job, startedAt, done } = snap;
  return job.kind === "load"
    ? {
        kind: "load",
        magazine: job.magazine.uid,
        ammo: job.ammo.uid,
        startedAt,
        done,
      }
    : { kind: "unload", magazine: job.magazine.uid, startedAt, done };
}

/** Converte o estado do jogador para o formato do save */
export function serializeGame(state: PlayerState, now: number): SaveData {
  const { stash, equipment } = state.inventory;
  const slots: SaveData["equipment"]["slots"] = {};
  for (const slot of SLOT_NAMES) {
    const item = equipment.get(slot);
    if (item) slots[slot] = saveItem(item);
  }
  return {
    version: SAVE_VERSION,
    savedAt: now,
    nextId: state.factory.nextId,
    stash: { width: stash.width, height: stash.height, items: saveGrid(stash) },
    equipment: { slots, pockets: equipment.pockets.map(saveGrid) },
    pmc: structuredClone(state.pmc),
    skills: { ...state.skills },
    loader: saveJob(state),
    raid: structuredClone(state.raid),
    scav: structuredClone(state.scav),
  };
}

// ----------------------------------------------------------- desserialização

/** Recria o estado a partir do save, juntando avisos do que não deu certo */
class Loader {
  readonly warnings: string[] = [];
  readonly byUid = new Map<string, Item>();
  /** Itens que não couberam onde estavam; vão para o estoque no fim */
  readonly homeless: Item[] = [];

  constructor(private readonly factory: ItemFactory) {}

  item(saved: SavedItem): Item | null {
    if (!this.factory.catalog.has(saved.def)) {
      this.warnings.push(`Item removido do jogo: ${saved.def} (${saved.uid})`);
      return null;
    }
    let item: Item;
    try {
      item = this.factory.restore(saved.def, saved.count, saved.uid);
    } catch (error) {
      this.warnings.push(`${saved.uid}: ${(error as Error).message}`);
      return null;
    }
    this.byUid.set(item.uid, item);
    saved.grids?.forEach((items, i) => {
      const grid = item.grids[i];
      for (const inner of items) this.placeIn(grid, inner);
    });
    for (const [id, count] of saved.rounds ?? []) {
      if (!item.rounds) break;
      if (!this.factory.catalog.has(id)) {
        this.warnings.push(`Munição removida do jogo: ${id}`);
        continue;
      }
      item.rounds.push({ def: this.factory.catalog.get(id), count });
    }
    if (saved.magazine) {
      const mag = this.item(saved.magazine);
      if (mag && !attachMagazine(item, mag)) {
        this.warnings.push(`Carregador incompatível com ${item.uid}`);
        this.homeless.push(mag);
      }
    }
    return item;
  }

  /** Coloca o item salvo na grade, na posição salva ou no primeiro espaço */
  placeIn(grid: Grid | undefined, saved: SavedPlacedItem): void {
    const item = this.item(saved);
    if (!item) return;
    if (grid?.canPlace(item, saved.x, saved.y, saved.r)) {
      grid.place(item, saved.x, saved.y, saved.r);
    } else if (!grid || !autoPlace(item, [grid])) {
      this.homeless.push(item);
    }
  }
}

function loadPmc(saved: Partial<PmcState> | undefined): PmcState {
  const pmc = createPmc();
  return {
    ...pmc,
    ...saved,
    health: { ...pmc.health, ...saved?.health },
  };
}

function loadSkills(saved: Partial<SkillsState> | undefined): SkillsState {
  return { ...createSkills(), ...saved };
}

/** Perfil Scav salvo; campos que faltam voltam ao padrão (liberada) */
function loadScav(saved: ScavProfile | undefined): ScavProfile {
  const base = createScavProfile();
  if (!saved) return base;
  return {
    readyAt: Number.isFinite(saved.readyAt) ? saved.readyAt : base.readyAt,
    stats: {
      ...base.stats,
      ...saved.stats,
      kills: { ...base.stats.kills, ...saved.stats?.kills },
    },
  };
}

function loadRaid(saved: RaidProfile | undefined, seed: number): RaidProfile {
  const base = createRaidProfile(seed);
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    stats: {
      ...base.stats,
      ...saved.stats,
      kills: { ...base.stats.kills, ...saved.stats?.kills },
    },
    lootRule: LOOT_RULES.includes(saved.lootRule)
      ? saved.lootRule
      : base.lootRule,
    active: saved.active ?? null,
  };
}

function loadJob(
  saved: SavedLoadJob | null,
  state: PlayerState,
  byUid: Map<string, Item>,
): { job: LoadJob; startedAt: number; done: number } | null {
  if (!saved) return null;
  const magazine = byUid.get(saved.magazine);
  if (!magazine) return null;
  const { startedAt, done } = saved;
  if (saved.kind === "unload") {
    const grids = () => storageFor(state.inventory, magazine);
    return {
      job: { kind: "unload", magazine, factory: state.factory, grids },
      startedAt,
      done,
    };
  }
  const ammo = byUid.get(saved.ammo);
  return ammo
    ? { job: { kind: "load", magazine, ammo }, startedAt, done }
    : null;
}

/**
 * Recria o estado do jogador a partir do save (já migrado para a versão
 * atual). Itens que saíram do catálogo são descartados com aviso; itens que
 * não cabem mais onde estavam vão para o estoque (ou são perdidos, com aviso,
 * se o estoque estiver cheio).
 */
export function deserializeGame(
  data: SaveData,
  catalog: Catalog,
  clock: Clock,
): { state: PlayerState; warnings: string[] } {
  const factory = new ItemFactory(catalog, data.nextId);
  const loader = new Loader(factory);

  const stash = new Grid(data.stash.width, data.stash.height);
  for (const saved of data.stash.items) loader.placeIn(stash, saved);

  const equipment = new Equipment();
  for (const slot of SLOT_NAMES) {
    const saved = data.equipment.slots[slot];
    if (!saved) continue;
    const item = loader.item(saved);
    if (!item) continue;
    if (equipment.canEquip(slot, item)) equipment.equip(slot, item);
    else loader.homeless.push(item);
  }
  data.equipment.pockets.forEach((items, i) => {
    for (const saved of items) loader.placeIn(equipment.pockets[i], saved);
  });

  for (const item of loader.homeless) {
    if (!autoPlace(item, [stash])) {
      loader.warnings.push(
        `Sem espaço no estoque para ${item.def.id} (${item.uid})`,
      );
    }
  }

  const state = createPlayerState(
    {
      inventory: { stash, equipment },
      pmc: loadPmc(data.pmc),
      skills: loadSkills(data.skills),
      factory,
      raid: loadRaid(data.raid, clock.now()),
      scav: loadScav(data.scav),
    },
    clock,
  );
  const job = loadJob(data.loader, state, loader.byUid);
  if (job) state.loader.restore(job.job, job.startedAt, job.done);
  return { state, warnings: loader.warnings };
}
