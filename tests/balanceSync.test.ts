import { afterEach, describe, expect, it, vi } from "vitest";

import { BalanceSync } from "../src/balanceSync.ts";
import type { BalanceMessage, BalanceRoomLike } from "../src/balanceSync.ts";
import { coreBalance } from "../src/core/balance.ts";
import type { SaveStorage } from "../src/core/save/storage.ts";
import { DEFAULT_BALANCE, resetBalance } from "../src/data/balance.ts";
import { catalog } from "../src/data/items.ts";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    read: () => value,
    write: (data: string) => {
      value = data;
    },
    clear: () => {
      value = null;
    },
    get value() {
      return value;
    },
  } satisfies SaveStorage & { value: string | null };
}

function fakeRoom() {
  let handler: ((m: BalanceMessage) => void) | null = null;
  const room = {
    onMessage: vi.fn((_type: string, cb: (m: BalanceMessage) => void) => {
      handler = cb;
    }),
    send: vi.fn(),
  };
  return {
    room: room as unknown as BalanceRoomLike & typeof room,
    push: (m: BalanceMessage) => handler!(m),
  };
}

afterEach(() => {
  resetBalance();
});

describe("BalanceSync", () => {
  it("aplica a cópia local; sem cópia ou ilegível, fica nos padrões", () => {
    const doc = structuredClone(DEFAULT_BALANCE);
    doc.core.xp.consumableSkill = 7;
    expect(new BalanceSync(memoryStorage()).loadCache()).toBe(false);
    expect(new BalanceSync(memoryStorage("{x")).loadCache()).toBe(false);
    expect(
      new BalanceSync(memoryStorage(JSON.stringify(doc))).loadCache(),
    ).toBe(true);
    expect(coreBalance().xp.consumableSkill).toBe(7);
  });

  it("conecta, aplica o que chega, guarda a cópia e avisa quem ouve", async () => {
    const storage = memoryStorage();
    const sync = new BalanceSync(storage);
    const { room, push } = fakeRoom();
    expect(sync.connected).toBe(false);
    expect(await sync.connect(async () => room)).toBe(true);
    expect(sync.connected).toBe(true);
    const listener = vi.fn();
    const stop = sync.onChange(listener);
    push({ version: 4, doc: { items: { pistol_pk9: { basePrice: 7 } } } });
    expect(sync.version).toBe(4);
    expect(catalog.get("pistol_pk9").basePrice).toBe(7);
    expect(JSON.parse(storage.value!).items.pistol_pk9.basePrice).toBe(7);
    expect(listener).toHaveBeenCalledOnce();
    stop();
    push({ version: 5, doc: null });
    expect(listener).toHaveBeenCalledOnce();
    expect(catalog.get("pistol_pk9").basePrice).toBe(6500);
  });

  it("salvar e voltar aos padrões pedem ao servidor; sem conexão, false", async () => {
    const sync = new BalanceSync(memoryStorage());
    expect(sync.save(DEFAULT_BALANCE)).toBe(false);
    expect(sync.reset()).toBe(false);
    const { room } = fakeRoom();
    await sync.connect(async () => room);
    expect(sync.save(DEFAULT_BALANCE)).toBe(true);
    expect(room.send).toHaveBeenCalledWith("set", DEFAULT_BALANCE);
    expect(sync.reset()).toBe(true);
    expect(room.send).toHaveBeenLastCalledWith("reset");
  });

  it("sem servidor, avisa no console e segue", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sync = new BalanceSync(memoryStorage());
    expect(
      await sync.connect(async () => {
        throw new Error("fora do ar");
      }),
    ).toBe(false);
    expect(sync.connected).toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});
