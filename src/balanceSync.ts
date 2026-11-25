import { Client } from "@colyseus/sdk";

import type { server } from "../server/index.ts";
import type { SaveStorage } from "./core/save/storage.ts";
import { applyBalance, readBalance } from "./data/balance.ts";
import type { BalanceDocument } from "./data/balance.ts";

/** Cópia local dos últimos valores recebidos (para jogar sem servidor) */
export const BALANCE_CACHE_KEY = "escape-from-idle:balance";

/** Mensagem do servidor com os valores (`doc` nulo = padrões) */
export interface BalanceMessage {
  version: number;
  doc: unknown;
}

/** O que o cliente usa da sala do balanceamento */
export interface BalanceRoomLike {
  onMessage(type: "balance", callback: (message: BalanceMessage) => void): void;
  send(type: "set" | "reset", payload?: unknown): void;
}

/** Entra na sala do balanceamento do servidor que serviu a página */
export async function joinBalanceRoom(): Promise<BalanceRoomLike> {
  return new Client<typeof server>().joinOrCreate(
    "balance",
  ) as unknown as BalanceRoomLike;
}

/**
 * Mantém o balanceamento do jogo igual ao do servidor: aplica os valores que
 * chegam (na entrada e a cada mudança), guarda uma cópia local e avisa quem
 * estiver ouvindo. Sem servidor, fica com a cópia local ou com os padrões.
 */
export class BalanceSync {
  /** Versão dos valores em uso (0 = padrões ou cópia local) */
  version = 0;
  private room: BalanceRoomLike | null = null;
  private readonly listeners = new Set<() => void>();

  /** `storage`: onde fica a cópia local (`browserStorage(BALANCE_CACHE_KEY)`) */
  constructor(private readonly storage: SaveStorage) {}

  get connected(): boolean {
    return this.room !== null;
  }

  /** Aplica a cópia local, se houver */
  loadCache(): boolean {
    const text = this.storage.read();
    if (!text) return false;
    try {
      applyBalance(readBalance(JSON.parse(text)));
      return true;
    } catch {
      return false;
    }
  }

  /** Entra na sala; sem servidor, devolve `false` e o jogo segue como está */
  async connect(join: () => Promise<BalanceRoomLike>): Promise<boolean> {
    try {
      const room = await join();
      room.onMessage("balance", (message) => this.receive(message));
      this.room = room;
      return true;
    } catch (error) {
      console.warn("Balanceamento: servidor indisponível", error);
      return false;
    }
  }

  /** Valores que chegaram do servidor */
  receive(message: BalanceMessage): void {
    const doc = readBalance(message.doc);
    applyBalance(doc);
    this.version = message.version;
    this.storage.write(JSON.stringify(doc));
    for (const listener of this.listeners) listener();
  }

  /** Pede ao servidor para gravar os valores; `false` sem conexão */
  save(doc: BalanceDocument): boolean {
    this.room?.send("set", doc);
    return this.room !== null;
  }

  /** Pede ao servidor para voltar aos padrões; `false` sem conexão */
  reset(): boolean {
    this.room?.send("reset");
    return this.room !== null;
  }

  /** Avisa a cada mudança recebida; devolve a função para parar */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
