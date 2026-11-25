// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { BalanceSync } from "../../../src/balanceSync.ts";
import type {
  BalanceMessage,
  BalanceRoomLike,
} from "../../../src/balanceSync.ts";
import { DEFAULT_BALANCE, resetBalance } from "../../../src/data/balance.ts";
import { catalog } from "../../../src/data/items.ts";
import { ADMIN_KEY, AdminPanel } from "../../../src/ui/admin/AdminPanel.ts";

function memoryStorage() {
  let value: string | null = null;
  return {
    read: () => value,
    write: (data: string) => {
      value = data;
    },
    clear: () => {
      value = null;
    },
  };
}

async function setup(connected = true, canOpen = () => true) {
  const sync = new BalanceSync(memoryStorage());
  let push: ((m: BalanceMessage) => void) | null = null;
  const room = {
    onMessage: vi.fn((_t: string, cb: (m: BalanceMessage) => void) => {
      push = cb;
    }),
    send: vi.fn(),
  };
  if (connected) await sync.connect(async () => room as BalanceRoomLike);
  const panel = new AdminPanel(document.body, { sync, catalog, canOpen });
  return { sync, room, panel, push: (m: BalanceMessage) => push!(m) };
}

const input = (panel: AdminPanel, name: string) =>
  panel.element.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

const change = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event("change"));
};

const press = (key: string) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key }));

const buttons = (panel: AdminPanel) =>
  Object.fromEntries(
    [...panel.element.querySelectorAll("button")].map((b) => [
      b.textContent,
      b,
    ]),
  );

afterEach(() => {
  resetBalance();
  document.body.replaceChildren();
});

describe("AdminPanel", () => {
  it("abre e fecha com F10; não abre quando não pode (raid)", async () => {
    let allowed = true;
    const { panel } = await setup(true, () => allowed);
    expect(panel.isOpen).toBe(false);
    press("a");
    expect(panel.isOpen).toBe(false);
    press(ADMIN_KEY);
    expect(panel.isOpen).toBe(true);
    press(ADMIN_KEY);
    expect(panel.isOpen).toBe(false);
    allowed = false;
    expect(panel.open()).toBe(false);
    expect(panel.isOpen).toBe(false);
    panel.destroy();
    expect(document.body.contains(panel.element)).toBe(false);
    allowed = true;
    press(ADMIN_KEY);
    expect(panel.isOpen).toBe(false);
  });

  it("mostra os valores do core, do mercado e do item escolhido", async () => {
    const { panel } = await setup();
    panel.open();
    expect(panel.status.textContent).toBe("Conectado ao servidor (versão 0)");
    expect(input(panel, "core.xp.consumableSkill").value).toBe("5");
    expect(input(panel, "flea.feeRate").value).toBe("0.04");
    change(panel.itemSelect, "ammo_9mm");
    expect(input(panel, "item.ammo_9mm.basePrice").value).toBe("45");
    expect(input(panel, "item.ammo_9mm.damage").value).toBe("54");
    expect(input(panel, "item.ammo_9mm.heal")).toBeNull();
    // reabrir mantém o item escolhido
    panel.render();
    expect(panel.itemSelect.value).toBe("ammo_9mm");
  });

  it("editar muda o rascunho; valor inválido volta ao anterior", async () => {
    const { panel } = await setup();
    panel.open();
    change(input(panel, "core.xp.consumableSkill"), "9");
    expect(panel.draft.core.xp.consumableSkill).toBe(9);
    change(input(panel, "flea.slots"), "4");
    expect(panel.draft.flea.slots).toBe(4);
    change(panel.itemSelect, "ammo_9mm");
    change(input(panel, "item.ammo_9mm.basePrice"), "60");
    change(input(panel, "item.ammo_9mm.damage"), "70");
    expect(panel.draft.items.ammo_9mm).toEqual({
      basePrice: 60,
      stats: { damage: 70 },
    });
    for (const bad of ["", "-3", "abc"]) {
      const field = input(panel, "core.xp.magDrillsPerRound");
      change(field, bad);
      expect(field.value).toBe("0.5");
    }
    expect(panel.draft.core.xp.magDrillsPerRound).toBe(0.5);
  });

  it("Salvar e Restaurar mandam ao servidor", async () => {
    const { panel, room } = await setup();
    panel.open();
    change(input(panel, "core.xp.consumableSkill"), "9");
    buttons(panel)["Salvar"].click();
    expect(room.send).toHaveBeenCalledWith("set", panel.draft);
    expect(panel.status.textContent).toBe("Enviado ao servidor");
    buttons(panel)["Restaurar padrões"].click();
    expect(room.send).toHaveBeenLastCalledWith("reset");
    expect(panel.status.textContent).toBe("Padrões pedidos ao servidor");
    buttons(panel)["Fechar"].click();
    expect(panel.isOpen).toBe(false);
  });

  it("sem servidor, edita mas não salva", async () => {
    const { panel } = await setup(false);
    panel.open();
    expect(panel.status.textContent).toBe(
      "Sem servidor: dá para editar, mas não salvar",
    );
    expect(panel.save()).toBe(false);
    expect(panel.status.textContent).toBe(
      "Sem servidor: não foi possível salvar",
    );
    expect(panel.restore()).toBe(false);
    expect(panel.status.textContent).toBe(
      "Sem servidor: não foi possível restaurar",
    );
  });

  it("valores novos do servidor atualizam a janela (aberta ou não)", async () => {
    const { panel, push } = await setup();
    const doc = structuredClone(DEFAULT_BALANCE);
    doc.core.xp.consumableSkill = 3;
    push({ version: 2, doc });
    expect(panel.draft.core.xp.consumableSkill).toBe(3);
    panel.open();
    doc.core.xp.consumableSkill = 4;
    push({ version: 3, doc });
    expect(input(panel, "core.xp.consumableSkill").value).toBe("4");
    expect(panel.status.textContent).toBe("Conectado ao servidor (versão 3)");
  });
});
