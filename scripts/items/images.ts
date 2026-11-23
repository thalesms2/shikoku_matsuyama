import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import type { FetchFn } from "./api.ts";
import {
  getAsset,
  getReference,
  listAssets,
  listOverrides,
  setAsset,
} from "./db.ts";

/** Pasta das imagens dos itens, relativa a `public/` */
export const ITEM_IMAGE_DIR = "assets/items";

export const PLACEHOLDER_SOURCE = "tarkov.dev";
export const PLACEHOLDER_LICENSE =
  "Placeholder temporário (tarkov.dev); substituir por arte própria";

export function imagePath(gameId: string): string {
  return `${ITEM_IMAGE_DIR}/${gameId}.webp`;
}

export interface ImageReport {
  downloaded: string[];
  skipped: string[];
  failed: { gameId: string; reason: string }[];
}

/**
 * Baixa as imagens placeholder dos itens habilitados que têm `sourceId`.
 * Nunca sobrescreve imagens marcadas como `final`. Imagens placeholder já
 * baixadas só são baixadas de novo com `force`.
 */
export async function downloadImages(
  db: DatabaseSync,
  options: {
    fetchFn: FetchFn;
    publicDir: string;
    now: string;
    force?: boolean;
  },
): Promise<ImageReport> {
  const report: ImageReport = { downloaded: [], skipped: [], failed: [] };
  await mkdir(join(options.publicDir, ITEM_IMAGE_DIR), { recursive: true });

  for (const override of listOverrides(db)) {
    if (!override.enabled || !override.sourceId) continue;
    const { gameId } = override;
    const asset = getAsset(db, gameId);
    const path = imagePath(gameId);
    const file = join(options.publicDir, path);
    if (asset?.status === "final") {
      report.skipped.push(gameId);
      continue;
    }
    if (asset && existsSync(file) && !options.force) {
      report.skipped.push(gameId);
      continue;
    }
    const url = getReference(db, override.sourceId)?.imageUrl;
    if (!url) {
      report.failed.push({ gameId, reason: "sem imagem na referência" });
      continue;
    }
    try {
      const res = await options.fetchFn(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(file, new Uint8Array(await res.arrayBuffer()));
    } catch (error) {
      report.failed.push({ gameId, reason: (error as Error).message });
      continue;
    }
    setAsset(db, {
      gameId,
      path,
      source: PLACEHOLDER_SOURCE,
      sourceUrl: url,
      license: PLACEHOLDER_LICENSE,
      status: "placeholder",
      updatedAt: options.now,
    });
    report.downloaded.push(gameId);
  }
  return report;
}

/**
 * Marca a imagem do item como arte própria definitiva. O arquivo precisa
 * existir em `public/assets/items/<id>.webp`.
 */
export function markFinal(
  db: DatabaseSync,
  gameId: string,
  options: { publicDir: string; now: string; license: string },
): void {
  const path = imagePath(gameId);
  if (!existsSync(join(options.publicDir, path))) {
    throw new Error(`Arquivo não encontrado: public/${path}`);
  }
  setAsset(db, {
    gameId,
    path,
    source: "própria",
    sourceUrl: null,
    license: options.license,
    status: "final",
    updatedAt: options.now,
  });
}

/** Ids dos itens que ainda usam imagem placeholder */
export function listPlaceholders(db: DatabaseSync): string[] {
  return listAssets(db)
    .filter((a) => a.status === "placeholder")
    .map((a) => a.gameId);
}
