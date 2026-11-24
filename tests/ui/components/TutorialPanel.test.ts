// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { TUTORIAL } from "../../../src/data/tutorial.ts";
import {
  PANEL_WIDTH,
  TutorialPanel,
} from "../../../src/ui/components/TutorialPanel.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

const STEPS = [
  { title: "Um", text: "primeiro" },
  { title: "Dois", text: "segundo" },
];

describe("TutorialPanel", () => {
  it("avança, conclui no último passo e some", () => {
    const onStep = vi.fn();
    const panel = new TutorialPanel(STEPS, 0, onStep);
    expect(panel.titleText.text).toBe("Um");
    expect(panel.stepText.text).toBe("1/2");
    expect(panel.nextButton.text.text).toBe("Próximo");
    tap(panel.nextButton);
    expect(onStep).toHaveBeenLastCalledWith(1);
    expect(panel.bodyText.text).toBe("segundo");
    expect(panel.nextButton.text.text).toBe("Concluir");
    tap(panel.nextButton);
    expect(onStep).toHaveBeenLastCalledWith(2);
    expect(panel.done).toBe(true);
    expect(panel.visible).toBe(false);
  });

  it("pular termina; passo salvo além do fim já começa escondido", () => {
    const onStep = vi.fn();
    const panel = new TutorialPanel(STEPS, 0, onStep);
    tap(panel.skipButton);
    expect(onStep).toHaveBeenCalledWith(2);
    expect(new TutorialPanel(STEPS, 9, onStep).visible).toBe(false);
  });

  it("fica no canto de baixo à direita, sem sair da tela", () => {
    const panel = new TutorialPanel(STEPS, 0, () => {});
    panel.layout(1000, 800);
    expect(panel.x).toBe(1000 - PANEL_WIDTH - 16);
    expect(panel.y).toBe(800 - 190 - 16);
    panel.layout(100, 100);
    expect(panel.position).toMatchObject({ x: 16, y: 16 });
  });

  it("os passos do jogo têm título e texto", () => {
    expect(TUTORIAL.length).toBeGreaterThan(5);
    for (const step of TUTORIAL) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.text.length).toBeGreaterThan(20);
    }
  });
});
