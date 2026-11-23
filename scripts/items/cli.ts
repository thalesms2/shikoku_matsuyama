import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

import {
  EQUIP_SLOT_TYPES,
  ITEM_CATEGORIES,
} from "../../src/core/inventory/item.ts";
import type {
  EquipSlotType,
  GridSpec,
  ItemCategory,
  ItemDef,
  ItemStats,
} from "../../src/core/inventory/item.ts";
import { fetchApiItems } from "./api.ts";
import type { FetchFn } from "./api.ts";
import { buildCatalog, buildItemDef } from "./build.ts";
import {
  DEFAULT_DB_PATH,
  getAsset,
  getOverride,
  getReference,
  searchReferences,
  upsertOverride,
  upsertReferences,
} from "./db.ts";
import type { ItemOverride } from "./db.ts";
import { downloadImages, listPlaceholders, markFinal } from "./images.ts";
import { toReference } from "./reference.ts";

/** Arquivo gerado que o jogo importa */
export const GENERATED_PATH = "src/data/generated/items.json";

export interface CliDeps {
  /** Raiz do projeto */
  root: string;
  openDb: (path: string) => DatabaseSync;
  fetchFn: FetchFn;
  now: () => string;
  log: (message: string) => void;
  error: (message: string) => void;
}

export const HELP = `Uso: npm run items -- <comando> [opções]

Comandos:
  sync                         baixa os itens da API do tarkov.dev para a base local
  search <termo> [--limit n]   procura itens da base (nome, nome curto, categoria ou id)
  show <id-do-jogo>            mostra override, referência, imagem e a definição final
  override <id-do-jogo> [...]  cria/edita os dados próprios de um item do jogo
      --source <sourceId> --name <nome> --short <nome curto> --description <texto>
      --category <${ITEM_CATEGORIES.join("|")}>
      --slot <${EQUIP_SLOT_TYPES.join("|")}>
      --max-stack <n> --price <n> --width <n> --height <n> --grids '<json>'
      --stats '<json>'         dados técnicos, ex.: '{"caliber":"Caliber545x39","capacity":30}'
      --enable | --disable     inclui ou tira o item do jogo
      --clear <campos>         limpa campos (ex.: width,height) para usar a referência
  import <arquivo.json>        importa uma lista de ItemDef como overrides
  images [--force]             baixa as imagens placeholder dos itens habilitados
  final <id-do-jogo> [--license <texto>]  marca a imagem do item como arte própria
  placeholders                 lista os itens que ainda usam imagem placeholder
  export [--out <arquivo>]     gera ${GENERATED_PATH}

Opção geral: --db <arquivo> (padrão ${DEFAULT_DB_PATH})`;

const OPTIONS = {
  db: { type: "string" },
  limit: { type: "string" },
  out: { type: "string" },
  force: { type: "boolean" },
  license: { type: "string" },
  source: { type: "string" },
  name: { type: "string" },
  short: { type: "string" },
  description: { type: "string" },
  category: { type: "string" },
  slot: { type: "string" },
  "max-stack": { type: "string" },
  price: { type: "string" },
  width: { type: "string" },
  height: { type: "string" },
  grids: { type: "string" },
  stats: { type: "string" },
  enable: { type: "boolean" },
  disable: { type: "boolean" },
  clear: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

type Values = ReturnType<typeof parse>["values"];

function parse(argv: string[]) {
  return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
}

function int(value: string, flag: string, min: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`--${flag} deve ser um inteiro >= ${min}`);
  }
  return n;
}

function oneOf<T extends string>(
  value: string,
  list: readonly T[],
  flag: string,
): T {
  if (!(list as readonly string[]).includes(value)) {
    throw new Error(`--${flag} deve ser um de: ${list.join(", ")}`);
  }
  return value as T;
}

const CLEARABLE: Record<string, keyof ItemOverride> = {
  source: "sourceId",
  name: "name",
  short: "shortName",
  description: "description",
  category: "category",
  slot: "equipSlot",
  "max-stack": "maxStack",
  price: "basePrice",
  width: "width",
  height: "height",
  grids: "grids",
  stats: "stats",
};

/** Converte as opções da linha de comando em um patch de override */
export function overridePatch(values: Values): Partial<ItemOverride> {
  const patch: Record<string, unknown> = {};
  if (values.source !== undefined) patch.sourceId = values.source;
  if (values.name !== undefined) patch.name = values.name;
  if (values.short !== undefined) patch.shortName = values.short;
  if (values.description !== undefined) patch.description = values.description;
  if (values.category !== undefined) {
    patch.category = oneOf<ItemCategory>(
      values.category,
      ITEM_CATEGORIES,
      "category",
    );
  }
  if (values.slot !== undefined) {
    patch.equipSlot = oneOf<EquipSlotType>(
      values.slot,
      EQUIP_SLOT_TYPES,
      "slot",
    );
  }
  if (values["max-stack"] !== undefined) {
    patch.maxStack = int(values["max-stack"], "max-stack", 1);
  }
  if (values.price !== undefined)
    patch.basePrice = int(values.price, "price", 0);
  if (values.width !== undefined) patch.width = int(values.width, "width", 1);
  if (values.height !== undefined)
    patch.height = int(values.height, "height", 1);
  if (values.grids !== undefined) {
    const grids: unknown = JSON.parse(values.grids);
    if (!Array.isArray(grids))
      throw new Error("--grids deve ser uma lista JSON");
    patch.grids = grids as GridSpec[];
  }
  if (values.stats !== undefined) {
    const stats: unknown = JSON.parse(values.stats);
    if (typeof stats !== "object" || stats === null || Array.isArray(stats)) {
      throw new Error("--stats deve ser um objeto JSON");
    }
    patch.stats = stats as ItemStats;
  }
  if (values.enable && values.disable) {
    throw new Error("Use --enable ou --disable, não os dois");
  }
  if (values.enable) patch.enabled = true;
  if (values.disable) patch.enabled = false;
  for (const flag of values.clear?.split(",").map((f) => f.trim()) ?? []) {
    const field = CLEARABLE[flag];
    if (!field) {
      throw new Error(
        `--clear: campo desconhecido "${flag}" (use: ${Object.keys(CLEARABLE).join(", ")})`,
      );
    }
    patch[field] = null;
  }
  return patch as Partial<ItemOverride>;
}

/** Override completo a partir de uma definição do jogo */
export function overrideFromDef(def: ItemDef): Partial<ItemOverride> {
  return {
    enabled: true,
    name: def.name,
    shortName: def.shortName,
    description: def.description ?? null,
    category: def.category,
    equipSlot: def.equipSlot ?? null,
    maxStack: def.maxStack ?? null,
    basePrice: def.basePrice,
    width: def.width,
    height: def.height,
    grids: def.grids ? [...def.grids] : null,
    stats: def.stats ? { ...def.stats } : null,
  };
}

function need(positionals: string[], index: number, what: string): string {
  const value = positionals[index];
  if (!value) throw new Error(`Falta ${what}. Veja: npm run items -- help`);
  return value;
}

/** Executa a CLI e devolve o código de saída */
export async function main(argv: string[], deps: CliDeps): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    deps.error((error as Error).message);
    return 1;
  }
  const { values, positionals } = parsed;
  const [command] = positionals;
  if (!command || command === "help" || values.help) {
    deps.log(HELP);
    return 0;
  }

  const db = deps.openDb(join(deps.root, values.db ?? DEFAULT_DB_PATH));
  try {
    await run(command, values, positionals, db, deps);
    return 0;
  } catch (error) {
    deps.error((error as Error).message);
    return 1;
  } finally {
    db.close();
  }
}

async function run(
  command: string,
  values: Values,
  positionals: string[],
  db: DatabaseSync,
  deps: CliDeps,
): Promise<void> {
  const publicDir = join(deps.root, "public");
  switch (command) {
    case "sync": {
      const items = await fetchApiItems(deps.fetchFn);
      const run = upsertReferences(db, items.map(toReference), deps.now());
      deps.log(
        `Sincronizado: ${run.total} itens (${run.added} novos, ${run.changed} alterados)`,
      );
      return;
    }
    case "search": {
      const term = need(positionals, 1, "o termo de busca");
      const limit = values.limit ? int(values.limit, "limit", 1) : 20;
      const found = searchReferences(db, term, limit);
      if (found.length === 0) deps.log("Nenhum item encontrado");
      for (const ref of found) {
        deps.log(
          `${ref.sourceId}  ${ref.width}x${ref.height}  ${ref.sourceCategory ?? "-"}  ${ref.sourceName}`,
        );
      }
      return;
    }
    case "show": {
      const gameId = need(positionals, 1, "o id do item");
      const override = getOverride(db, gameId);
      if (!override) throw new Error(`Item sem override: ${gameId}`);
      const ref = override.sourceId
        ? getReference(db, override.sourceId)
        : null;
      const asset = getAsset(db, gameId);
      deps.log(JSON.stringify({ override, reference: ref, asset }, null, 2));
      deps.log(JSON.stringify(buildItemDef(override, ref, asset), null, 2));
      return;
    }
    case "override": {
      const gameId = need(positionals, 1, "o id do item");
      const patch = overridePatch(values);
      if (patch.sourceId && !getReference(db, patch.sourceId)) {
        throw new Error(
          `sourceId desconhecido: ${patch.sourceId} (rode "items sync")`,
        );
      }
      const saved = upsertOverride(db, gameId, patch);
      deps.log(`Override salvo: ${saved.gameId}`);
      return;
    }
    case "import": {
      const file = need(positionals, 1, "o arquivo JSON");
      const defs = JSON.parse(await readFile(join(deps.root, file), "utf8"));
      if (!Array.isArray(defs))
        throw new Error("O arquivo deve ter uma lista de itens");
      for (const def of defs as ItemDef[]) {
        upsertOverride(db, def.id, overrideFromDef(def));
      }
      deps.log(`Importados: ${defs.length} itens`);
      return;
    }
    case "images": {
      const report = await downloadImages(db, {
        fetchFn: deps.fetchFn,
        publicDir,
        now: deps.now(),
        force: values.force ?? false,
      });
      deps.log(
        `Imagens: ${report.downloaded.length} baixadas, ${report.skipped.length} mantidas, ${report.failed.length} falharam`,
      );
      for (const f of report.failed) deps.error(`  ${f.gameId}: ${f.reason}`);
      return;
    }
    case "final": {
      const gameId = need(positionals, 1, "o id do item");
      markFinal(db, gameId, {
        publicDir,
        now: deps.now(),
        license: values.license ?? "Arte própria do jogo",
      });
      deps.log(`Imagem final: ${gameId}`);
      return;
    }
    case "placeholders": {
      const ids = listPlaceholders(db);
      deps.log(
        ids.length === 0
          ? "Nenhum item usa imagem placeholder"
          : `${ids.length} itens com imagem placeholder:\n${ids.join("\n")}`,
      );
      return;
    }
    case "export": {
      const defs = buildCatalog(db);
      const out = join(deps.root, values.out ?? GENERATED_PATH);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, `${JSON.stringify(defs, null, 2)}\n`);
      deps.log(
        `Exportados ${defs.length} itens para ${values.out ?? GENERATED_PATH}`,
      );
      return;
    }
    default:
      throw new Error(
        `Comando desconhecido: ${command}. Veja: npm run items -- help`,
      );
  }
}
