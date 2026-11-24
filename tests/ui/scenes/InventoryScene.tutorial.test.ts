// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { TUTORIAL } from "../../../src/data/tutorial.ts";
import { TutorialPanel } from "../../../src/ui/components/TutorialPanel.ts";
import { InventoryScene } from "../../../src/ui/scenes/InventoryScene.ts";

describe("InventoryScene: tutorial", () => {
  it("o painel fica por cima e se posiciona no resize", () => {
    const { inventory } = createNewPlayer(new ManualClock());
    const tutorial = new TutorialPanel(TUTORIAL, 0, () => {});
    const scene = new InventoryScene(inventory, { tutorial });
    expect(scene.tutorial).toBe(tutorial);
    expect(scene.view.children).toContain(tutorial);
    scene.resize(1200, 900);
    expect(tutorial.y).toBeGreaterThan(600);
    expect(new InventoryScene(inventory).tutorial).toBeNull();
  });
});
