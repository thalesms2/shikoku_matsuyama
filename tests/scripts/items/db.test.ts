import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DB_PATH,
  emptyOverride,
  getAsset,
  getOverride,
  getReference,
  listAssets,
  listOverrides,
  listSyncRuns,
  openDb,
  searchReferences,
  setAsset,
  upsertOverride,
  upsertReferences,
} from "../../../scripts/items/db.ts";
import type { ItemAsset } from "../../../scripts/items/db.ts";
import { toReference } from "../../../scripts/items/reference.ts";
import { API_ITEMS, memoryDb } from "./fixtures.ts";

const refs = API_ITEMS.map(toReference);

describe("openDb", () => {
  it("cria o schema e pode reabrir um arquivo existente", () => {
    expect(DEFAULT_DB_PATH).toBe("data/items.db");
    const file = join(mkdtempSync(join(tmpdir(), "items-db-")), "items.db");
    const db = openDb(file);
    upsertOverride(db, "a", { name: "A" });
    db.close();
    const again = openDb(file);
    expect(getOverride(again, "a")?.name).toBe("A");
    again.close();
  });
});

describe("migração", () => {
  it("adiciona a coluna stats em bancos criados antes dela", () => {
    const file = join(mkdtempSync(join(tmpdir(), "items-db-")), "old.db");
    const old = new DatabaseSync(file);
    old.exec(
      "CREATE TABLE item_overrides (game_id TEXT PRIMARY KEY, source_id TEXT, enabled INTEGER NOT NULL DEFAULT 1, name TEXT, short_name TEXT, description TEXT, category TEXT, equip_slot TEXT, max_stack INTEGER, base_price INTEGER, width INTEGER, height INTEGER, grids TEXT)",
    );
    old.exec("INSERT INTO item_overrides (game_id, name) VALUES ('a', 'A')");
    old.close();
    const db = openDb(file);
    expect(getOverride(db, "a")).toMatchObject({ name: "A", stats: null });
    upsertOverride(db, "a", { stats: { capacity: 30 } });
    expect(getOverride(db, "a")?.stats).toEqual({ capacity: 30 });
    db.close();
  });
});

describe("referência", () => {
  it("insere itens novos e registra a sincronização", () => {
    const db = memoryDb();
    const run = upsertReferences(db, refs, "2026-01-01");
    expect(run).toEqual({
      id: 1,
      ranAt: "2026-01-01",
      total: refs.length,
      added: refs.length,
      changed: 0,
    });
    expect(getReference(db, "src-ammo")).toEqual(refs[2]);
    expect(getReference(db, "nada")).toBeNull();
  });

  it("só atualiza itens que mudaram", () => {
    const db = memoryDb();
    upsertReferences(db, refs, "2026-01-01");
    const changed = refs.map((r) =>
      r.sourceId === "src-ammo" ? { ...r, basePrice: 999 } : r,
    );
    const run = upsertReferences(db, changed, "2026-02-01");
    expect(run).toMatchObject({ id: 2, added: 0, changed: 1 });
    expect(getReference(db, "src-ammo")?.basePrice).toBe(999);
    expect(listSyncRuns(db).map((r) => r.ranAt)).toEqual([
      "2026-01-01",
      "2026-02-01",
    ]);
  });

  it("busca por nome, nome curto, categoria ou id, com limite", () => {
    const db = memoryDb();
    upsertReferences(db, refs, "now");
    expect(searchReferences(db, "MOCHILA").map((r) => r.sourceId)).toEqual([
      "src-bag",
    ]);
    expect(searchReferences(db, "src-key")[0].sourceId).toBe("src-key");
    expect(searchReferences(db, "handgun")[0].sourceId).toBe("src-pistol");
    expect(searchReferences(db, "de teste", 3)).toHaveLength(3);
    expect(searchReferences(db, "inexistente")).toEqual([]);
  });
});

describe("overrides", () => {
  it("cria com valores padrão e lista em ordem", () => {
    const db = memoryDb();
    upsertOverride(db, "b", {});
    upsertOverride(db, "a", { name: "A", grids: [{ width: 1, height: 2 }] });
    expect(listOverrides(db).map((o) => o.gameId)).toEqual(["a", "b"]);
    expect(getOverride(db, "b")).toEqual(emptyOverride("b"));
    expect(getOverride(db, "a")?.grids).toEqual([{ width: 1, height: 2 }]);
    expect(getOverride(db, "c")).toBeNull();
  });

  it("mescla o patch com o que já existe e null limpa o campo", () => {
    const db = memoryDb();
    upsertOverride(db, "a", {
      sourceId: "src-ammo",
      name: "A",
      width: 2,
      height: 3,
      maxStack: 10,
      basePrice: 5,
      category: "ammo",
      equipSlot: "pistol",
      description: "desc",
      shortName: "a",
    });
    const updated = upsertOverride(db, "a", {
      name: "B",
      width: null,
      enabled: false,
    });
    expect(updated).toMatchObject({
      name: "B",
      width: null,
      height: 3,
      enabled: false,
    });
    expect(getOverride(db, "a")).toEqual(updated);
  });
});

describe("assets", () => {
  const asset: ItemAsset = {
    gameId: "a",
    path: "assets/items/a.webp",
    source: "tarkov.dev",
    sourceUrl: "https://x/a.webp",
    license: "placeholder",
    status: "placeholder",
    updatedAt: "now",
  };

  it("grava, atualiza e lista", () => {
    const db = memoryDb();
    expect(getAsset(db, "a")).toBeNull();
    setAsset(db, asset);
    expect(getAsset(db, "a")).toEqual(asset);
    setAsset(db, { ...asset, status: "final", sourceUrl: null });
    expect(getAsset(db, "a")).toMatchObject({
      status: "final",
      sourceUrl: null,
    });
    setAsset(db, { ...asset, gameId: "0" });
    expect(listAssets(db).map((a) => a.gameId)).toEqual(["0", "a"]);
  });

  it("recusa status inválido", () => {
    const db = memoryDb();
    expect(() => setAsset(db, { ...asset, status: "x" as never })).toThrow();
  });
});
