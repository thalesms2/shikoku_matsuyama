import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  getAsset,
  upsertOverride,
  upsertReferences,
} from "../../../scripts/items/db.ts";
import {
  ITEM_IMAGE_DIR,
  PLACEHOLDER_LICENSE,
  PLACEHOLDER_SOURCE,
  downloadImages,
  imagePath,
  listPlaceholders,
  markFinal,
} from "../../../scripts/items/images.ts";
import { toReference } from "../../../scripts/items/reference.ts";
import { API_ITEMS, memoryDb } from "./fixtures.ts";

function setup() {
  const db = memoryDb();
  upsertReferences(db, API_ITEMS.map(toReference), "now");
  const publicDir = mkdtempSync(join(tmpdir(), "items-public-"));
  const fetchFn = vi.fn(async (url: string) => new Response(`img:${url}`));
  return { db, publicDir, fetchFn };
}

const read = (publicDir: string, id: string) =>
  readFileSync(join(publicDir, imagePath(id)), "utf8");

describe("imagePath", () => {
  it("usa o id do jogo dentro de assets/items", () => {
    expect(ITEM_IMAGE_DIR).toBe("assets/items");
    expect(imagePath("ammo_545")).toBe("assets/items/ammo_545.webp");
  });
});

describe("downloadImages", () => {
  it("baixa a imagem dos itens habilitados com sourceId e registra como placeholder", async () => {
    const { db, publicDir, fetchFn } = setup();
    upsertOverride(db, "rifle", { sourceId: "src-rifle" });
    upsertOverride(db, "local", {});
    upsertOverride(db, "off", { sourceId: "src-ammo", enabled: false });
    const report = await downloadImages(db, { fetchFn, publicDir, now: "t1" });
    expect(report).toEqual({ downloaded: ["rifle"], skipped: [], failed: [] });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(read(publicDir, "rifle")).toBe(
      "img:https://assets.example/src-rifle-grid-image.webp",
    );
    expect(getAsset(db, "rifle")).toEqual({
      gameId: "rifle",
      path: "assets/items/rifle.webp",
      source: PLACEHOLDER_SOURCE,
      sourceUrl: "https://assets.example/src-rifle-grid-image.webp",
      license: PLACEHOLDER_LICENSE,
      status: "placeholder",
      updatedAt: "t1",
    });
  });

  it("não baixa de novo placeholders existentes, a não ser com force", async () => {
    const { db, publicDir, fetchFn } = setup();
    upsertOverride(db, "rifle", { sourceId: "src-rifle" });
    await downloadImages(db, { fetchFn, publicDir, now: "t1" });
    const again = await downloadImages(db, { fetchFn, publicDir, now: "t2" });
    expect(again.skipped).toEqual(["rifle"]);
    const forced = await downloadImages(db, {
      fetchFn,
      publicDir,
      now: "t3",
      force: true,
    });
    expect(forced.downloaded).toEqual(["rifle"]);
    expect(getAsset(db, "rifle")?.updatedAt).toBe("t3");
  });

  it("baixa de novo se o arquivo do placeholder sumiu", async () => {
    const { db, publicDir, fetchFn } = setup();
    upsertOverride(db, "rifle", { sourceId: "src-rifle" });
    await downloadImages(db, { fetchFn, publicDir, now: "t1" });
    const other = mkdtempSync(join(tmpdir(), "items-public-"));
    const report = await downloadImages(db, {
      fetchFn,
      publicDir: other,
      now: "t2",
    });
    expect(report.downloaded).toEqual(["rifle"]);
  });

  it("nunca sobrescreve imagens finais, nem com force", async () => {
    const { db, publicDir, fetchFn } = setup();
    upsertOverride(db, "rifle", { sourceId: "src-rifle" });
    mkdirSync(join(publicDir, ITEM_IMAGE_DIR), { recursive: true });
    writeFileSync(join(publicDir, imagePath("rifle")), "arte própria");
    markFinal(db, "rifle", { publicDir, now: "t0", license: "minha" });
    const report = await downloadImages(db, {
      fetchFn,
      publicDir,
      now: "t1",
      force: true,
    });
    expect(report.skipped).toEqual(["rifle"]);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(read(publicDir, "rifle")).toBe("arte própria");
  });

  it("reporta itens sem imagem e falhas de download", async () => {
    const { db, publicDir } = setup();
    upsertOverride(db, "key", { sourceId: "src-key" });
    upsertOverride(db, "a404", { sourceId: "src-ammo" });
    upsertOverride(db, "boom", { sourceId: "src-food" });
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("src-food")) throw new Error("sem rede");
      return new Response("x", { status: 404 });
    });
    const report = await downloadImages(db, { fetchFn, publicDir, now: "t" });
    expect(report.downloaded).toEqual([]);
    expect(report.failed).toEqual([
      { gameId: "a404", reason: "HTTP 404" },
      { gameId: "boom", reason: "sem rede" },
      { gameId: "key", reason: "sem imagem na referência" },
    ]);
    expect(existsSync(join(publicDir, imagePath("a404")))).toBe(false);
    expect(getAsset(db, "a404")).toBeNull();
  });
});

describe("markFinal e listPlaceholders", () => {
  it("marca como final só se o arquivo existir", async () => {
    const { db, publicDir, fetchFn } = setup();
    expect(() =>
      markFinal(db, "nada", { publicDir, now: "t", license: "x" }),
    ).toThrow("Arquivo não encontrado: public/assets/items/nada.webp");
    upsertOverride(db, "rifle", { sourceId: "src-rifle" });
    upsertOverride(db, "ammo", { sourceId: "src-ammo" });
    await downloadImages(db, { fetchFn, publicDir, now: "t" });
    expect(listPlaceholders(db)).toEqual(["ammo", "rifle"]);
    markFinal(db, "rifle", { publicDir, now: "t2", license: "Arte própria" });
    expect(getAsset(db, "rifle")).toMatchObject({
      status: "final",
      source: "própria",
      sourceUrl: null,
      license: "Arte própria",
    });
    expect(listPlaceholders(db)).toEqual(["ammo"]);
  });
});
