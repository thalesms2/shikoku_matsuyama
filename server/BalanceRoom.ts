import { Room } from "colyseus";
import type { Client } from "colyseus";

import { readBalance } from "../src/data/balance.ts";
import { BalanceStore } from "./balanceStore.ts";

/** Onde fica o banco do servidor (variável `BALANCE_DB` ou `data/server.db`) */
export const BALANCE_DB_PATH = process.env.BALANCE_DB ?? "data/server.db";

let defaultStore: BalanceStore | null = null;

/** Banco padrão, aberto no primeiro uso */
export function openDefaultStore(): BalanceStore {
  defaultStore ??= BalanceStore.open(BALANCE_DB_PATH);
  return defaultStore;
}

/** Só em desenvolvimento o servidor aceita mudar os valores */
export function balanceWritable(env = process.env.NODE_ENV): boolean {
  return env !== "production";
}

/**
 * Sala do balanceamento: quem entra recebe os valores atuais ("balance");
 * em desenvolvimento, "set" grava valores novos (validados) e "reset" volta
 * aos padrões, e todos os conectados recebem a mudança na hora.
 */
export class BalanceRoom extends Room {
  /** Troque nos testes */
  static store: () => BalanceStore = openDefaultStore;
  static writable: () => boolean = balanceWritable;

  messages = {
    set: (client: Client, doc: unknown) => {
      if (!this.allowed(client)) return;
      this.publish(BalanceRoom.store().set(readBalance(doc)));
    },
    reset: (client: Client) => {
      if (!this.allowed(client)) return;
      this.publish(BalanceRoom.store().set(null));
    },
  };

  onJoin(client: Client) {
    client.send("balance", BalanceRoom.store().get());
  }

  private allowed(client: Client): boolean {
    if (BalanceRoom.writable()) return true;
    client.send("error", "O balanceamento só muda em desenvolvimento");
    return false;
  }

  private publish(stored: { version: number; doc: unknown }): void {
    this.broadcast("balance", stored);
  }

  /** Sem isto, um erro na sala derruba o servidor */
  onUncaughtException(error: Error) {
    console.error(error);
  }
}
