import { describe, expect, it } from "vitest";

import { ManualClock } from "../../src/core/clock.ts";
import { catchUp } from "../../src/core/offline.ts";
import { FLEA } from "../../src/data/flea.ts";
import { HIDEOUT } from "../../src/data/hideout.ts";
import { createNewPlayer } from "../../src/data/newGame.ts";
import { TRADERS } from "../../src/data/traders.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DATA = { hideout: HIDEOUT, flea: FLEA, traders: TRADERS };

describe("catchUp: várias obras e combustível", () => {
  it("lista todas as obras concluídas, na ordem do fim", () => {
    const player = createNewPlayer(new ManualClock(0));
    const { hideout } = player;
    hideout.construction = { module: "stash", level: 1, endsAt: 2 * HOUR };
    hideout.extraConstructions = [
      { module: "medstation", level: 1, endsAt: HOUR },
      { module: "kitchen", level: 1, endsAt: 5 * HOUR },
    ];
    const report = catchUp(player, DATA, 3 * HOUR);
    expect(report.constructions).toEqual([
      { module: "medstation", level: 1 },
      { module: "stash", level: 1 },
    ]);
    expect(hideout.extraConstructions).toEqual([
      { module: "kitchen", level: 1, endsAt: 5 * HOUR },
    ]);
  });

  it("produção parada sem combustível não aparece como pronta", () => {
    const player = createNewPlayer(new ManualClock(0));
    const { hideout } = player;
    hideout.modules.generator = 1;
    hideout.modules.workbench = 1;
    hideout.productions = {
      workbench: { recipe: "ammo-9mm", endsAt: 20 * MIN },
    };
    expect(catchUp(player, DATA, HOUR).productions).toEqual([]);
    expect(hideout.productions.workbench.endsAt).toBe(HOUR + 20 * MIN);
    hideout.fuel = 10;
    expect(catchUp(player, DATA, 2 * HOUR).productions).toEqual(["ammo-9mm"]);
    expect(hideout.fuel).toBe(9);
  });
});
