import { DatabaseSync } from "node:sqlite";

import type { Client } from "colyseus";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BalanceRoom,
  balanceWritable,
  openDefaultStore,
} from "../../server/BalanceRoom.ts";
import { BalanceStore } from "../../server/balanceStore.ts";
import { server } from "../../server/index.ts";
import { DEFAULT_BALANCE } from "../../src/data/balance.ts";

const memory = () => BalanceStore.open(":memory:");
const fakeClient = () =>
  ({ send: vi.fn() }) as unknown as Client & {
    send: ReturnType<typeof vi.fn>;
  };

describe("BalanceStore", () => {
  it("começa vazio; grava, lê e sobe a versão; null volta aos padrões", () => {
    const store = memory();
    expect(store.get()).toEqual({ version: 0, doc: null });
    expect(store.set({ a: 1 }, 5)).toEqual({ version: 1, doc: { a: 1 } });
    expect(store.get()).toEqual({ version: 1, doc: { a: 1 } });
    expect(store.set(null)).toEqual({ version: 2, doc: null });
    expect(store.get()).toEqual({ version: 2, doc: null });
  });

  it("JSON ilegível no banco conta como os padrões", () => {
    const db = new DatabaseSync(":memory:");
    const store = new BalanceStore(db);
    db.exec(
      "INSERT INTO balance (id, doc, version, updated_at) VALUES (1, '{x', 3, 0)",
    );
    expect(store.get()).toEqual({ version: 3, doc: null });
  });
});

describe("BalanceRoom", () => {
  afterEach(() => {
    BalanceRoom.store = openDefaultStore;
    BalanceRoom.writable = balanceWritable;
  });

  function room(writable = true) {
    const store = memory();
    BalanceRoom.store = () => store;
    BalanceRoom.writable = () => writable;
    const r = new BalanceRoom();
    const broadcast = vi.spyOn(r, "broadcast").mockImplementation(() => {});
    return { r, store, broadcast };
  }

  it("quem entra recebe os valores atuais", () => {
    const { r, store } = room();
    store.set({ core: {} });
    const client = fakeClient();
    r.onJoin(client);
    expect(client.send).toHaveBeenCalledWith("balance", {
      version: 1,
      doc: { core: {} },
    });
  });

  it("set grava os valores validados e avisa todos; reset volta aos padrões", () => {
    const { r, store, broadcast } = room();
    const client = fakeClient();
    r.messages.set(client, { flea: { feeRate: 0.2, checkMs: 0 } });
    const saved = store.get();
    expect(saved.version).toBe(1);
    const doc = saved.doc as typeof DEFAULT_BALANCE;
    expect(doc.flea.feeRate).toBe(0.2);
    expect(doc.flea.checkMs).toBe(DEFAULT_BALANCE.flea.checkMs);
    expect(broadcast).toHaveBeenCalledWith("balance", saved);
    r.messages.reset(client);
    expect(store.get()).toEqual({ version: 2, doc: null });
    expect(broadcast).toHaveBeenLastCalledWith("balance", {
      version: 2,
      doc: null,
    });
  });

  it("fora do desenvolvimento, recusa mudar", () => {
    const { r, store, broadcast } = room(false);
    const client = fakeClient();
    r.messages.set(client, {});
    r.messages.reset(client);
    expect(store.get().version).toBe(0);
    expect(broadcast).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith(
      "error",
      "O balanceamento só muda em desenvolvimento",
    );
  });

  it("só grava em desenvolvimento", () => {
    expect(balanceWritable("development")).toBe(true);
    expect(balanceWritable(undefined)).toBe(true);
    expect(balanceWritable("production")).toBe(false);
    expect(BalanceRoom.writable).toBe(balanceWritable);
  });

  it("o banco padrão abre uma vez só", () => {
    const fake = memory();
    const open = vi.spyOn(BalanceStore, "open").mockReturnValue(fake);
    expect(openDefaultStore()).toBe(fake);
    expect(openDefaultStore()).toBe(fake);
    expect(open).toHaveBeenCalledOnce();
  });

  it("erros da sala vão para o console", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    new BalanceRoom().onUncaughtException(new Error("x"));
    expect(error).toHaveBeenCalled();
  });

  it("o servidor registra a sala balance", () => {
    expect(server["~rooms"].balance.klass).toBe(BalanceRoom);
  });
});
