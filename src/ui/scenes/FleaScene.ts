import { Container, Text } from "pixi.js";

import type { Clock } from "../../core/clock.ts";
import {
  buyPrice,
  cancelListing,
  collectResult,
  expectedSaleMs,
  fleaBuy,
  fleaUnlocked,
  listItem,
  listingFee,
  listingValue,
  lotSize,
  marketDefs,
  priceTrend,
} from "../../core/flea/flea.ts";
import type {
  FleaConfig,
  FleaListing,
  FleaResult,
  FleaState,
} from "../../core/flea/types.ts";
import type { Catalog, Item, ItemDef } from "../../core/inventory/item.ts";
import { levelForXp } from "../../core/pmc/pmc.ts";
import type { PlayerState } from "../../core/state.ts";
import { countInStash } from "../../core/trade/trade.ts";
import type { TradeResult } from "../../core/trade/types.ts";
import { Button } from "../components/Button.ts";
import type { Scene } from "../SceneManager.ts";
import { theme } from "../theme.ts";
import { formatDuration } from "./HideoutScene.ts";
import { ERROR_COLOR, OK_COLOR, formatMoney } from "./TradersScene.ts";

const WIDTH = 940;
const TABS_Y = 124;
const ROWS_TOP = 166;
const ROW_HEIGHT = 32;
export const FLEA_ROWS_PER_PAGE = 10;
const PAGER_Y = ROWS_TOP + FLEA_ROWS_PER_PAGE * ROW_HEIGHT + 8;
const CONTENT_HEIGHT = PAGER_Y + 50;
/** Intervalo de atualização (vendas, contagens, preços) */
export const FLEA_REFRESH_MS = 500;
/** Passo do preço pedido, em fração do valor de mercado */
export const RATIO_STEP = 0.05;
export const MIN_RATIO = 0.5;

const style = (extra: object = {}) => ({
  fill: theme.text,
  fontFamily: theme.fontFamily,
  fontSize: 13,
  ...extra,
});

const named = (name: string, count: number) =>
  count > 1 ? `${name} x${count}` : name;

const ARROWS: Record<number, string> = { [-1]: "▼", 0: "=", 1: "▲" };

/** Linha da aba Comprar: pilha, preço e a tendência da última hora */
export function describeMarketRow(
  def: ItemDef,
  price: number,
  trend: number,
  config: FleaConfig,
  catalog: Catalog,
): string {
  return `${named(def.name, lotSize(def))} — ${formatMoney(price, config.currency, catalog)} ${ARROWS[trend]}`;
}

/**
 * Linha da aba Vender: valor de mercado, preço pedido (`ratio` × valor),
 * taxa e o tempo médio até vender; ou o motivo de não poder anunciar.
 */
export function describeListingRow(
  item: Item,
  value: TradeResult,
  ratio: number,
  config: FleaConfig,
  catalog: Catalog,
): { label: string; price: number } {
  const name = named(item.def.name, item.count);
  if (!value.ok) return { label: `${name} — ${value.reason}`, price: 0 };
  const price = Math.max(1, Math.round(value.amount * ratio));
  const money = (n: number) => formatMoney(n, config.currency, catalog);
  const eta = expectedSaleMs(config, price / value.amount);
  const sale = Number.isFinite(eta)
    ? `vende em ~${formatDuration(eta)}`
    : "não vende";
  const fee = listingFee(config, value.amount, price);
  return {
    label: `${name} — mercado ${money(value.amount)} · pedir ${money(price)} · taxa ${money(fee)} · ${sale}`,
    price,
  };
}

/** Linha de um anúncio ativo */
export function describeListed(
  listing: FleaListing,
  config: FleaConfig,
  catalog: Catalog,
  now: number,
): string {
  const { item } = listing;
  return `${named(item.def.name, item.count)} — ${formatMoney(listing.price, config.currency, catalog)} · vence em ${formatDuration(listing.expiresAt - now)}`;
}

/** Linha de um resultado esperando a retirada */
export function describeResult(
  result: FleaResult,
  config: FleaConfig,
  catalog: Catalog,
): string {
  if (result.kind === "sold") {
    const name = catalog.has(result.def)
      ? catalog.get(result.def).name
      : result.def;
    return `Vendido: ${named(name, result.count)} por ${formatMoney(result.price, config.currency, catalog)}`;
  }
  const { item } = result;
  return `Venceu: ${named(item.def.name, item.count)} (volta ao estoque)`;
}

/** Situação do mercado: bloqueio ou anúncios e estatísticas */
export function describeFleaStatus(
  flea: FleaState,
  config: FleaConfig,
  pmcLevel: number,
  catalog: Catalog,
): string {
  if (pmcLevel < config.minPmcLevel) {
    return `O mercado libera no nível ${config.minPmcLevel} do PMC (você está no nível ${pmcLevel}).`;
  }
  const money = (n: number) => formatMoney(n, config.currency, catalog);
  const { stats } = flea;
  return [
    `Anúncios: ${flea.listings.length}/${config.slots} · Vendidos: ${stats.sold} (${money(stats.earned)}) · Taxas pagas: ${money(stats.fees)} · Compras: ${stats.bought} (${money(stats.spent)})`,
    "Itens comprados aqui não contam como encontrados na raid. Permutas e chaves só podem ser anunciadas se encontradas na raid.",
  ].join("\n");
}

type Tab = "buy" | "sell" | "listings";

interface Row {
  label: string;
  enabled: boolean;
  action: string;
  run: () => void;
}

/**
 * Mercado: compra pilhas de outros jogadores pelo preço do momento, anuncia
 * itens do estoque com o preço escolhido e retira vendas e itens vencidos.
 */
export class FleaScene implements Scene {
  readonly view = new Container({ label: "FleaScene" });
  readonly content = new Container({ label: "content" });
  readonly backButton: Button;
  readonly infoText: Text;
  readonly moneyText: Text;
  readonly buyTab: Button;
  readonly sellTab: Button;
  readonly listingsTab: Button;
  readonly lessButton: Button;
  readonly moreButton: Button;
  readonly ratioText: Text;
  readonly rows = new Container({ label: "rows" });
  rowButtons: Button[] = [];
  readonly prevButton: Button;
  readonly nextButton: Button;
  readonly pageText: Text;
  readonly messageText: Text;
  tab: Tab = "buy";
  page = 0;
  /** Preço pedido nos anúncios, em fração do valor de mercado */
  ratio = 1;
  private elapsed = 0;

  constructor(
    readonly player: PlayerState,
    readonly options: {
      config: FleaConfig;
      clock: Clock;
      onBack: () => void;
    },
  ) {
    const title = new Text({
      text: "Mercado",
      style: style({ fill: theme.accent, fontSize: 24, fontWeight: "bold" }),
    });
    this.backButton = new Button("Voltar ao inventário", options.onBack, 180);
    this.backButton.position.set(WIDTH - 180, 2);
    this.infoText = new Text({
      text: "",
      position: { x: 0, y: 48 },
      style: style({ lineHeight: 18, wordWrap: true, wordWrapWidth: WIDTH }),
    });
    this.moneyText = new Text({
      text: "",
      position: { x: 0, y: 96 },
      style: style({ fill: theme.textMuted }),
    });
    this.buyTab = new Button("Comprar", () => this.selectTab("buy"), 110);
    this.sellTab = new Button("Vender", () => this.selectTab("sell"), 110);
    this.listingsTab = new Button(
      "Anúncios",
      () => this.selectTab("listings"),
      110,
    );
    [this.buyTab, this.sellTab, this.listingsTab].forEach((tab, i) =>
      tab.position.set(i * 120, TABS_Y),
    );
    this.lessButton = new Button("−", () => this.changeRatio(-1), 36);
    this.lessButton.position.set(WIDTH - 260, TABS_Y);
    this.ratioText = new Text({
      text: "",
      anchor: { x: 0.5, y: 0 },
      position: { x: WIDTH - 130, y: TABS_Y + 6 },
      style: style(),
    });
    this.moreButton = new Button("+", () => this.changeRatio(1), 36);
    this.moreButton.position.set(WIDTH - 36, TABS_Y);
    this.rows.position.set(0, ROWS_TOP);
    this.prevButton = new Button("<", () => this.changePage(-1), 36);
    this.prevButton.position.set(WIDTH - 130, PAGER_Y);
    this.nextButton = new Button(">", () => this.changePage(1), 36);
    this.nextButton.position.set(WIDTH - 36, PAGER_Y);
    this.pageText = new Text({
      text: "",
      anchor: { x: 0.5, y: 0 },
      position: { x: WIDTH - 65, y: PAGER_Y + 6 },
      style: style({ fill: theme.textMuted }),
    });
    this.messageText = new Text({
      text: "",
      position: { x: 0, y: PAGER_Y + 6 },
      style: style(),
    });
    this.content.addChild(
      title,
      this.backButton,
      this.infoText,
      this.moneyText,
      this.buyTab,
      this.sellTab,
      this.listingsTab,
      this.lessButton,
      this.ratioText,
      this.moreButton,
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

  get config(): FleaConfig {
    return this.options.config;
  }

  get now(): number {
    return this.options.clock.now();
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

  /** Muda o preço pedido em passos de 5%, entre 50% e a razão máxima */
  changeRatio(steps: number): void {
    const next = Math.round((this.ratio + steps * RATIO_STEP) * 100) / 100;
    this.ratio = Math.min(this.config.maxRatio, Math.max(MIN_RATIO, next));
    this.refresh();
  }

  /** Itens do topo do estoque que podem aparecer na aba Vender */
  saleItems(): Item[] {
    return this.player.inventory.stash
      .items()
      .filter((i) => i.def.category !== "money");
  }

  rowsFor(tab: Tab): Row[] {
    if (tab === "buy") return this.buyRows();
    if (tab === "sell") return this.sellRows();
    return this.listingRows();
  }

  pageCount(): number {
    const total = this.rowsFor(this.tab).length;
    return Math.max(1, Math.ceil(total / FLEA_ROWS_PER_PAGE));
  }

  private showResult(result: TradeResult, okText: string): void {
    this.messageText.text = result.ok ? okText : result.reason;
    this.messageText.style.fill = result.ok ? OK_COLOR : ERROR_COLOR;
    this.page = Math.min(this.page, this.pageCount() - 1);
    this.refresh();
  }

  buyItem(def: ItemDef): TradeResult {
    const result = fleaBuy(this.player, this.config, def.id, this.now);
    this.showResult(result, `Comprou ${named(def.name, lotSize(def))}`);
    return result;
  }

  listForSale(item: Item, price: number): TradeResult {
    const result = listItem(this.player, this.config, item, price, this.now);
    this.showResult(
      result,
      result.ok
        ? `Anunciou ${item.def.name}; taxa de ${formatMoney(result.amount, this.config.currency, this.catalog)}`
        : "",
    );
    return result;
  }

  cancel(listing: FleaListing): TradeResult {
    const result = cancelListing(this.player, listing.id);
    this.showResult(result, "Anúncio cancelado; o item voltou ao estoque");
    return result;
  }

  collect(result: FleaResult): TradeResult {
    const done = collectResult(this.player, this.config, result.id);
    this.showResult(done, "Guardado no estoque");
    return done;
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    if (this.elapsed < FLEA_REFRESH_MS) return;
    this.elapsed = 0;
    this.refresh();
  }

  refresh(): void {
    const { flea } = this.player;
    for (const [tab, button] of [
      ["buy", this.buyTab],
      ["sell", this.sellTab],
      ["listings", this.listingsTab],
    ] as const) {
      button.alpha = this.tab === tab ? 1 : 0.55;
    }
    const waiting = flea.listings.length + flea.results.length;
    this.listingsTab.text.text =
      waiting > 0 ? `Anúncios (${waiting})` : "Anúncios";
    this.infoText.text = describeFleaStatus(
      flea,
      this.config,
      levelForXp(this.player.pmc.xp),
      this.catalog,
    );
    const { currency } = this.config;
    this.moneyText.text = `Seu dinheiro: ${formatMoney(countInStash(this.player.inventory.stash, currency), currency, this.catalog)}`;
    const selling = this.tab === "sell";
    this.lessButton.visible = this.moreButton.visible = selling;
    this.ratioText.visible = selling;
    this.ratioText.text = `Pedir ${Math.round(this.ratio * 100)}% do mercado`;
    this.refreshRows();
  }

  private refreshRows(): void {
    for (const child of this.rows.removeChildren()) child.destroy();
    this.rowButtons = [];
    const unlocked = fleaUnlocked(this.player, this.config);
    const entries = this.rowsFor(this.tab);
    const start = this.page * FLEA_ROWS_PER_PAGE;
    entries.slice(start, start + FLEA_ROWS_PER_PAGE).forEach((entry, i) => {
      const y = i * ROW_HEIGHT;
      const enabled = unlocked && entry.enabled;
      const label = new Text({
        text: entry.label,
        position: { x: 0, y: y + 6 },
        style: style({ fill: enabled ? theme.text : theme.textMuted }),
      });
      const button = new Button(entry.action, entry.run, 100, 26);
      button.position.set(WIDTH - 100, y);
      button.alpha = enabled ? 1 : 0.55;
      this.rows.addChild(label, button);
      this.rowButtons.push(button);
    });
    const pages = Math.max(1, Math.ceil(entries.length / FLEA_ROWS_PER_PAGE));
    this.pageText.text = `${this.page + 1}/${pages}`;
    this.prevButton.visible = this.nextButton.visible = pages > 1;
    this.pageText.visible = pages > 1;
  }

  private buyRows(): Row[] {
    const { flea } = this.player;
    const money = countInStash(
      this.player.inventory.stash,
      this.config.currency,
    );
    return marketDefs(this.catalog, this.config).map((def) => {
      const price = buyPrice(flea, this.config, def, this.catalog, this.now);
      return {
        label: describeMarketRow(
          def,
          price,
          priceTrend(flea, this.config, def, this.now),
          this.config,
          this.catalog,
        ),
        enabled: price <= money,
        action: "Comprar",
        run: () => {
          this.buyItem(def);
        },
      };
    });
  }

  private sellRows(): Row[] {
    const full = this.player.flea.listings.length >= this.config.slots;
    return this.saleItems().map((item) => {
      const value = listingValue(this.player, this.config, item, this.now);
      const { label, price } = describeListingRow(
        item,
        value,
        this.ratio,
        this.config,
        this.catalog,
      );
      return {
        label,
        enabled: value.ok && !full,
        action: "Anunciar",
        run: () => {
          this.listForSale(item, price);
        },
      };
    });
  }

  private listingRows(): Row[] {
    const { flea } = this.player;
    const results = flea.results.map((result) => ({
      label: describeResult(result, this.config, this.catalog),
      enabled: true,
      action: "Retirar",
      run: () => {
        this.collect(result);
      },
    }));
    const listings = flea.listings.map((listing) => ({
      label: describeListed(listing, this.config, this.catalog, this.now),
      enabled: true,
      action: "Cancelar",
      run: () => {
        this.cancel(listing);
      },
    }));
    return [...results, ...listings];
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
