// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import { withRepeatables } from "../../../src/core/quests/repeatable.ts";
import { MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { QUESTS } from "../../../src/data/quests.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import { QuestsScene } from "../../../src/ui/scenes/QuestsScene.ts";

describe("QuestsScene: quests repetíveis", () => {
  it("aparecem como Repetível; concluir seleciona a nova do mesmo vendedor", () => {
    const player = createNewPlayer(new ManualClock());
    const ctx = withRepeatables(player, {
      quests: QUESTS,
      traders: TRADERS,
      maps: MAPS,
    });
    const scene = new QuestsScene(player, {
      ctx,
      clock: new ManualClock(),
      onBack: vi.fn(),
    });
    const def = ctx.quests.find((q) => q.repeatable)!;
    scene.select(def);
    expect(scene.descriptionText.text).toContain(" · Repetível · disponível");
    expect(scene.act()!.ok).toBe(true);
    player.quests[def.id].progress = [def.objectives[0].count];
    expect(scene.act()!.ok).toBe(true);
    expect(scene.selected).not.toBe(def);
    expect(scene.selected.repeatable).toBe(true);
    expect(scene.selected.trader).toBe(def.trader);
    expect(scene.questButtons.has(def.id)).toBe(false);
    expect(scene.questButtons.get(scene.selected.id)!.alpha).toBe(1);
    // Quest normal não leva a marca
    scene.select(QUESTS[0]);
    expect(scene.descriptionText.text).not.toContain("Repetível");
  });
});
