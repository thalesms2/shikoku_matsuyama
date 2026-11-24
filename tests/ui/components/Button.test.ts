// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, HOVER_TINT } from "../../../src/ui/components/Button.ts";

describe("Button", () => {
  afterEach(() => {
    Button.feedback = null;
  });

  it("clique chama o retorno (e antes o feedback, se houver)", () => {
    const calls: string[] = [];
    const button = new Button("Ok", () => calls.push("ação"));
    button.emit("pointertap", {} as never);
    Button.feedback = () => calls.push("som");
    button.emit("pointertap", {} as never);
    expect(calls).toEqual(["ação", "som", "ação"]);
  });

  it("destaca o fundo com o ponteiro em cima sem mexer no alpha", () => {
    const button = new Button("Ok", vi.fn());
    button.alpha = 0.55;
    button.emit("pointerover", {} as never);
    expect(button.background.tint).toBe(HOVER_TINT);
    button.emit("pointerout", {} as never);
    expect(button.background.tint).toBe(0xffffff);
    expect(button.alpha).toBe(0.55);
  });
});
