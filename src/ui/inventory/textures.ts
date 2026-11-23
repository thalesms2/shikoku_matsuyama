import { Assets } from "pixi.js";
import type { Texture } from "pixi.js";

import type { ItemDef } from "../../core/inventory/item.ts";

const textures = new Map<string, Texture>();

/** Textura carregada para o tipo de item, ou `null` */
export function itemTexture(defId: string): Texture | null {
  return textures.get(defId) ?? null;
}

export function setItemTexture(defId: string, texture: Texture): void {
  textures.set(defId, texture);
}

export function clearItemTextures(): void {
  textures.clear();
}

export type TextureLoader = (src: string) => Promise<Texture | undefined>;

/**
 * Carrega as imagens dos itens que têm `image`. Arquivos que faltam (as
 * imagens placeholder ficam fora do git) não impedem o jogo de abrir: o item
 * continua sendo desenhado como um retângulo colorido.
 */
export async function loadItemTextures(
  defs: readonly ItemDef[],
  load: TextureLoader = (src) => Assets.load<Texture>(src),
): Promise<{ loaded: string[]; missing: string[] }> {
  const withImage = defs.filter((d) => d.image);
  const results = await Promise.allSettled(
    withImage.map((d) => load(d.image as string)),
  );
  const loaded: string[] = [];
  const missing: string[] = [];
  results.forEach((result, i) => {
    const id = withImage[i].id;
    if (result.status === "fulfilled" && result.value) {
      setItemTexture(id, result.value);
      loaded.push(id);
    } else {
      missing.push(id);
    }
  });
  return { loaded, missing };
}
