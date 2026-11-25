// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { Equipment } from "../../../src/core/inventory/equipment.ts";
import { Grid } from "../../../src/core/inventory/grid.ts";
import { ItemFactory } from "../../../src/core/inventory/item.ts";
import { catalog } from "../../../src/data/items.ts";
import { itemSheet } from "../../../src/ui/inventory/Tooltip.ts";
import {
  STASH_X,
  InventoryScene,
} from "../../../src/ui/scenes/InventoryScene.ts";

const make = (id: string) => new ItemFactory(catalog).create(id);

describe("InventoryScene: óculos e cobertura do rosto", () => {
  it("empilha os dois slots ao lado do coldre, com os bolsos depois", () => {
    const equipment = new Equipment();
    equipment.equip("eyewear", make("eyewear_sun"));
    const scene = new InventoryScene({ stash: new Grid(6, 4), equipment });
    const holster = scene.slotViews.get("holster")!;
    const eyewear = scene.slotViews.get("eyewear")!;
    const face = scene.slotViews.get("face")!;
    expect(eyewear.title.text).toBe("Óculos");
    expect(face.title.text).toBe("Cobertura do rosto");
    expect(eyewear.y).toBe(holster.y);
    expect(eyewear.x).toBe(holster.x + holster.pixelWidth + 12);
    expect(face.x).toBe(eyewear.x);
    expect(face.y).toBeGreaterThan(eyewear.y + eyewear.pixelHeight);
    expect(eyewear.itemView).not.toBeNull();
    const pocketX = scene.pocketViews[0].x;
    expect(pocketX).toBeGreaterThan(eyewear.x + eyewear.pixelWidth);
    expect(pocketX + 4 * 54).toBeLessThan(STASH_X - 180);
    scene.destroy();
  });

  it("tooltip mostra os bônus de percepção e furtividade", () => {
    const lines = itemSheet(make("eyewear_tactical"));
    expect(lines).toContain("Percepção: +3");
    expect(lines).toContain("Furtividade: +1");
    expect(itemSheet(make("face_scarf"))).toContain("Furtividade: +1");
  });
});
