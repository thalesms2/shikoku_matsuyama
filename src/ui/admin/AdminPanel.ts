import type { BalanceSync } from "../../balanceSync.ts";
import type { CoreBalance } from "../../core/balance.ts";
import { BALANCE_STAT_KEYS } from "../../core/inventory/item.ts";
import type { BalanceStatKey, Catalog } from "../../core/inventory/item.ts";
import { FLEA_BALANCE_KEYS, currentBalance } from "../../data/balance.ts";
import type { BalanceDocument } from "../../data/balance.ts";

/** Tecla que abre e fecha a janela */
export const ADMIN_KEY = "F10";

/** Nomes das seções do core na janela */
export const CORE_SECTION_NAMES: Record<keyof CoreBalance, string> = {
  durability: "Durabilidade",
  xp: "XP",
  trade: "Vendedores",
  scav: "Raid Scav",
  matrix: "Raid em matriz",
  knowledge: "Conhecimento do mapa",
  encounter: "Inimigos e percepção",
  combat: "Combate d20",
  bleed: "Sangramento e cuidados",
  repeatable: "Quests repetíveis",
  hideout: "Esconderijo",
};

/** Nomes dos dados técnicos dos itens na janela */
export const STAT_NAMES: Record<BalanceStatKey, string> = {
  damage: "Dano",
  penetration: "Penetração",
  armorClass: "Classe de proteção",
  durability: "Durabilidade",
  capacity: "Capacidade",
  heal: "Cura",
  energy: "Energia",
  hydration: "Hidratação",
  surgery: "Cirurgia (min)",
  damageDie: "Dado de dano (lados)",
  damageBonus: "Bônus de dano",
  visibility: "Chama atenção",
  perceptionBonus: "Percepção (d20)",
  stealthBonus: "Furtividade (d20)",
};

const PANEL_STYLE = [
  "position:fixed",
  "top:12px",
  "right:12px",
  "width:360px",
  "max-height:calc(100vh - 24px)",
  "overflow:auto",
  "background:rgba(14,16,20,0.97)",
  "color:#d6dbe3",
  "font:12px/1.4 monospace",
  "border:1px solid #c8a24a",
  "padding:10px",
  "z-index:1000",
].join(";");

/**
 * Janela de admin (só em desenvolvimento): edita os valores de balanceamento
 * do jogo. "Salvar" manda para o servidor, que grava no banco e atualiza
 * todos os clientes; "Restaurar padrões" volta aos valores dos dados. Não
 * abre durante uma raid (`canOpen`).
 */
export class AdminPanel {
  readonly element: HTMLDivElement;
  readonly status: HTMLDivElement;
  readonly body: HTMLDivElement;
  readonly itemSelect: HTMLSelectElement;
  readonly itemFields: HTMLDivElement;
  /** Valores sendo editados (vão para o servidor ao salvar) */
  draft: BalanceDocument = currentBalance();
  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key !== ADMIN_KEY) return;
    event.preventDefault();
    this.toggle();
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly options: {
      sync: BalanceSync;
      catalog: Catalog;
      /** Se a janela pode abrir agora (não abre durante a raid) */
      canOpen: () => boolean;
    },
  ) {
    const doc = root.ownerDocument;
    this.element = doc.createElement("div");
    this.element.className = "admin-panel";
    this.element.style.cssText = PANEL_STYLE;
    this.element.hidden = true;
    const title = doc.createElement("strong");
    title.textContent = "Admin · balanceamento";
    this.status = doc.createElement("div");
    this.body = doc.createElement("div");
    this.itemSelect = doc.createElement("select");
    this.itemSelect.addEventListener("change", () => this.renderItem());
    this.itemFields = doc.createElement("div");
    const buttons = doc.createElement("div");
    buttons.append(
      this.button("Salvar", () => this.save()),
      this.button("Restaurar padrões", () => this.restore()),
      this.button("Fechar", () => this.close()),
    );
    this.element.append(title, this.status, buttons, this.body);
    root.appendChild(this.element);
    root.ownerDocument.addEventListener("keydown", this.onKey);
    options.sync.onChange(() => {
      this.draft = currentBalance();
      if (this.isOpen) this.render();
    });
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  open(): boolean {
    if (!this.options.canOpen()) return false;
    this.draft = currentBalance();
    this.render();
    this.element.hidden = false;
    return true;
  }

  close(): void {
    this.element.hidden = true;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Manda os valores editados para o servidor */
  save(): boolean {
    const sent = this.options.sync.save(this.draft);
    this.setStatus(
      sent ? "Enviado ao servidor" : "Sem servidor: não foi possível salvar",
    );
    return sent;
  }

  /** Pede ao servidor para voltar aos padrões */
  restore(): boolean {
    const sent = this.options.sync.reset();
    this.setStatus(
      sent
        ? "Padrões pedidos ao servidor"
        : "Sem servidor: não foi possível restaurar",
    );
    return sent;
  }

  /** Remove a janela e para de ouvir o teclado */
  destroy(): void {
    this.root.ownerDocument.removeEventListener("keydown", this.onKey);
    this.element.remove();
  }

  private setStatus(text: string): void {
    this.status.textContent = text;
  }

  private connectionText(): string {
    const { sync } = this.options;
    return sync.connected
      ? `Conectado ao servidor (versão ${sync.version})`
      : "Sem servidor: dá para editar, mas não salvar";
  }

  /** Redesenha todos os campos a partir de `draft` */
  render(): void {
    const doc = this.root.ownerDocument;
    this.setStatus(this.connectionText());
    this.body.replaceChildren();
    const core = this.draft.core as unknown as Record<
      string,
      Record<string, number>
    >;
    for (const [section, values] of Object.entries(core)) {
      this.body.append(
        this.heading(CORE_SECTION_NAMES[section as keyof CoreBalance]),
      );
      for (const key of Object.keys(values)) {
        this.body.append(
          this.field(`core.${section}.${key}`, key, values[key], (v) => {
            values[key] = v;
          }),
        );
      }
    }
    this.body.append(this.heading("Mercado"));
    for (const key of FLEA_BALANCE_KEYS) {
      this.body.append(
        this.field(`flea.${key}`, key, this.draft.flea[key], (v) => {
          this.draft.flea[key] = v;
        }),
      );
    }
    this.body.append(this.heading("Itens"));
    const selected = this.itemSelect.value;
    this.itemSelect.replaceChildren(
      ...this.options.catalog.all().map((def) => {
        const option = doc.createElement("option");
        option.value = def.id;
        option.textContent = def.name;
        return option;
      }),
    );
    if (selected) this.itemSelect.value = selected;
    this.body.append(this.itemSelect, this.itemFields);
    this.renderItem();
  }

  /** Campos do item escolhido: preço e os dados técnicos que ele tem */
  renderItem(): void {
    const id = this.itemSelect.value;
    const def = this.options.catalog.get(id);
    const override = (this.draft.items[id] ??= {});
    this.itemFields.replaceChildren(
      this.field(`item.${id}.basePrice`, "Preço base", def.basePrice, (v) => {
        override.basePrice = v;
      }),
      ...BALANCE_STAT_KEYS.filter((key) => def.stats?.[key] !== undefined).map(
        (key) =>
          this.field(
            `item.${id}.${key}`,
            STAT_NAMES[key],
            def.stats![key]!,
            (v) => {
              override.stats = { ...override.stats, [key]: v };
            },
          ),
      ),
    );
  }

  private heading(text: string): HTMLElement {
    const h = this.root.ownerDocument.createElement("div");
    h.textContent = text;
    h.style.cssText = "margin-top:10px;color:#c8a24a;font-weight:bold";
    return h;
  }

  /** Linha com rótulo e número; valores inválidos (vazio, negativo) são ignorados */
  private field(
    name: string,
    label: string,
    value: number,
    set: (value: number) => void,
  ): HTMLLabelElement {
    const doc = this.root.ownerDocument;
    const row = doc.createElement("label");
    row.style.cssText = "display:flex;justify-content:space-between;gap:8px";
    const text = doc.createElement("span");
    text.textContent = label;
    const input = doc.createElement("input");
    input.type = "number";
    input.name = name;
    input.step = "any";
    input.min = "0";
    input.value = String(value);
    input.style.width = "110px";
    input.addEventListener("change", () => {
      const parsed = Number(input.value);
      if (input.value === "" || !Number.isFinite(parsed) || parsed < 0) {
        input.value = String(value);
        return;
      }
      set(parsed);
    });
    row.append(text, input);
    return row;
  }

  private button(label: string, run: () => void): HTMLButtonElement {
    const button = this.root.ownerDocument.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.marginRight = "6px";
    button.addEventListener("click", run);
    return button;
  }
}
