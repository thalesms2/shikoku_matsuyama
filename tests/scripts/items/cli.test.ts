import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  GENERATED_PATH,
  HELP,
  main,
  overrideFromDef,
  overridePatch,
} from "../../../scripts/items/cli.ts";
import type { CliDeps } from "../../../scripts/items/cli.ts";
import { getAsset, getOverride, openDb } from "../../../scripts/items/db.ts";
import { API_ITEMS, jsonFetch } from "./fixtures.ts";

/** Projeto temporário com banco em arquivo e saída capturada */
function project(
  fetchFn: CliDeps["fetchFn"] = jsonFetch({ data: { items: API_ITEMS } }),
) {
  const root = mkdtempSync(join(tmpdir(), "items-cli-"));
  mkdirSync(join(root, "data"));
  const out: string[] = [];
  const err: string[] = [];
  const deps: CliDeps = {
    root,
    openDb,
    fetchFn,
    now: () => "2026-11-19T00:00:00.000Z",
    log: (m) => out.push(m),
    error: (m) => err.push(m),
  };
  const cli = async (...argv: string[]) => {
    out.length = 0;
    err.length = 0;
    return main(argv, deps);
  };
  const db = () => openDb(join(root, "data/items.db"));
  return { root, out, err, cli, db, deps };
}

describe("main", () => {
  it("mostra a ajuda sem comando, com help ou -h", async () => {
    const { cli, out } = project();
    expect(await cli()).toBe(0);
    expect(out).toEqual([HELP]);
    expect(await cli("help")).toBe(0);
    expect(await cli("sync", "-h")).toBe(0);
    expect(out).toEqual([HELP]);
  });

  it("recusa opções desconhecidas e comandos desconhecidos", async () => {
    const { cli, err } = project();
    expect(await cli("sync", "--nada")).toBe(1);
    expect(err[0]).toContain("--nada");
    expect(await cli("voar")).toBe(1);
    expect(err).toEqual([
      "Comando desconhecido: voar. Veja: npm run items -- help",
    ]);
  });

  it("sync grava os itens da API e informa novos e alterados", async () => {
    const { cli, out } = project();
    expect(await cli("sync")).toBe(0);
    expect(out).toEqual([
      `Sincronizado: ${API_ITEMS.length} itens (${API_ITEMS.length} novos, 0 alterados)`,
    ]);
    await cli("sync");
    expect(out[0]).toContain("(0 novos, 0 alterados)");
  });

  it("sync informa o erro da API", async () => {
    const { cli, err } = project(jsonFetch({ errors: ["fora do ar"] }, 422));
    expect(await cli("sync")).toBe(1);
    expect(err).toEqual(["Erro da API (422): fora do ar"]);
  });

  it("search lista os resultados e respeita --limit", async () => {
    const { cli, out, err } = project();
    await cli("sync");
    await cli("search", "mochila");
    expect(out).toEqual(["src-bag  3x3  backpack  Mochila de teste"]);
    await cli("search", "src-med");
    expect(out[0]).toContain("  -  Remédio de teste");
    await cli("search", "de teste", "--limit", "2");
    expect(out).toHaveLength(2);
    await cli("search", "zzz");
    expect(out).toEqual(["Nenhum item encontrado"]);
    expect(await cli("search")).toBe(1);
    expect(err[0]).toContain("Falta o termo de busca");
    expect(await cli("search", "x", "--limit", "0")).toBe(1);
    expect(err[0]).toBe("--limit deve ser um inteiro >= 1");
  });

  it("override cria e edita, validando o sourceId", async () => {
    const { cli, out, err, db } = project();
    await cli("sync");
    expect(
      await cli(
        "override",
        "ak",
        "--source",
        "src-rifle",
        "--name",
        "Fuzil",
        "--short",
        "F",
      ),
    ).toBe(0);
    expect(out).toEqual(["Override salvo: ak"]);
    expect(await cli("override", "ak", "--source", "sumiu")).toBe(1);
    expect(err[0]).toBe('sourceId desconhecido: sumiu (rode "items sync")');
    expect(await cli("override")).toBe(1);
    const d = db();
    expect(getOverride(d, "ak")).toMatchObject({
      sourceId: "src-rifle",
      name: "Fuzil",
    });
    d.close();
  });

  it("show mostra os dados e a definição final", async () => {
    const { cli, out, err } = project();
    await cli("sync");
    await cli(
      "override",
      "ak",
      "--source",
      "src-rifle",
      "--name",
      "Fuzil",
      "--short",
      "F",
    );
    expect(await cli("show", "ak")).toBe(0);
    expect(JSON.parse(out[0]).reference.sourceId).toBe("src-rifle");
    expect(JSON.parse(out[1])).toMatchObject({
      id: "ak",
      width: 4,
      category: "weapon",
    });
    await cli(
      "override",
      "local",
      "--name",
      "L",
      "--short",
      "L",
      "--category",
      "food",
      "--width",
      "1",
      "--height",
      "1",
    );
    expect(await cli("show", "local")).toBe(0);
    expect(JSON.parse(out[0]).reference).toBeNull();
    expect(await cli("show", "nada")).toBe(1);
    expect(err[0]).toBe("Item sem override: nada");
    expect(await cli("show")).toBe(1);
  });

  it("import cria overrides a partir de uma lista de ItemDef", async () => {
    const { cli, out, err, root, db } = project();
    writeFileSync(
      join(root, "defs.json"),
      JSON.stringify([
        {
          id: "can",
          name: "Lata",
          shortName: "L",
          category: "food",
          width: 1,
          height: 1,
          basePrice: 5,
        },
      ]),
    );
    expect(await cli("import", "defs.json")).toBe(0);
    expect(out).toEqual(["Importados: 1 itens"]);
    const d = db();
    expect(getOverride(d, "can")).toMatchObject({
      name: "Lata",
      basePrice: 5,
      grids: null,
    });
    d.close();
    writeFileSync(join(root, "obj.json"), "{}");
    expect(await cli("import", "obj.json")).toBe(1);
    expect(err[0]).toBe("O arquivo deve ter uma lista de itens");
    expect(await cli("import")).toBe(1);
  });

  it("images baixa os placeholders e lista as falhas", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.endsWith("graphql")
        ? new Response(JSON.stringify({ data: { items: API_ITEMS } }))
        : url.includes("src-ammo")
          ? new Response("x", { status: 500 })
          : new Response("img"),
    );
    const { cli, out, err, root, db } = project(fetchFn);
    await cli("sync");
    await cli("override", "ak", "--source", "src-rifle");
    await cli("override", "ammo", "--source", "src-ammo");
    expect(await cli("images")).toBe(0);
    expect(out).toEqual(["Imagens: 1 baixadas, 0 mantidas, 1 falharam"]);
    expect(err).toEqual(["  ammo: HTTP 500"]);
    expect(
      readFileSync(join(root, "public/assets/items/ak.webp"), "utf8"),
    ).toBe("img");
    await cli("images", "--force");
    expect(out[0]).toContain("1 baixadas");
    const d = db();
    expect(getAsset(d, "ak")?.status).toBe("placeholder");
    d.close();
  });

  it("final, placeholders e o fluxo completo de troca de arte", async () => {
    const { cli, out, err, root, db } = project(async (url) =>
      String(url).endsWith("graphql")
        ? new Response(JSON.stringify({ data: { items: API_ITEMS } }))
        : new Response("img"),
    );
    await cli("sync");
    await cli("placeholders");
    expect(out).toEqual(["Nenhum item usa imagem placeholder"]);
    await cli("override", "ak", "--source", "src-rifle");
    await cli("images");
    await cli("placeholders");
    expect(out).toEqual(["1 itens com imagem placeholder:\nak"]);
    expect(await cli("final", "ak")).toBe(0);
    expect(out).toEqual(["Imagem final: ak"]);
    let d = db();
    expect(getAsset(d, "ak")?.license).toBe("Arte própria do jogo");
    d.close();
    expect(await cli("final", "ak", "--license", "CC0")).toBe(0);
    d = db();
    expect(getAsset(d, "ak")?.license).toBe("CC0");
    d.close();
    expect(await cli("final", "nada")).toBe(1);
    expect(err[0]).toContain("Arquivo não encontrado");
    expect(await cli("final")).toBe(1);
    expect(root).toBeTruthy();
  });

  it("export gera o JSON do jogo, no caminho padrão ou em --out", async () => {
    const { cli, out, err, root } = project();
    await cli("sync");
    await cli(
      "override",
      "ak",
      "--source",
      "src-rifle",
      "--name",
      "Fuzil",
      "--short",
      "F",
    );
    expect(await cli("export")).toBe(0);
    expect(out).toEqual([`Exportados 1 itens para ${GENERATED_PATH}`]);
    const json = readFileSync(join(root, GENERATED_PATH), "utf8");
    expect(json.endsWith("\n")).toBe(true);
    expect(JSON.parse(json)[0]).toMatchObject({ id: "ak", width: 4 });
    expect(await cli("export", "--out", "x/itens.json")).toBe(0);
    expect(
      JSON.parse(readFileSync(join(root, "x/itens.json"), "utf8")),
    ).toHaveLength(1);
    await cli("override", "sem-nome", "--category", "food");
    expect(await cli("export")).toBe(1);
    expect(err[0]).toBe('sem-nome: falta "name" (defina no override)');
  });

  it("aceita outro banco com --db", async () => {
    const { cli, root } = project();
    expect(await cli("override", "a", "--name", "A", "--db", "outro.db")).toBe(
      0,
    );
    const d = openDb(join(root, "outro.db"));
    expect(getOverride(d, "a")?.name).toBe("A");
    d.close();
  });
});

describe("overridePatch", () => {
  it("converte todas as opções", () => {
    expect(
      overridePatch({
        source: "s",
        name: "N",
        short: "n",
        description: "d",
        category: "ammo",
        slot: "pistol",
        "max-stack": "60",
        price: "0",
        width: "2",
        height: "3",
        grids: '[{"width":1,"height":1}]',
        enable: true,
      }),
    ).toEqual({
      sourceId: "s",
      name: "N",
      shortName: "n",
      description: "d",
      category: "ammo",
      equipSlot: "pistol",
      maxStack: 60,
      basePrice: 0,
      width: 2,
      height: 3,
      grids: [{ width: 1, height: 1 }],
      enabled: true,
    });
    expect(overridePatch({ disable: true })).toEqual({ enabled: false });
    expect(overridePatch({ stats: '{"capacity":30}' })).toEqual({
      stats: { capacity: 30 },
    });
    expect(overridePatch({})).toEqual({});
  });

  it("--clear limpa os campos listados", () => {
    expect(overridePatch({ clear: "width, height,source" })).toEqual({
      width: null,
      height: null,
      sourceId: null,
    });
  });

  it.each([
    [{ category: "nave" }, "--category deve ser um de"],
    [{ slot: "cabeça" }, "--slot deve ser um de"],
    [{ width: "0" }, "--width deve ser um inteiro >= 1"],
    [{ height: "1.5" }, "--height deve ser"],
    [{ price: "-1" }, "--price deve ser um inteiro >= 0"],
    [{ "max-stack": "x" }, "--max-stack deve ser"],
    [{ grids: "{}" }, "--grids deve ser uma lista JSON"],
    [{ stats: "[]" }, "--stats deve ser um objeto JSON"],
    [{ stats: "null" }, "--stats deve ser um objeto JSON"],
    [{ stats: "3" }, "--stats deve ser um objeto JSON"],
    [{ enable: true, disable: true }, "não os dois"],
    [{ clear: "cor" }, '--clear: campo desconhecido "cor"'],
  ])("valida %o", (values, message) => {
    expect(() => overridePatch(values as never)).toThrow(message);
  });
});

describe("overrideFromDef", () => {
  it("copia todos os campos da definição", () => {
    expect(
      overrideFromDef({
        id: "a",
        name: "A",
        shortName: "a",
        category: "rig",
        width: 2,
        height: 2,
        basePrice: 10,
        maxStack: 5,
        equipSlot: "rig",
        description: "d",
        grids: [{ width: 1, height: 1 }],
      }),
    ).toEqual({
      enabled: true,
      name: "A",
      shortName: "a",
      description: "d",
      category: "rig",
      equipSlot: "rig",
      maxStack: 5,
      basePrice: 10,
      width: 2,
      height: 2,
      grids: [{ width: 1, height: 1 }],
      stats: null,
    });
  });

  it("copia os dados técnicos", () => {
    expect(
      overrideFromDef({
        id: "m",
        name: "M",
        shortName: "m",
        category: "magazine",
        width: 1,
        height: 2,
        basePrice: 1,
        stats: { caliber: "C", capacity: 30 },
      }).stats,
    ).toEqual({ caliber: "C", capacity: 30 });
  });

  it("campos opcionais ausentes viram null", () => {
    expect(
      overrideFromDef({
        id: "a",
        name: "A",
        shortName: "a",
        category: "food",
        width: 1,
        height: 1,
        basePrice: 1,
      }),
    ).toMatchObject({
      description: null,
      equipSlot: null,
      maxStack: null,
      grids: null,
    });
  });
});
