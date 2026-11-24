// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import type { OfflineReport } from "../../../src/core/offline.ts";
import { FLEA } from "../../../src/data/flea.ts";
import { HIDEOUT } from "../../../src/data/hideout.ts";
import { catalog } from "../../../src/data/items.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import {
  OfflineScene,
  offlineLines,
} from "../../../src/ui/scenes/OfflineScene.ts";

const DATA = { hideout: HIDEOUT, flea: FLEA, traders: TRADERS };

const report: OfflineReport = {
  awayMs: 2.5 * 3_600_000,
  constructions: [
    { module: "medstation", level: 1 },
    { module: "sumiu", level: 2 },
  ],
  productions: ["ammo-9mm", "sumiu"],
  income: 3000,
  health: 74.6,
  energy: 10,
  hydration: 0,
  fleaSold: 2,
  fleaEarned: 4500,
  fleaExpired: 1,
  scavReady: true,
  restocked: ["colonel", "sumiu"],
};

describe("resumo do tempo fora", () => {
  it("linhas de tudo que aconteceu", () => {
    expect(offlineLines(report, DATA, catalog)).toEqual([
      "Obra concluída: Enfermaria nível 1",
      "Obra concluída: sumiu nível 2",
      `Produção pronta: ${catalog.get("ammo_9mm").name} (retire no esconderijo)`,
      "Produção pronta: sumiu (retire no esconderijo)",
      "Renda da central: +3.000 ₽ para coletar",
      "PMC recuperou +75 PV, +10 energia",
      "Mercado: 2 venda(s), 4.500 ₽ para retirar",
      "Mercado: 1 anúncio(s) venceram",
      "A raid Scav está liberada",
      "Estoque reposto: Coronel Brás, sumiu",
    ]);
  });

  it("só o que aconteceu", () => {
    const quiet: OfflineReport = {
      ...report,
      constructions: [],
      productions: [],
      income: 0,
      health: 0,
      energy: 0,
      hydration: 5,
      fleaSold: 0,
      fleaExpired: 0,
      scavReady: false,
      restocked: [],
    };
    expect(offlineLines(quiet, DATA, catalog)).toEqual([
      "PMC recuperou +5 hidratação",
    ]);
  });

  it("tela: título com a duração, lista e continuar", () => {
    const onContinue = vi.fn();
    const scene = new OfflineScene(report, DATA, catalog, onContinue);
    expect(scene.title.text).toBe("Enquanto você estava fora (2h 30min)");
    expect(scene.body.text.split("\n")[0]).toBe(
      "• Obra concluída: Enfermaria nível 1",
    );
    scene.continueButton.emit("pointertap", {} as never);
    expect(onContinue).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
  });
});
