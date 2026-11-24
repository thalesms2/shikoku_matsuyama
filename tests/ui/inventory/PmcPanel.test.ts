// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import {
  MAX_LEVEL,
  createPmc,
  damage,
  xpForLevel,
} from "../../../src/core/pmc/pmc.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { IconButton, sortIcon } from "../../../src/ui/components/IconButton.ts";
import {
  PART_CRITICAL,
  PART_DESTROYED,
  PART_HURT,
  PART_OK,
  PANEL_WIDTH,
  PmcPanel,
  partColor,
} from "../../../src/ui/inventory/PmcPanel.ts";
import {
  InventoryScene,
  PANEL_REFRESH_MS,
  STASH_X,
} from "../../../src/ui/scenes/InventoryScene.ts";

describe("partColor", () => {
  it("verde, amarelo, vermelho e destruída", () => {
    expect(partColor(35, 35)).toBe(PART_OK);
    expect(partColor(20, 35)).toBe(PART_HURT);
    expect(partColor(10, 35)).toBe(PART_CRITICAL);
    expect(partColor(0, 35)).toBe(PART_DESTROYED);
  });
});

describe("PmcPanel", () => {
  it("mostra nível, XP, vida de cada parte, vida total, energia e hidratação", () => {
    const panel = new PmcPanel();
    const pmc = createPmc();
    pmc.xp = xpForLevel(3) + 500;
    damage(pmc, "leftArm", 60);
    damage(pmc, "rightLeg", 50);
    pmc.energy = 33.4;
    pmc.hydration = 0;
    panel.refresh(pmc);
    expect(panel.levelText.text).toBe("Nível 3");
    expect(panel.xpText.text).toBe("500/3000 XP");
    expect(panel.partTexts.get("head")!.text).toBe("Cabeça 35/35");
    expect(panel.partTexts.get("leftArm")!.text).toBe("Braço esq. ×");
    expect(panel.partTexts.get("leftArm")!.style.fill).toBe(PART_CRITICAL);
    expect(panel.partTexts.get("rightLeg")!.text).toBe("Perna dir. 15/65");
    expect(panel.partColors.get("head")).toBe(PART_OK);
    expect(panel.partColors.get("leftArm")).toBe(PART_DESTROYED);
    expect(panel.partColors.get("rightLeg")).toBe(PART_CRITICAL);
    expect(panel.totalText.text).toBe("Vida 330/440");
    expect(panel.energyText.text).toBe("Energia 33/100");
    expect(panel.hydrationText.text).toBe("Hidratação 0/100");
  });

  it("nível máximo", () => {
    const panel = new PmcPanel();
    const pmc = createPmc();
    pmc.xp = xpForLevel(MAX_LEVEL) + 10;
    panel.refresh(pmc);
    expect(panel.levelText.text).toBe(`Nível ${MAX_LEVEL}`);
    expect(panel.xpText.text).toBe("máximo");
  });
});

describe("IconButton", () => {
  it("botão azul com ícone; a dica aparece com o ponteiro em cima", () => {
    const onPress = vi.fn();
    const button = new IconButton(sortIcon, "Organizar", onPress, 30);
    expect(button.buttonWidth).toBe(30);
    expect(button.text.text).toBe("");
    expect(button.icon.getLocalBounds().width).toBeGreaterThan(0);
    expect(button.hint.visible).toBe(false);
    button.emit("pointerover", {} as never);
    expect(button.hint.visible).toBe(true);
    expect(button.hint.text).toBe("Organizar");
    button.emit("pointerout", {} as never);
    expect(button.hint.visible).toBe(false);
    button.emit("pointertap", {} as never);
    expect(onPress).toHaveBeenCalledOnce();
    expect(new IconButton(sortIcon, "X", () => {}).buttonWidth).toBe(28);
  });
});

describe("InventoryScene: painel do PMC", () => {
  it("só existe com o PMC e fica entre o equipamento e o estoque", () => {
    const player = createNewPlayer(new ManualClock());
    const scene = new InventoryScene(player.inventory, { player });
    const panel = scene.pmcPanel!;
    expect(panel.x + PANEL_WIDTH).toBeLessThan(STASH_X);
    const primary = scene.slotViews.get("primary")!;
    expect(panel.x).toBeGreaterThanOrEqual(primary.x + primary.pixelWidth * 2);
    expect(panel.levelText.text).toBe("Nível 1");
    expect(new InventoryScene(player.inventory).pmcPanel).toBeNull();
    scene.destroy();
  });

  it("atualiza ao usar um remédio e a cada intervalo (esconderijo)", () => {
    const player = createNewPlayer(new ManualClock());
    const scene = new InventoryScene(player.inventory, { player });
    damage(player.pmc, "thorax", 50);
    scene.refresh();
    expect(scene.pmcPanel!.partTexts.get("thorax")!.text).toBe("Tórax 35/85");
    player.pmc.health.thorax = 85;
    scene.update(PANEL_REFRESH_MS - 1);
    expect(scene.pmcPanel!.partTexts.get("thorax")!.text).toBe("Tórax 35/85");
    scene.update(1);
    expect(scene.pmcPanel!.partTexts.get("thorax")!.text).toBe("Tórax 85/85");
    // sem PMC, o update não mexe em painel nenhum
    const plain = new InventoryScene(player.inventory);
    plain.update(PANEL_REFRESH_MS);
    scene.destroy();
    plain.destroy();
  });
});
