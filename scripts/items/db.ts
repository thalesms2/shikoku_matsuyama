import { DatabaseSync } from "node:sqlite";

import type {
  EquipSlotType,
  GridSpec,
  ItemCategory,
  ItemStats,
} from "../../src/core/inventory/item.ts";
import type { ReferenceItem } from "./reference.ts";

/** Caminho padrão do banco de itens, relativo à raiz do projeto */
export const DEFAULT_DB_PATH = "data/items.db";

/** Dados próprios do jogo para um item; sobrescrevem a referência da API */
export interface ItemOverride {
  gameId: string;
  sourceId: string | null;
  enabled: boolean;
  name: string | null;
  shortName: string | null;
  description: string | null;
  category: ItemCategory | null;
  equipSlot: EquipSlotType | null;
  maxStack: number | null;
  basePrice: number | null;
  width: number | null;
  height: number | null;
  grids: GridSpec[] | null;
  /** Dados técnicos próprios; mesclados por cima dos da referência */
  stats: ItemStats | null;
}

export type AssetStatus = "placeholder" | "final";

export interface ItemAsset {
  gameId: string;
  /** Caminho relativo a `public/` */
  path: string;
  source: string;
  sourceUrl: string | null;
  license: string;
  status: AssetStatus;
  updatedAt: string;
}

export interface SyncRun {
  id: number;
  ranAt: string;
  total: number;
  added: number;
  changed: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  source_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS item_overrides (
  game_id TEXT PRIMARY KEY,
  source_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  name TEXT,
  short_name TEXT,
  description TEXT,
  category TEXT,
  equip_slot TEXT,
  max_stack INTEGER,
  base_price INTEGER,
  width INTEGER,
  height INTEGER,
  grids TEXT,
  stats TEXT
);
CREATE TABLE IF NOT EXISTS item_assets (
  game_id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  license TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('placeholder', 'final')),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  total INTEGER NOT NULL,
  added INTEGER NOT NULL,
  changed INTEGER NOT NULL
);
`;

/** Colunas adicionadas depois da criação do schema: [tabela, coluna, tipo] */
const ADDED_COLUMNS: [string, string, string][] = [
  ["item_overrides", "stats", "TEXT"],
];

/** Abre (ou cria) o banco e garante o schema, migrando bancos antigos */
export function openDb(path: string = DEFAULT_DB_PATH): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  for (const [table, column, type] of ADDED_COLUMNS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Row[];
    if (!columns.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
  return db;
}

type Row = Record<string, unknown>;

// ---------------------------------------------------------------- referência

/**
 * Grava os itens da API. Itens novos são inseridos e itens existentes só são
 * atualizados se os dados mudaram. Registra a execução em `sync_runs`.
 */
export function upsertReferences(
  db: DatabaseSync,
  refs: readonly ReferenceItem[],
  now: string,
): SyncRun {
  const select = db.prepare("SELECT data FROM items WHERE source_id = ?");
  const insert = db.prepare(
    "INSERT INTO items (source_id, data, first_seen, updated_at) VALUES (?, ?, ?, ?)",
  );
  const update = db.prepare(
    "UPDATE items SET data = ?, updated_at = ? WHERE source_id = ?",
  );
  let added = 0;
  let changed = 0;
  db.exec("BEGIN");
  for (const ref of refs) {
    const data = JSON.stringify(ref);
    const row = select.get(ref.sourceId) as Row | undefined;
    if (!row) {
      insert.run(ref.sourceId, data, now, now);
      added++;
    } else if (row.data !== data) {
      update.run(data, now, ref.sourceId);
      changed++;
    }
  }
  const result = db
    .prepare(
      "INSERT INTO sync_runs (ran_at, total, added, changed) VALUES (?, ?, ?, ?)",
    )
    .run(now, refs.length, added, changed);
  db.exec("COMMIT");
  return {
    id: Number(result.lastInsertRowid),
    ranAt: now,
    total: refs.length,
    added,
    changed,
  };
}

export function getReference(
  db: DatabaseSync,
  sourceId: string,
): ReferenceItem | null {
  const row = db
    .prepare("SELECT data FROM items WHERE source_id = ?")
    .get(sourceId) as Row | undefined;
  return row ? (JSON.parse(row.data as string) as ReferenceItem) : null;
}

/** Busca na referência por nome, nome curto, categoria ou id */
export function searchReferences(
  db: DatabaseSync,
  term: string,
  limit = 20,
): ReferenceItem[] {
  const like = `%${term.toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT data FROM items
       WHERE lower(json_extract(data, '$.sourceName')) LIKE ?
          OR lower(json_extract(data, '$.sourceShortName')) LIKE ?
          OR lower(json_extract(data, '$.sourceCategory')) LIKE ?
          OR source_id = ?
       ORDER BY json_extract(data, '$.sourceName')
       LIMIT ?`,
    )
    .all(like, like, like, term, limit) as Row[];
  return rows.map((r) => JSON.parse(r.data as string) as ReferenceItem);
}

export function listSyncRuns(db: DatabaseSync): SyncRun[] {
  const rows = db.prepare("SELECT * FROM sync_runs ORDER BY id").all() as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    ranAt: r.ran_at as string,
    total: Number(r.total),
    added: Number(r.added),
    changed: Number(r.changed),
  }));
}

// ----------------------------------------------------------------- overrides

/** Override vazio para um id do jogo */
export function emptyOverride(gameId: string): ItemOverride {
  return {
    gameId,
    sourceId: null,
    enabled: true,
    name: null,
    shortName: null,
    description: null,
    category: null,
    equipSlot: null,
    maxStack: null,
    basePrice: null,
    width: null,
    height: null,
    grids: null,
    stats: null,
  };
}

function rowToOverride(r: Row): ItemOverride {
  return {
    gameId: r.game_id as string,
    sourceId: r.source_id as string | null,
    enabled: Number(r.enabled) === 1,
    name: r.name as string | null,
    shortName: r.short_name as string | null,
    description: r.description as string | null,
    category: r.category as ItemCategory | null,
    equipSlot: r.equip_slot as EquipSlotType | null,
    maxStack: r.max_stack === null ? null : Number(r.max_stack),
    basePrice: r.base_price === null ? null : Number(r.base_price),
    width: r.width === null ? null : Number(r.width),
    height: r.height === null ? null : Number(r.height),
    grids:
      r.grids === null ? null : (JSON.parse(r.grids as string) as GridSpec[]),
    stats:
      r.stats === null ? null : (JSON.parse(r.stats as string) as ItemStats),
  };
}

export function getOverride(
  db: DatabaseSync,
  gameId: string,
): ItemOverride | null {
  const row = db
    .prepare("SELECT * FROM item_overrides WHERE game_id = ?")
    .get(gameId) as Row | undefined;
  return row ? rowToOverride(row) : null;
}

export function listOverrides(db: DatabaseSync): ItemOverride[] {
  const rows = db
    .prepare("SELECT * FROM item_overrides ORDER BY game_id")
    .all() as Row[];
  return rows.map(rowToOverride);
}

/**
 * Cria ou atualiza o override. Campos ausentes em `patch` mantêm o valor
 * atual; `null` limpa o campo (volta a usar a referência da API).
 */
export function upsertOverride(
  db: DatabaseSync,
  gameId: string,
  patch: Partial<Omit<ItemOverride, "gameId">>,
): ItemOverride {
  const merged: ItemOverride = {
    ...(getOverride(db, gameId) ?? emptyOverride(gameId)),
    ...patch,
    gameId,
  };
  db.prepare(
    `INSERT INTO item_overrides
       (game_id, source_id, enabled, name, short_name, description, category,
        equip_slot, max_stack, base_price, width, height, grids, stats)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id) DO UPDATE SET
       source_id = excluded.source_id, enabled = excluded.enabled,
       name = excluded.name, short_name = excluded.short_name,
       description = excluded.description, category = excluded.category,
       equip_slot = excluded.equip_slot, max_stack = excluded.max_stack,
       base_price = excluded.base_price, width = excluded.width,
       height = excluded.height, grids = excluded.grids,
       stats = excluded.stats`,
  ).run(
    merged.gameId,
    merged.sourceId,
    merged.enabled ? 1 : 0,
    merged.name,
    merged.shortName,
    merged.description,
    merged.category,
    merged.equipSlot,
    merged.maxStack,
    merged.basePrice,
    merged.width,
    merged.height,
    merged.grids === null ? null : JSON.stringify(merged.grids),
    merged.stats === null ? null : JSON.stringify(merged.stats),
  );
  return merged;
}

// -------------------------------------------------------------------- assets

function rowToAsset(r: Row): ItemAsset {
  return {
    gameId: r.game_id as string,
    path: r.path as string,
    source: r.source as string,
    sourceUrl: r.source_url as string | null,
    license: r.license as string,
    status: r.status as AssetStatus,
    updatedAt: r.updated_at as string,
  };
}

export function getAsset(db: DatabaseSync, gameId: string): ItemAsset | null {
  const row = db
    .prepare("SELECT * FROM item_assets WHERE game_id = ?")
    .get(gameId) as Row | undefined;
  return row ? rowToAsset(row) : null;
}

export function listAssets(db: DatabaseSync): ItemAsset[] {
  const rows = db
    .prepare("SELECT * FROM item_assets ORDER BY game_id")
    .all() as Row[];
  return rows.map(rowToAsset);
}

export function setAsset(db: DatabaseSync, asset: ItemAsset): void {
  db.prepare(
    `INSERT INTO item_assets
       (game_id, path, source, source_url, license, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id) DO UPDATE SET
       path = excluded.path, source = excluded.source,
       source_url = excluded.source_url, license = excluded.license,
       status = excluded.status, updated_at = excluded.updated_at`,
  ).run(
    asset.gameId,
    asset.path,
    asset.source,
    asset.sourceUrl,
    asset.license,
    asset.status,
    asset.updatedAt,
  );
}
