import { Container, Text } from "pixi.js";

import type { Clock } from "../../core/clock.ts";
import type { Catalog } from "../../core/inventory/item.ts";
import {
  MAX_LOADOUTS,
  applyLoadout,
  deleteLoadout,
  estimateMissing,
  missingItems,
  quickEquip,
  replaceLoadout,
  requiredItems,
  saveLoadout,
} from "../../core/loadout/loadout.ts";
import type {
  ApplyReport,
  Loadout,
  LoadoutItem,
  ShopContext,
} from "../../core/loadout/types.ts";
import type { PlayerState } from "../../core/state.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";
import { ERROR_COLOR, OK_COLOR, formatMoney } from "./TradersScene.ts";

const WIDTH = 940;
const RIGHT = 230;
const ACTIONS_Y = 440;
const CONTENT_HEIGHT = ACTIONS_Y + 80;

const style = (extra: object = {}) => ({
  fill: theme.text,
  fontFamily: theme.fontFamily,
  fontSize: 13,
  ...extra,
});

const itemName = (id: string, catalog: Catalog) =>
  catalog.has(id) ? catalog.get(id).name : id;

/** Lista de itens em texto: `Parafusos x2, Atadura` */
export function describeList(items: readonly LoadoutItem[], catalog: Catalog) {
  return items
    .map(({ item, count }) => {
      const name = itemName(item, catalog);
      return count > 1 ? `${name} x${count}` : name;
    })
    .join(", ");
}

/** Uma linha por item pedido, dizendo se o jogador tem ou quanto falta */
export function describeLoadoutItems(
  player: PlayerState,
  loadout: Loadout,
): string[] {
  const { catalog } = player.factory;
  const missing = new Map(
    missingItems(player, loadout).map((m) => [m.item, m.count]),
  );
  return requiredItems(loadout).map(({ item, count }) => {
    const name = itemName(item, catalog);
    const label = count > 1 ? `${name} x${count}` : name;
    const lack = missing.get(item);
    return `${label} — ${lack ? `falta ${lack}` : "tem"}`;
  });
}

/** Mensagem depois de montar o loadout: ok ou o que faltou */
export function describeApply(
  report: ApplyReport,
  catalog: Catalog,
): { text: string; ok: boolean } {
  const problems: string[] = [];
  if (report.missing.length > 0) {
    problems.push(`faltou ${describeList(report.missing, catalog)}`);
  }
  if (report.noSpace.length > 0) {
    problems.push(`sem espaço para ${describeList(report.noSpace, catalog)}`);
  }
  if (problems.length === 0) return { text: "Equipamento montado", ok: true };
  return { text: `Montado em parte: ${problems.join("; ")}`, ok: false };
}

/** Primeiro nome livre: `Loadout 1`, `Loadout 2`... */
export function nextLoadoutName(loadouts: readonly Loadout[]): string {
  let n = 1;
  while (loadouts.some((l) => l.name === `Loadout ${n}`)) n++;
  return `Loadout ${n}`;
}

/**
 * Loadouts: guarda o equipamento atual, mostra o que falta de cada modelo e
 * monta o equipamento com um clique (com ou sem comprar o que falta).
 */
export class LoadoutScene implements Scene {
  readonly view = new Container({ label: "LoadoutScene" });
  readonly content = new Container({ label: "content" });
  readonly backButton: Button;
  readonly saveButton: Button;
  readonly list = new Container({ label: "list" });
  listButtons: Button[] = [];
  readonly nameText: Text;
  readonly itemsText: Text;
  readonly costText: Text;
  readonly equipButton: Button;
  readonly quickButton: Button;
  readonly replaceButton: Button;
  readonly deleteButton: Button;
  readonly messageText: Text;
  selected = 0;

  constructor(
    readonly player: PlayerState,
    readonly options: {
      shop: ShopContext;
      clock: Clock;
      onBack: () => void;
    },
  ) {
    const title = new Text({
      text: "Loadouts",
      style: style({ fill: theme.accent, fontSize: 24, fontWeight: "bold" }),
    });
    this.backButton = new Button("Voltar", options.onBack, 120);
    this.backButton.position.set(WIDTH - 120, 2);
    this.list.position.set(0, 50);
    this.saveButton = new Button(
      "Salvar o atual",
      () => this.saveCurrent(),
      200,
      34,
    );
    this.saveButton.position.set(0, 50 + MAX_LOADOUTS * 44 + 10);
    this.nameText = new Text({
      text: "",
      position: { x: RIGHT, y: 48 },
      style: style({ fill: theme.accent, fontSize: 20, fontWeight: "bold" }),
    });
    this.itemsText = new Text({
      text: "",
      position: { x: RIGHT, y: 82 },
      style: style({ lineHeight: 18 }),
    });
    this.costText = new Text({
      text: "",
      position: { x: RIGHT, y: ACTIONS_Y - 30 },
      style: style({ fill: theme.textMuted }),
    });
    const action = (label: string, run: () => void, i: number, w = 150) => {
      const button = new Button(label, run, w, 32);
      button.position.set(RIGHT + i * 170, ACTIONS_Y);
      return button;
    };
    this.equipButton = action("Equipar", () => this.equip(), 0);
    this.quickButton = action("Comprar e equipar", () => this.quick(), 1);
    this.replaceButton = action("Trocar pelo atual", () => this.replace(), 2);
    this.deleteButton = action("Excluir", () => this.remove(), 3);
    this.messageText = new Text({
      text: "",
      position: { x: RIGHT, y: ACTIONS_Y + 44 },
      style: style({ wordWrap: true, wordWrapWidth: WIDTH - RIGHT }),
    });
    this.content.addChild(
      title,
      this.backButton,
      this.list,
      this.saveButton,
      this.nameText,
      this.itemsText,
      this.costText,
      this.equipButton,
      this.quickButton,
      this.replaceButton,
      this.deleteButton,
      this.messageText,
    );
    this.view.addChild(this.content);
    this.refresh();
  }

  get loadout(): Loadout | null {
    return this.player.loadouts[this.selected] ?? null;
  }

  get catalog(): Catalog {
    return this.player.factory.catalog;
  }

  select(index: number): void {
    this.selected = index;
    this.messageText.text = "";
    this.refresh();
  }

  private show(text: string, ok: boolean): void {
    this.messageText.text = text;
    this.messageText.style.fill = ok ? OK_COLOR : ERROR_COLOR;
    this.refresh();
  }

  saveCurrent(): void {
    const name = nextLoadoutName(this.player.loadouts);
    if (!saveLoadout(this.player, name)) {
      this.show(`Máximo de ${MAX_LOADOUTS} loadouts`, false);
      return;
    }
    this.selected = this.player.loadouts.length - 1;
    this.show(`${name} salvo`, true);
  }

  equip(): void {
    if (!this.loadout) return;
    const result = describeApply(
      applyLoadout(this.player, this.loadout),
      this.catalog,
    );
    this.show(result.text, result.ok);
  }

  quick(): void {
    if (!this.loadout) return;
    const { purchase, apply } = quickEquip(
      this.player,
      this.loadout,
      this.options.shop,
      this.options.clock.now(),
    );
    const parts: string[] = [];
    if (purchase.bought.length > 0) {
      parts.push(
        `Comprou ${describeList(purchase.bought, this.catalog)} por ${formatMoney(purchase.spent, "money_rub", this.catalog)}`,
      );
    }
    if (purchase.failed.length > 0) {
      parts.push(
        `não conseguiu comprar ${describeList(purchase.failed, this.catalog)}`,
      );
    }
    const result = describeApply(apply, this.catalog);
    parts.push(result.text);
    this.show(parts.join(". "), result.ok && purchase.failed.length === 0);
  }

  replace(): void {
    if (!this.loadout) return;
    replaceLoadout(this.player, this.selected);
    this.show(`${this.loadout.name} atualizado`, true);
  }

  remove(): void {
    if (!this.loadout) return;
    const { name } = this.loadout;
    deleteLoadout(this.player, this.selected);
    this.selected = Math.max(0, this.selected - 1);
    this.show(`${name} excluído`, true);
  }

  refresh(): void {
    for (const child of this.list.removeChildren()) child.destroy();
    this.listButtons = this.player.loadouts.map((loadout, i) => {
      const button = new Button(loadout.name, () => this.select(i), 200, 34);
      button.position.set(0, i * 44);
      button.alpha = i === this.selected ? 1 : 0.55;
      this.list.addChild(button);
      return button;
    });
    this.saveButton.alpha =
      this.player.loadouts.length < MAX_LOADOUTS ? 1 : 0.55;
    const { loadout } = this;
    for (const button of [
      this.equipButton,
      this.quickButton,
      this.replaceButton,
      this.deleteButton,
    ]) {
      button.visible = loadout !== null;
    }
    if (!loadout) {
      this.nameText.text = "Nenhum loadout";
      this.itemsText.text =
        'Monte o equipamento no inventário e clique em "Salvar o atual".';
      this.costText.text = "";
      return;
    }
    this.nameText.text = loadout.name;
    const lines = describeLoadoutItems(this.player, loadout);
    this.itemsText.text =
      lines.length > 0 ? lines.join("\n") : "Equipamento vazio";
    const { rub, unavailable } = estimateMissing(
      this.player,
      loadout,
      this.options.shop,
      this.options.clock.now(),
    );
    const cost = [
      rub > 0
        ? `Custo estimado do que falta: ${formatMoney(rub, "money_rub", this.catalog)}`
        : "",
      unavailable.length > 0
        ? `Não está à venda agora: ${describeList(
            unavailable.map((item) => ({ item, count: 1 })),
            this.catalog,
          )}`
        : "",
    ].filter(Boolean);
    this.costText.text = cost.length > 0 ? cost.join(" · ") : "Tem tudo";
  }

  resize(width: number, height: number): void {
    const h = CONTENT_HEIGHT;
    const scale = Math.min(1.5, width / (WIDTH + 64), height / (h + 64));
    this.content.scale.set(scale);
    this.content.position.set(
      (width - WIDTH * scale) / 2,
      (height - h * scale) / 2,
    );
  }
}
