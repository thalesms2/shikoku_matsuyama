import { Container, Text } from "pixi.js";

import type { Catalog } from "../../core/inventory/item.ts";
import type { OfflineData, OfflineReport } from "../../core/offline.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";
import { formatDuration } from "./HideoutScene.ts";
import { formatMoney } from "./TradersScene.ts";

const WIDTH = 640;
const HEIGHT = 400;

/** Linhas do resumo, na ordem em que aparecem */
export function offlineLines(
  report: OfflineReport,
  data: OfflineData,
  catalog: Catalog,
): string[] {
  const lines: string[] = [];
  const rub = (n: number) => formatMoney(n, data.flea.currency, catalog);
  for (const { module, level } of report.constructions) {
    const name = data.hideout.modules.find((m) => m.id === module)?.name;
    lines.push(`Obra concluída: ${name ?? module} nível ${level}`);
  }
  for (const id of report.productions) {
    const recipe = data.hideout.recipes.find((r) => r.id === id);
    const name = recipe ? catalog.get(recipe.output.item).name : id;
    lines.push(`Produção pronta: ${name} (retire no esconderijo)`);
  }
  if (report.income > 0) {
    lines.push(`Renda da central: +${rub(report.income)} para coletar`);
  }
  const pmc = [
    report.health > 0 ? `+${Math.round(report.health)} PV` : "",
    report.energy > 0 ? `+${Math.round(report.energy)} energia` : "",
    report.hydration > 0 ? `+${Math.round(report.hydration)} hidratação` : "",
  ].filter(Boolean);
  if (pmc.length > 0) lines.push(`PMC recuperou ${pmc.join(", ")}`);
  if (report.fleaSold > 0) {
    lines.push(
      `Mercado: ${report.fleaSold} venda(s), ${rub(report.fleaEarned)} para retirar`,
    );
  }
  if (report.fleaExpired > 0) {
    lines.push(`Mercado: ${report.fleaExpired} anúncio(s) venceram`);
  }
  if (report.scavReady) lines.push("A raid Scav está liberada");
  if (report.restocked.length > 0) {
    const names = report.restocked.map(
      (id) => data.traders.find((t) => t.id === id)?.name ?? id,
    );
    lines.push(`Estoque reposto: ${names.join(", ")}`);
  }
  return lines;
}

/** "Enquanto você estava fora": o que aconteceu com o jogo fechado */
export class OfflineScene implements Scene {
  readonly view = new Container({ label: "OfflineScene" });
  readonly content = new Container({ label: "content" });
  readonly title: Text;
  readonly body: Text;
  readonly continueButton: Button;

  constructor(
    report: OfflineReport,
    data: OfflineData,
    catalog: Catalog,
    onContinue: () => void,
  ) {
    this.title = new Text({
      text: `Enquanto você estava fora (${formatDuration(report.awayMs)})`,
      style: {
        fill: theme.accent,
        fontFamily: theme.fontFamily,
        fontSize: 26,
        fontWeight: "bold",
      },
    });
    this.body = new Text({
      text: offlineLines(report, data, catalog)
        .map((l) => `• ${l}`)
        .join("\n"),
      position: { x: 0, y: 56 },
      style: {
        fill: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: 15,
        lineHeight: 24,
        wordWrap: true,
        wordWrapWidth: WIDTH,
      },
    });
    this.continueButton = new Button("Continuar", onContinue, 160, 36);
    this.continueButton.position.set(WIDTH - 160, HEIGHT - 36);
    this.content.addChild(this.title, this.body, this.continueButton);
    this.view.addChild(this.content);
  }

  resize(width: number, height: number): void {
    const scale = Math.min(1.5, width / (WIDTH + 64), height / (HEIGHT + 64));
    this.content.scale.set(scale);
    this.content.position.set(
      (width - WIDTH * scale) / 2,
      (height - HEIGHT * scale) / 2,
    );
  }
}
