import { coreBalance } from "../balance.ts";
import type { Catalog, ItemCategory } from "../inventory/item.ts";
import { Rng } from "../rng.ts";
import type { PlayerState } from "../state.ts";
import type {
  QuestContext,
  QuestDef,
  RepeatableOffer,
  RepeatableState,
} from "./types.ts";

export function createRepeatableState(seed: number): RepeatableState {
  return { seed: seed >>> 0, next: 1, offers: [] };
}

/** Faixa inteira do balanceamento: mínimo 1, `max` nunca abaixo de `min` */
function range(rng: Rng, min: number, max: number): number {
  const lo = Math.max(1, Math.round(min));
  return rng.int(lo, Math.max(lo, Math.round(max)));
}

/** Sorteia a próxima quest repetível do vendedor e avança a seed */
function generate(
  state: RepeatableState,
  trader: string,
  ctx: QuestContext,
  catalog: Catalog,
): RepeatableOffer {
  const b = coreBalance().repeatable;
  const rng = new Rng(state.seed);
  const weights: Partial<Record<ItemCategory, number>> = {
    barter: b.barterWeight,
    food: b.foodWeight,
    medical: b.medicalWeight,
  };
  // Só itens que aparecem no loot dos mapas, sem repetir
  const items = [...new Set(ctx.maps.flatMap((m) => m.loot.map((l) => l.item)))]
    .filter((id) => catalog.has(id))
    .map((id) => ({
      value: id,
      weight: weights[catalog.get(id).category] ?? 0,
    }))
    .filter((e) => e.weight > 0);
  const find =
    items.length > 0 &&
    b.findWeight > 0 &&
    rng.chance(b.findWeight / (b.findWeight + b.killWeight));
  let objective: RepeatableOffer["objective"];
  let money: number;
  if (find) {
    const item = rng.weighted(items);
    const count = range(rng, b.findMin, b.findMax);
    objective = { kind: "find", item, count };
    money = catalog.get(item).basePrice * count * b.findValueFactor;
  } else {
    const count = range(rng, b.killMin, b.killMax);
    objective = { kind: "kill", target: "scav", count };
    money = count * b.moneyPerKill;
  }
  state.seed = rng.getState();
  const units = objective.count;
  return {
    id: `repeat-${state.next++}`,
    trader,
    objective,
    money: Math.round(money),
    xp: Math.round(units * b.xpPerUnit),
    reputation: units * b.reputationPerUnit,
  };
}

/**
 * Garante uma quest repetível por vendedor (gera as que faltam, na ordem
 * dos vendedores) e descarta as de vendedores que saíram do jogo.
 */
export function ensureRepeatables(
  player: PlayerState,
  ctx: QuestContext,
): RepeatableOffer[] {
  const state = player.repeatable;
  state.offers = state.offers.filter((o) =>
    ctx.traders.some((t) => t.id === o.trader),
  );
  for (const trader of ctx.traders) {
    if (!state.offers.some((o) => o.trader === trader.id)) {
      state.offers.push(
        generate(state, trader.id, ctx, player.factory.catalog),
      );
    }
  }
  return state.offers;
}

// A mesma oferta devolve sempre a mesma QuestDef (a tela compara por identidade)
const defs = new WeakMap<RepeatableOffer, QuestDef>();

/** A quest repetível como uma `QuestDef` normal */
export function repeatableDef(
  offer: RepeatableOffer,
  catalog: Catalog,
): QuestDef {
  let def = defs.get(offer);
  if (!def) {
    const { objective } = offer;
    const kill = objective.kind === "kill";
    const item = kill ? "" : catalog.get(objective.item).name;
    def = {
      id: offer.id,
      name: kill ? `Caçada: ${objective.count} Scavs` : `Encomenda: ${item}`,
      trader: offer.trader,
      repeatable: true,
      description: kill
        ? "Trabalho avulso: abata Scavs em qualquer mapa. Quando terminar, aparece outro."
        : `Trabalho avulso: traga ${item} direto de uma raid. Quando terminar, aparece outro.`,
      requires: {},
      objectives: [objective],
      rewards: {
        xp: offer.xp,
        items: [{ item: "money_rub", count: offer.money }],
        reputation: [{ trader: offer.trader, amount: offer.reputation }],
      },
    };
    defs.set(offer, def);
  }
  return def;
}

/**
 * Contexto das quests com as repetíveis do jogador junto das fixas: `quests`
 * é lido na hora, então reflete as ofertas atuais.
 */
export function withRepeatables(
  player: PlayerState,
  base: QuestContext,
): QuestContext {
  return {
    traders: base.traders,
    maps: base.maps,
    get quests() {
      const offers = ensureRepeatables(player, base);
      return [
        ...base.quests,
        ...offers.map((o) => repeatableDef(o, player.factory.catalog)),
      ];
    },
  };
}

/** Depois de concluir uma repetível: some (e o estado dela) e outra é gerada */
export function replaceRepeatable(
  player: PlayerState,
  ctx: QuestContext,
  id: string,
): void {
  const state = player.repeatable;
  state.offers = state.offers.filter((o) => o.id !== id);
  delete player.quests[id];
  ensureRepeatables(player, ctx);
}
