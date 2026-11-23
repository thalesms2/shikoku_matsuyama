// @vitest-environment jsdom
import { Texture } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemDef } from "../../../src/core/inventory/item.ts";
import { ItemView } from "../../../src/ui/inventory/ItemView.ts";
import { CELL } from "../../../src/ui/inventory/layout.ts";
import {
  clearItemTextures,
  itemTexture,
  loadItemTextures,
  setItemTexture,
} from "../../../src/ui/inventory/textures.ts";
import { setup } from "../../core/inventory/fixtures.ts";

afterEach(() => clearItemTextures());

const def = (id: string, image?: string): ItemDef => ({
  id,
  name: id,
  shortName: id,
  category: "barter",
  width: 1,
  height: 1,
  basePrice: 1,
  ...(image && { image }),
});

describe("registro de texturas", () => {
  it("guarda e limpa texturas por tipo de item", () => {
    expect(itemTexture("a")).toBeNull();
    setItemTexture("a", Texture.WHITE);
    expect(itemTexture("a")).toBe(Texture.WHITE);
    clearItemTextures();
    expect(itemTexture("a")).toBeNull();
  });

  it("carrega só itens com imagem e tolera arquivos que faltam", async () => {
    const load = vi.fn(async (src: string) => {
      if (src === "falha.webp") throw new Error("404");
      if (src === "vazio.webp") return undefined;
      return Texture.WHITE;
    });
    const result = await loadItemTextures(
      [
        def("ok", "ok.webp"),
        def("sem"),
        def("falha", "falha.webp"),
        def("vazio", "vazio.webp"),
      ],
      load,
    );
    expect(result).toEqual({ loaded: ["ok"], missing: ["falha", "vazio"] });
    expect(load).toHaveBeenCalledTimes(3);
    expect(itemTexture("ok")).toBe(Texture.WHITE);
    expect(itemTexture("falha")).toBeNull();
  });

  it("usa o Assets do Pixi por padrão", async () => {
    const { Assets } = await import("pixi.js");
    const spy = vi
      .spyOn(Assets, "load")
      .mockResolvedValue(Texture.WHITE as never);
    await loadItemTextures([def("a", "a.webp")]);
    expect(spy).toHaveBeenCalledWith("a.webp");
    expect(itemTexture("a")).toBe(Texture.WHITE);
  });
});

describe("ItemView com imagem", () => {
  it("sem textura não cria sprite", () => {
    const { make } = setup();
    expect(new ItemView(make("wide")).sprite).toBeNull();
  });

  it("desenha a imagem do tamanho das células, entre o fundo e os textos", () => {
    const { make } = setup();
    setItemTexture("wide", Texture.WHITE);
    const view = new ItemView(make("wide"));
    const sprite = view.sprite!;
    expect(view.children.indexOf(sprite)).toBe(1);
    expect(view.children.indexOf(view.countLabel)).toBeGreaterThan(1);
    expect(sprite.width).toBe(2 * CELL - 2);
    expect(sprite.height).toBe(CELL - 2);
    expect(sprite.rotation).toBe(0);
    expect(sprite.position.x).toBe(1);
  });

  it("gira a imagem junto com o item", () => {
    const { make } = setup();
    setItemTexture("wide", Texture.WHITE);
    const view = new ItemView(make("wide"), true);
    const sprite = view.sprite!;
    expect(sprite.rotation).toBeCloseTo(Math.PI / 2);
    // rotacionado o item ocupa 1x2 células; a imagem começa na borda direita
    expect(sprite.position.x).toBe(CELL - 1);
    view.setRotated(false);
    expect(sprite.rotation).toBe(0);
    expect(sprite.position.x).toBe(1);
  });
});
