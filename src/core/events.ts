/**
 * Event bus tipado. `Events` mapeia o nome de cada evento para o tipo do seu
 * payload, por exemplo `EventBus<{ raidEnded: { survived: boolean } }>`.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  /** Registra um listener e devolve a função que o remove */
  on<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  /** Registra um listener que roda só uma vez */
  once<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copia para que listeners possam se remover durante o emit
    for (const listener of Array.from(set)) {
      (listener as (payload: Events[K]) => void)(payload);
    }
  }

  /** Remove todos os listeners, de um evento ou de todos */
  clear(event?: keyof Events): void {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
  }
}
