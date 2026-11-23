// @vitest-environment jsdom
import { Texture } from "pixi.js";
import { afterEach, describe, expect, it } from "vitest";

import { ItemFactory, Catalog } from "../../../src/core/inventory/item.ts";
import type { ItemDef } from "../../../src/core/inventory/item.ts";
import {
  clearItemTextures,
  setItemTexture,
} from "../../../src/ui/inventory/textures.ts";
import {
  DESCRIPTION_CHARS,
  TOOLTIP_IMAGE_MAX,
  TOOLTIP_WIDTH,
  Tooltip,
  formatCaliber,
  itemSheet,
  wrapText,
} from "../../../src/ui/inventory/Tooltip.ts";

afterEach(() => clearItemTextures());

const base: ItemDef = {
  id: "x",
  name: "Item X",
  shortName: "X",
  category: "barter",
  width: 1,
  height: 1,
  basePrice: 10,
};

function make(def: Partial<ItemDef> = {}) {
  const full = { ...base, ...def };
  return new ItemFactory(new Catalog([full])).create(full.id);
}

describe("wrapText", () => {
  it("quebra por palavras sem passar do limite", () => {
    expect(wrapText("um dois tres quatro", 9)).toEqual([
      "um dois",
      "tres",
      "quatro",
    ]);
    expect(wrapText("curto", 20)).toEqual(["curto"]);
  });

  it("corta palavras maiores que a linha", () => {
    expect(wrapText("ab abcdefgh c", 4)).toEqual(["ab", "abcd", "efgh", "c"]);
    expect(wrapText("abcdefgh", 4)).toEqual(["abcd", "efgh"]);
  });

  it("respeita quebras de linha e ignora espaços extras", () => {
    expect(wrapText("a  b\nc", 10)).toEqual(["a b", "c"]);
    expect(wrapText("", 10)).toEqual([""]);
  });
});

describe("formatCaliber", () => {
  it("usa nomes conhecidos ou tira o prefixo", () => {
    expect(formatCaliber("Caliber545x39")).toBe("5.45x39");
    expect(formatCaliber("Caliber9x19PARA")).toBe("9x19 Parabellum");
    expect(formatCaliber("Caliber366TKM")).toBe("366TKM");
  });
});

describe("itemSheet", () => {
  it("vazio sem dados técnicos", () => {
    expect(itemSheet(make())).toEqual([]);
    expect(itemSheet(make({ stats: {} }))).toEqual([]);
  });

  it("lista todos os dados presentes", () => {
    const item = make({
      stats: {
        caliber: "Caliber545x39",
        damage: 50,
        penetration: 30,
        armorClass: 4,
        durability: 60,
        capacity: 30,
      },
    });
    expect(itemSheet(item)).toEqual([
      "Calibre: 5.45x39",
      "Dano: 50",
      "Penetração: 30",
      "Classe de proteção: 4",
      "Durabilidade: 60",
      "Capacidade: 30 cartuchos",
    ]);
  });
});

describe("Tooltip", () => {
  it("mostra a ficha técnica junto com os dados básicos", () => {
    const tooltip = new Tooltip();
    tooltip.show(make({ stats: { damage: 40 } }), 0, 0);
    expect(tooltip.text.text).toContain("Item X");
    expect(tooltip.text.text).toContain("Dano: 40");
    expect(tooltip.descriptionText.visible).toBe(false);
    expect(tooltip.image).toBeNull();
    expect(tooltip.boxWidth).toBe(TOOLTIP_WIDTH);
  });

  it("mostra a descrição quebrada em linhas e aumenta a altura", () => {
    const tooltip = new Tooltip();
    tooltip.show(make(), 0, 0);
    const plain = tooltip.boxHeight;
    const description = "palavra ".repeat(20).trim();
    tooltip.show(make({ description }), 0, 0);
    expect(tooltip.descriptionText.visible).toBe(true);
    expect(tooltip.descriptionText.text).toBe(
      wrapText(description, DESCRIPTION_CHARS).join("\n"),
    );
    expect(tooltip.boxHeight).toBeGreaterThan(plain);
    expect(tooltip.descriptionText.position.y).toBeGreaterThan(
      tooltip.text.position.y,
    );
  });

  it("mostra a imagem do item no topo, limitada em tamanho", () => {
    setItemTexture("x", Texture.WHITE);
    const tooltip = new Tooltip();
    tooltip.show(make({ width: 5, height: 2 }), 0, 0);
    const image = tooltip.image!;
    expect(image.width).toBeLessThanOrEqual(TOOLTIP_WIDTH - 16);
    expect(image.height).toBeLessThanOrEqual(TOOLTIP_IMAGE_MAX);
    expect(image.position.y).toBe(8);
    expect(tooltip.text.position.y).toBeGreaterThan(image.height);
    // ao mostrar outro item sem imagem, a anterior é removida
    clearItemTextures();
    tooltip.show(make(), 0, 0);
    expect(image.destroyed).toBe(true);
    expect(tooltip.image).toBeNull();
  });

  it("dentro dos limites fica ao lado do ponteiro", () => {
    const tooltip = new Tooltip();
    tooltip.show(make(), 100, 100, { x: 0, y: 0, width: 1000, height: 1000 });
    expect([tooltip.x, tooltip.y]).toEqual([116, 116]);
  });

  it("troca de lado na borda direita e sobe na borda de baixo", () => {
    const tooltip = new Tooltip();
    const bounds = { x: 0, y: 0, width: 400, height: 300 };
    tooltip.show(make(), 380, 290, bounds);
    expect(tooltip.x).toBe(380 - 16 - TOOLTIP_WIDTH);
    expect(tooltip.y).toBe(300 - tooltip.boxHeight);
  });

  it("nunca sai pela esquerda nem por cima", () => {
    const tooltip = new Tooltip();
    tooltip.show(make(), 100, 0, { x: 50, y: 20, width: 200, height: 40 });
    expect(tooltip.x).toBe(50);
    expect(tooltip.y).toBe(20);
  });
});
