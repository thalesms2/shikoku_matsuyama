import { MAX_AUTO_RAIDS, createAutoState } from "../auto/auto.ts";
import type { AutoEntry, AutoState } from "../auto/types.ts";
import type { Clock } from "../clock.ts";
import { createFleaState } from "../flea/flea.ts";
import type { FleaListing, FleaResult, FleaState } from "../flea/types.ts";
import { createHideoutState } from "../hideout/hideout.ts";
import type { HideoutState } from "../hideout/types.ts";
import { maxDurability } from "../inventory/durability.ts";
import { Equipment, SLOT_NAMES } from "../inventory/equipment.ts";
import type { SlotName } from "../inventory/equipment.ts";
import { Grid } from "../inventory/grid.ts";
import { ItemFactory } from "../inventory/item.ts";
import type { Catalog, GridLocation, Item } from "../inventory/item.ts";
import type { LoadJob } from "../inventory/loading.ts";
import { attachMagazine } from "../inventory/magazine.ts";
import { autoPlace } from "../inventory/operations.ts";
import type { Loadout, LoadoutItem } from "../loadout/types.ts";
import { createPmc } from "../pmc/pmc.ts";
import type { PmcState } from "../pmc/pmc.ts";
import { createSkills } from "../pmc/skills.ts";
import type { SkillsState } from "../pmc/skills.ts";
import type { QuestState, QuestsState } from "../quests/types.ts";
import { createRaidProfile, createScavProfile } from "../raid/profile.ts";
import { LOOT_RULES, STRATEGY_IDS } from "../raid/types.ts";
import type { RaidProfile, ScavProfile } from "../raid/types.ts";
import { createPlayerState, storageFor } from "../state.ts";
import type { PlayerState } from "../state.ts";
import type { TraderState, TradersState } from "../trade/types.ts";
import { SAVE_VERSION } from "./format.ts";
import type {
  SaveData,
  SavedFlea,
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
  if (item.fir) saved.fir = true;
  if (item.durability !== undefined) saved.dur = item.durability;
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

function saveFlea(flea: FleaState): SavedFlea {
  return {
    seed: flea.seed,
    nextListing: flea.nextListing,
    listings: flea.listings.map((l) => ({ ...l, item: saveItem(l.item) })),
    results: flea.results.map((r) =>
      r.kind === "sold" ? { ...r } : { ...r, item: saveItem(r.item) },
    ),
    pressure: structuredClone(flea.pressure),
    lastCheck: flea.lastCheck,
    stats: { ...flea.stats },
  };
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
    traders: structuredClone(state.traders),
    quests: structuredClone(state.quests),
    hideout: structuredClone(state.hideout),
    flea: saveFlea(state.flea),
    loadouts: structuredClone(state.loadouts),
    auto: structuredClone(state.auto),
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
    if (saved.fir === true) item.fir = true;
    // durabilidade fora de 0..máx. é limitada; inteira = sem o campo
    const max = maxDurability(item.def);
    if (max > 0 && Number.isFinite(saved.dur) && saved.dur! < max) {
      item.durability = Math.max(0, saved.dur!);
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

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Vendedores salvos: números inválidos voltam a 0 (`restockAt` 0 = repõe no
 * próximo acesso) e compras inválidas são descartadas.
 */
function loadTraders(saved: TradersState | undefined): TradersState {
  const traders: TradersState = {};
  for (const [id, raw] of Object.entries(saved ?? {})) {
    const state = (raw ?? {}) as Partial<TraderState>;
    const bought: Record<string, number> = {};
    for (const [offer, n] of Object.entries(state.bought ?? {})) {
      if (Number.isInteger(n) && n > 0) bought[offer] = n;
    }
    traders[id] = {
      reputation: finite(state.reputation, 0),
      volume: finite(state.volume, 0),
      bought,
      restockAt: finite(state.restockAt, 0),
    };
  }
  return traders;
}

/**
 * Esconderijo salvo: níveis inválidos somem, obra ou produção inválida é
 * descartada e momentos inválidos viram `now` (sem tempo offline).
 */
function loadHideout(
  saved: HideoutState | undefined,
  now: number,
): HideoutState {
  const base = createHideoutState(now);
  if (!saved) return base;
  const modules: Record<string, number> = {};
  for (const [id, level] of Object.entries(saved.modules ?? {})) {
    if (Number.isInteger(level) && level > 0) modules[id] = level;
  }
  const c = saved.construction;
  const construction =
    c &&
    typeof c.module === "string" &&
    Number.isInteger(c.level) &&
    Number.isFinite(c.endsAt)
      ? { module: c.module, level: c.level, endsAt: c.endsAt }
      : null;
  const productions: HideoutState["productions"] = {};
  for (const [id, p] of Object.entries(saved.productions ?? {})) {
    if (p && typeof p.recipe === "string" && Number.isFinite(p.endsAt)) {
      productions[id] = { recipe: p.recipe, endsAt: p.endsAt };
    }
  }
  const state: HideoutState = {
    modules,
    construction,
    productions,
    incomeSince: finite(saved.incomeSince, now),
    lastTick: finite(saved.lastTick, now),
  };
  // progresso da cirurgia: só um número positivo
  const surgery = saved.surgeryProgress;
  if (Number.isFinite(surgery) && surgery! > 0) state.surgeryProgress = surgery;
  return state;
}

const isInt = (n: unknown): n is number => Number.isInteger(n);

/**
 * Mercado salvo: anúncios e resultados inválidos (ou com item que saiu do
 * jogo) são descartados, pressão inválida some, números inválidos voltam ao
 * padrão e `lastCheck` inválido vira `now` (sem tempo offline).
 */
function loadFlea(
  saved: SavedFlea | undefined,
  loader: Loader,
  now: number,
): FleaState {
  const base = createFleaState(now);
  if (!saved) return base;
  const listings: FleaListing[] = [];
  for (const l of saved.listings ?? []) {
    if (
      !isInt(l?.id) ||
      !isInt(l.price) ||
      l.price < 1 ||
      !Number.isFinite(l.listedAt) ||
      !Number.isFinite(l.expiresAt) ||
      !l.item
    ) {
      continue;
    }
    const item = loader.item(l.item);
    if (item) listings.push({ ...l, item });
  }
  const results: FleaResult[] = [];
  for (const r of saved.results ?? []) {
    if (!isInt(r?.id)) continue;
    if (r.kind === "sold") {
      if (
        typeof r.def === "string" &&
        isInt(r.count) &&
        isInt(r.price) &&
        r.price > 0
      ) {
        results.push({ ...r });
      }
    } else if (r.kind === "expired" && r.item) {
      const item = loader.item(r.item);
      if (item) results.push({ ...r, item });
    }
  }
  const pressure: FleaState["pressure"] = {};
  for (const [id, p] of Object.entries(saved.pressure ?? {})) {
    if (Number.isFinite(p?.value) && Number.isFinite(p.at)) {
      pressure[id] = { value: p.value, at: p.at };
    }
  }
  const stats = { ...base.stats };
  for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
    stats[key] = finite(saved.stats?.[key], 0);
  }
  const ids = [...listings, ...results].map((x) => x.id);
  return {
    seed: isInt(saved.seed) ? saved.seed >>> 0 : base.seed,
    nextListing: Math.max(
      isInt(saved.nextListing) ? saved.nextListing : 1,
      ...ids.map((id) => id + 1),
    ),
    listings,
    results,
    pressure,
    lastCheck: finite(saved.lastCheck, now),
    stats,
  };
}

/** Só os slots válidos com texto */
function loadSlotMap(raw: unknown): Partial<Record<SlotName, string>> {
  const map: Partial<Record<SlotName, string>> = {};
  for (const slot of SLOT_NAMES) {
    const value = (raw as Record<string, unknown> | undefined)?.[slot];
    if (typeof value === "string") map[slot] = value;
  }
  return map;
}

/**
 * Loadouts salvos: sem nome válido são descartados; slots desconhecidos e
 * itens carregados inválidos somem (itens que saíram do jogo ficam e
 * aparecem como faltando).
 */
function loadLoadouts(saved: Loadout[] | undefined): Loadout[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((raw) => {
    if (typeof raw?.name !== "string") return [];
    const carried: LoadoutItem[] = (
      Array.isArray(raw.carried) ? raw.carried : []
    ).filter(
      (c) => typeof c?.item === "string" && isInt(c.count) && c.count > 0,
    );
    return [
      {
        name: raw.name,
        slots: loadSlotMap(raw.slots),
        magazines: loadSlotMap(raw.magazines),
        carried: carried.map((c) => ({ item: c.item, count: c.count })),
      },
    ];
  });
}

const OUTCOMES = ["extracted", "killed", "mia"];

/**
 * Raids automáticas salvas: regras inválidas voltam ao padrão (raids entre 1
 * e o máximo, vida mínima entre 0 e 1), resultados inválidos somem e
 * `nextAt` inválido vira `now`.
 */
function loadAuto(saved: AutoState | undefined, now: number): AutoState {
  const base = createAutoState();
  if (!saved) return base;
  const r = (saved.rules ?? {}) as Partial<AutoState["rules"]>;
  const d = base.rules;
  const bool = (v: unknown, fallback: boolean) =>
    typeof v === "boolean" ? v : fallback;
  const maxRaids =
    isInt(r.maxRaids) && r.maxRaids >= 1 && r.maxRaids <= MAX_AUTO_RAIDS
      ? r.maxRaids
      : d.maxRaids;
  const log = (Array.isArray(saved.log) ? saved.log : []).filter(
    (e): e is AutoEntry =>
      OUTCOMES.includes(e?.outcome) &&
      typeof e.map === "string" &&
      [e.n, e.minutes, e.lootValue, e.xp, e.kills].every(Number.isFinite),
  );
  return {
    rules: {
      map: typeof r.map === "string" ? r.map : d.map,
      strategy: STRATEGY_IDS.includes(r.strategy!) ? r.strategy! : d.strategy,
      loadout: typeof r.loadout === "string" ? r.loadout : null,
      buyMissing: bool(r.buyMissing, d.buyMissing),
      maxRaids,
      minHealth: Math.min(1, Math.max(0, finite(r.minHealth, d.minHealth))),
      lowHealth: r.lowHealth === "stop" ? "stop" : "wait",
      stopOnDeath: bool(r.stopOnDeath, d.stopOnDeath),
    },
    running: saved.running === true,
    done: isInt(saved.done) && saved.done >= 0 ? saved.done : 0,
    nextAt: finite(saved.nextAt, now),
    current: Number.isFinite(saved.current) ? saved.current : null,
    log: log.map((e) => ({ ...e })),
    stopReason: typeof saved.stopReason === "string" ? saved.stopReason : null,
  };
}

/**
 * Quests salvas: status inválido descarta a quest; progresso inválido vira
 * 0. Quests que saíram do jogo ficam guardadas sem efeito.
 */
function loadQuests(saved: QuestsState | undefined): QuestsState {
  const quests: QuestsState = {};
  for (const [id, raw] of Object.entries(saved ?? {})) {
    const state = (raw ?? {}) as Partial<QuestState>;
    if (state.status !== "active" && state.status !== "completed") continue;
    const progress = Array.isArray(state.progress) ? state.progress : [];
    quests[id] = {
      status: state.status,
      progress: progress.map((n) => Math.max(0, finite(n, 0))),
    };
  }
  return quests;
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
      traders: loadTraders(data.traders),
      quests: loadQuests(data.quests),
      hideout: loadHideout(data.hideout, clock.now()),
      flea: loadFlea(data.flea, loader, clock.now()),
      loadouts: loadLoadouts(data.loadouts),
      auto: loadAuto(data.auto, clock.now()),
    },
    clock,
  );
  const job = loadJob(data.loader, state, loader.byUid);
  if (job) state.loader.restore(job.job, job.startedAt, job.done);
  return { state, warnings: loader.warnings };
}
