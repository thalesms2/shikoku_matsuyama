import { Container, Text } from "pixi.js";

import type { Clock } from "../../core/clock.ts";
import {
  durabilityOf,
  maxDurability,
} from "../../core/inventory/durability.ts";
import type { Catalog, Item } from "../../core/inventory/item.ts";
import type { QuestDef } from "../../core/quests/types.ts";
import type { PlayerState } from "../../core/state.ts";
import {
  buy,
  countInStash,
  damagedItems,
  loyaltyLevel,
  nextLevel,
  offerPrice,
  questUnlocked,
  repair,
  repairCost,
  restock,
  sell,
  sellPrice,
  stockLeft,
  traderState,
} from "../../core/trade/trade.ts";
import type {
  LoyaltyLevel,
  TradeResult,
  TraderDef,
  TraderOffer,
  TraderState,
} from "../../core/trade/types.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";
import { formatCountdown } from "./RaidSetupScene.ts";

const WIDTH = 940;
const RIGHT = 230;
const ROWS_TOP = 262;
const ROW_HEIGHT = 32;
export const ROWS_PER_PAGE = 10;
const CONTENT_HEIGHT = ROWS_TOP + ROWS_PER_PAGE * ROW_HEIGHT + 50;
export const OK_COLOR = 0x6abf4b;
export const ERROR_COLOR = 0xd9534f;

const style = (extra: object = {}) => ({
  fill: theme.text,
  fontFamily: theme.fontFamily,
  fontSize: 13,
  ...extra,
});

/** Quantia com separador de milhar e o símbolo da moeda: `1.500 $` */
export function formatMoney(
  amount: number,
  currency: string,
  catalog: Catalog,
): string {
  const digits = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${digits} ${catalog.get(currency).shortName}`;
}

/** Lealdade atual, o que falta para o próximo nível e a reposição */
export function describeLoyalty(
  def: TraderDef,
  state: TraderState,
  level: LoyaltyLevel,
  catalog: Catalog,
  now: number,
): string {
  const lines = [
    def.description,
    "",
    `Lealdade: nível ${level.level}/${def.levels.length} · Reputação ${state.reputation.toFixed(2)} · Negociado ${formatMoney(state.volume, "money_rub", catalog)}`,
  ];
  const next = nextLevel(def, level);
  lines.push(
    next
      ? `Próximo nível: PMC nível ${next.minPmcLevel}, reputação ${next.minReputation.toFixed(2)}, ${formatMoney(next.minVolume, "money_rub", catalog)} negociados`
      : "Lealdade máxima",
  );
  lines.push(
    `Reposição do estoque em ${formatCountdown(state.restockAt - now)}`,
  );
  return lines.join("\n");
}

/**
 * Linha de uma oferta e se está bloqueada. `questLock`: nome da quest que
 * falta concluir para liberar a oferta.
 */
export function describeOffer(
  def: TraderDef,
  offer: TraderOffer,
  state: TraderState,
  level: LoyaltyLevel,
  catalog: Catalog,
  questLock?: string,
): { label: string; locked: boolean } {
  const item = catalog.get(offer.item);
  const count = offer.count ?? 1;
  const name = count > 1 ? `${item.name} x${count}` : item.name;
  const price = offerPrice(def, offer, level, catalog);
  const cost = price
    ? formatMoney(price.amount, price.currency, catalog)
    : `troca: ${offer
        .barter!.map((c) => {
          const n = catalog.get(c.item).name;
          return c.count > 1 ? `${n} x${c.count}` : n;
        })
        .join(" + ")}`;
  const levelLocked = level.level < offer.level;
  const status = levelLocked
    ? `exige nível ${offer.level}`
    : questLock
      ? `exige a quest "${questLock}"`
      : `estoque ${stockLeft(offer, state)}/${offer.stock}`;
  const locked = levelLocked || questLock !== undefined;
  return { label: `${name} — ${cost} — ${status}`, locked };
}

/** Linha de um item do estoque na aba de venda */
export function describeSale(
  item: Item,
  price: TradeResult,
  currency: string,
  catalog: Catalog,
): string {
  const name =
    item.count > 1 ? `${item.def.name} x${item.count}` : item.def.name;
  return `${name} — ${price.ok ? formatMoney(price.amount, currency, catalog) : price.reason}`;
}

/** Linha de um item gasto na aba de conserto */
export function describeRepair(
  item: Item,
  cost: TradeResult,
  currency: string,
  catalog: Catalog,
): string {
  const durability = `${Math.ceil(durabilityOf(item))}/${maxDurability(item.def)}`;
  return `${item.def.name} — ${durability} — ${cost.ok ? formatMoney(cost.amount, currency, catalog) : cost.reason}`;
}

type Tab = "buy" | "sell" | "repair";

/**
 * Vendedores: escolhe o vendedor, compra ofertas (dinheiro ou troca) e
 * vende itens do estoque. Mostra lealdade, dinheiro e reposição.
 */
export class TradersScene implements Scene {
  readonly view = new Container({ label: "TradersScene" });
  readonly content = new Container({ label: "content" });
  readonly backButton: Button;
  readonly traderButtons = new Map<string, Button>();
  readonly nameText: Text;
  readonly infoText: Text;
  readonly moneyText: Text;
  readonly buyTab: Button;
  readonly sellTab: Button;
  /** Só aparece nos vendedores que consertam */
  readonly repairTab: Button;
  readonly rows = new Container({ label: "rows" });
  /** Botões de ação das linhas visíveis (comprar/vender) */
  rowButtons: Button[] = [];
  readonly prevButton: Button;
  readonly nextButton: Button;
  readonly pageText: Text;
  readonly messageText: Text;
  trader: TraderDef;
  tab: Tab = "buy";
  page = 0;

  constructor(
    readonly player: PlayerState,
    readonly options: {
      traders: readonly TraderDef[];
      clock: Clock;
      /** Para mostrar o nome da quest que libera uma oferta */
      quests?: readonly QuestDef[];
      onBack: () => void;
    },
  ) {
    this.trader = options.traders[0];
    const title = new Text({
      text: "Vendedores",
      style: style({ fill: theme.accent, fontSize: 24, fontWeight: "bold" }),
    });
    this.backButton = new Button("Voltar ao inventário", options.onBack, 180);
    this.backButton.position.set(WIDTH - 180, 2);
    this.content.addChild(title, this.backButton);

    options.traders.forEach((def, i) => {
      const button = new Button(
        def.name,
        () => this.selectTrader(def),
        200,
        34,
      );
      button.position.set(0, 50 + i * 44);
      this.traderButtons.set(def.id, button);
      this.content.addChild(button);
    });

    this.nameText = new Text({
      text: "",
      position: { x: RIGHT, y: 48 },
      style: style({ fill: theme.accent, fontSize: 20, fontWeight: "bold" }),
    });
    this.infoText = new Text({
      text: "",
      position: { x: RIGHT, y: 78 },
      style: style({
        lineHeight: 18,
        wordWrap: true,
        wordWrapWidth: WIDTH - RIGHT,
      }),
    });
    this.moneyText = new Text({
      text: "",
      position: { x: RIGHT, y: 196 },
      style: style({ fill: theme.textMuted }),
    });
    this.buyTab = new Button("Comprar", () => this.selectTab("buy"), 110);
    this.buyTab.position.set(RIGHT, 222);
    this.sellTab = new Button("Vender", () => this.selectTab("sell"), 110);
    this.sellTab.position.set(RIGHT + 120, 222);
    this.repairTab = new Button(
      "Consertar",
      () => this.selectTab("repair"),
      110,
    );
    this.repairTab.position.set(RIGHT + 240, 222);
    this.rows.position.set(RIGHT, ROWS_TOP);
    const pagerY = ROWS_TOP + ROWS_PER_PAGE * ROW_HEIGHT + 8;
    this.prevButton = new Button("<", () => this.changePage(-1), 36);
    this.prevButton.position.set(WIDTH - 130, pagerY);
    this.nextButton = new Button(">", () => this.changePage(1), 36);
    this.nextButton.position.set(WIDTH - 36, pagerY);
    this.pageText = new Text({
      text: "",
      anchor: { x: 0.5, y: 0 },
      position: { x: WIDTH - 65, y: pagerY + 6 },
      style: style({ fill: theme.textMuted }),
    });
    this.messageText = new Text({
      text: "",
      position: { x: RIGHT, y: pagerY + 6 },
      style: style(),
    });
    this.content.addChild(
      this.nameText,
      this.infoText,
      this.moneyText,
      this.buyTab,
      this.sellTab,
      this.repairTab,
      this.rows,
      this.prevButton,
      this.nextButton,
      this.pageText,
      this.messageText,
    );
    this.view.addChild(this.content);
    this.refresh();
  }

  get catalog(): Catalog {
    return this.player.factory.catalog;
  }

  get state(): TraderState {
    return traderState(
      this.player.traders,
      this.trader,
      this.options.clock.now(),
    );
  }

  get level(): LoyaltyLevel {
    return loyaltyLevel(this.trader, this.state, this.player.pmc.xp);
  }

  selectTrader(def: TraderDef): void {
    this.trader = def;
    if (this.tab === "repair" && def.repairRate === undefined) this.tab = "buy";
    this.page = 0;
    this.messageText.text = "";
    this.refresh();
  }

  selectTab(tab: Tab): void {
    this.tab = tab;
    this.page = 0;
    this.messageText.text = "";
    this.refresh();
  }

  changePage(delta: number): void {
    const pages = this.pageCount();
    this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
    this.refresh();
  }

  /** Itens do estoque (fora dinheiro) das categorias que o vendedor compra */
  saleItems(): Item[] {
    return this.player.inventory.stash
      .items()
      .filter(
        (i) =>
          i.def.category !== "money" &&
          this.trader.buys[i.def.category] !== undefined,
      );
  }

  pageCount(): number {
    const total = this.entries().length;
    return Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  }

  buyOffer(offer: TraderOffer): TradeResult {
    const result = buy(
      this.player,
      this.trader,
      offer.id,
      this.options.clock.now(),
    );
    const item = this.catalog.get(offer.item).name;
    this.showResult(result, result.ok ? `Comprou ${item}` : "");
    return result;
  }

  repairItem(item: Item): TradeResult {
    const result = repair(
      this.player,
      this.trader,
      item,
      this.options.clock.now(),
    );
    this.showResult(
      result,
      result.ok
        ? `Consertou ${item.def.name} por ${formatMoney(result.amount, this.trader.currency, this.catalog)}`
        : "",
    );
    return result;
  }

  sellItem(item: Item): TradeResult {
    const result = sell(
      this.player,
      this.trader,
      item,
      this.options.clock.now(),
    );
    this.showResult(
      result,
      result.ok
        ? `Vendeu ${item.def.name} por ${formatMoney(result.amount, this.trader.currency, this.catalog)}`
        : "",
    );
    return result;
  }

  private showResult(result: TradeResult, okText: string): void {
    this.messageText.text = result.ok ? okText : result.reason;
    this.messageText.style.fill = result.ok ? OK_COLOR : ERROR_COLOR;
    this.page = Math.min(this.page, this.pageCount() - 1);
    this.refresh();
  }

  /** Textos que mudam com o tempo; repõe o estoque quando passa da hora */
  refreshInfo(): boolean {
    const now = this.options.clock.now();
    const restocked = restock(this.trader, this.state, now);
    const text = describeLoyalty(
      this.trader,
      this.state,
      this.level,
      this.catalog,
      now,
    );
    if (this.infoText.text !== text) this.infoText.text = text;
    return restocked;
  }

  update(): void {
    if (this.refreshInfo()) this.refreshRows();
  }

  refresh(): void {
    for (const [id, button] of this.traderButtons) {
      button.alpha = id === this.trader.id ? 1 : 0.55;
    }
    this.buyTab.alpha = this.tab === "buy" ? 1 : 0.55;
    this.sellTab.alpha = this.tab === "sell" ? 1 : 0.55;
    this.repairTab.alpha = this.tab === "repair" ? 1 : 0.55;
    this.repairTab.visible = this.trader.repairRate !== undefined;
    this.nameText.text = `${this.trader.name} · ${this.trader.specialty}`;
    this.refreshInfo();
    this.refreshRows();
  }

  refreshRows(): void {
    const { stash } = this.player.inventory;
    const currencies = [
      ...new Set(
        this.options.traders.flatMap((t) => [
          t.currency,
          ...t.offers.flatMap((o) => o.currency ?? []),
          // moedas vendidas (câmbio)
          ...t.offers
            .map((o) => o.item)
            .filter((id) => this.catalog.get(id).category === "money"),
        ]),
      ),
      // rublos primeiro, depois em ordem de id
    ].sort(
      (a, b) =>
        Number(b === "money_rub") - Number(a === "money_rub") ||
        a.localeCompare(b),
    );
    this.moneyText.text = `Seu dinheiro: ${currencies
      .map((c) => formatMoney(countInStash(stash, c), c, this.catalog))
      .join(" · ")}`;

    for (const child of this.rows.removeChildren()) child.destroy();
    this.rowButtons = [];
    const start = this.page * ROWS_PER_PAGE;
    const entries = this.entries();
    entries.slice(start, start + ROWS_PER_PAGE).forEach((entry, i) => {
      const y = i * ROW_HEIGHT;
      const label = new Text({
        text: entry.label,
        position: { x: 0, y: y + 6 },
        style: style({ fill: entry.enabled ? theme.text : theme.textMuted }),
      });
      const button = new Button(entry.action, entry.run, 90, 26);
      button.position.set(WIDTH - RIGHT - 90, y);
      button.alpha = entry.enabled ? 1 : 0.55;
      this.rows.addChild(label, button);
      this.rowButtons.push(button);
    });
    const pages = this.pageCount();
    this.pageText.text = `${this.page + 1}/${pages}`;
    this.prevButton.visible = this.nextButton.visible = pages > 1;
    this.pageText.visible = pages > 1;
  }

  private entries() {
    if (this.tab === "buy") return this.buyRows();
    if (this.tab === "sell") return this.sellRows();
    return this.repairRows();
  }

  private repairRows() {
    return damagedItems(this.player).map((item) => {
      const cost = repairCost(this.trader, item, this.catalog);
      return {
        label: describeRepair(item, cost, this.trader.currency, this.catalog),
        enabled: cost.ok,
        action: "Consertar",
        run: () => {
          this.repairItem(item);
        },
      };
    });
  }

  private buyRows() {
    const { state, level } = this;
    return this.trader.offers.map((offer) => {
      const questLock = questUnlocked(this.player, offer)
        ? undefined
        : (this.options.quests?.find((q) => q.id === offer.quest)?.name ??
          offer.quest);
      const { label, locked } = describeOffer(
        this.trader,
        offer,
        state,
        level,
        this.catalog,
        questLock,
      );
      return {
        label,
        enabled: !locked && stockLeft(offer, state) > 0,
        action: offer.barter ? "Trocar" : "Comprar",
        run: () => {
          this.buyOffer(offer);
        },
      };
    });
  }

  private sellRows() {
    const { level } = this;
    return this.saleItems().map((item) => {
      const price = sellPrice(this.trader, item, level, this.catalog);
      return {
        label: describeSale(item, price, this.trader.currency, this.catalog),
        enabled: price.ok,
        action: "Vender",
        run: () => {
          this.sellItem(item);
        },
      };
    });
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
