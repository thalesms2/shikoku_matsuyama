// @vitest-environment jsdom
import type { Text } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "../../../src/core/clock.ts";
import type { QuestContext, QuestDef } from "../../../src/core/quests/types.ts";
import { catalog } from "../../../src/data/items.ts";
import { MAPS } from "../../../src/data/maps.ts";
import { createNewPlayer } from "../../../src/data/newGame.ts";
import { QUESTS } from "../../../src/data/quests.ts";
import { TRADERS } from "../../../src/data/traders.ts";
import {
  QuestsScene,
  STATUS_LABELS,
  describeObjective,
  describeRewards,
} from "../../../src/ui/scenes/QuestsScene.ts";
import { ERROR_COLOR, OK_COLOR } from "../../../src/ui/scenes/TradersScene.ts";

const tap = (target: { emit: (e: string, ev: never) => void }) =>
  target.emit("pointertap", {} as never);

const CTX: QuestContext = { quests: QUESTS, traders: TRADERS, maps: MAPS };

function setup(ctx = CTX) {
  const player = createNewPlayer(new ManualClock());
  const onBack = vi.fn();
  const onEnding = vi.fn();
  const scene = new QuestsScene(player, {
    ctx,
    clock: new ManualClock(),
    onBack,
    onEnding,
  });
  const lines = () =>
    scene.objectives.children
      .filter((c) => !("onPress" in c))
      .map((c) => (c as Text).text);
  return { scene, player, onBack, onEnding, lines };
}

describe("textos das quests", () => {
  it("objetivos", () => {
    const d = (o: QuestDef["objectives"][number]) =>
      describeObjective(o, catalog, CTX);
    expect(d({ kind: "deliver", item: "barter_bolts", count: 1 })).toBe(
      "Entregar Parafusos",
    );
    expect(
      d({ kind: "deliver", item: "barter_goldchain", count: 3, fir: true }),
    ).toBe("Entregar Corrente de ouro x3 (encontrados na raid)");
    expect(d({ kind: "find", item: "food_water", count: 2 })).toBe(
      "Sair de uma raid com Garrafa de água x2",
    );
    expect(
      d({ kind: "find", item: "food_water", count: 1, map: "cement" }),
    ).toBe("Sair de uma raid com Garrafa de água em Cimenteira");
    expect(d({ kind: "kill", target: "scav", count: 5 })).toBe(
      "Abater 5 Scav(s)",
    );
    expect(d({ kind: "kill", target: "pmc", count: 2, map: "cement" })).toBe(
      "Abater 2 PMC(s) inimigo(s) em Cimenteira",
    );
    expect(d({ kind: "extract", count: 1 })).toBe("Extrair");
    expect(
      d({
        kind: "extract",
        count: 2,
        map: "harbor",
        extract: "smuggler-boat",
        strategy: "stealth",
      }),
    ).toBe(
      "Extrair de Porto Velho pela saída Barco do Contrabandista com a estratégia Furtivo (2 vezes)",
    );
  });

  it("recompensas, ofertas liberadas e fuga", () => {
    const quest = (id: string) => QUESTS.find((q) => q.id === id)!;
    expect(describeRewards(quest("cleanup"), catalog, CTX)).toBe(
      "XP +2000 · 25.000 ₽ · Cartucho 5.45 FMJ x60 · reputação +0.05 com Coronel Brás · libera Fuzil VK-74 com Coronel Brás",
    );
    expect(describeRewards(quest("last-crossing"), catalog, CTX)).toBe(
      "XP +10000 · a fuga da cidade",
    );
    const empty = { ...quest("recon"), rewards: {} };
    expect(describeRewards(empty, catalog, CTX)).toBe("nenhuma");
  });
});

describe("QuestsScene", () => {
  it("lista por status e mostra a primeira disponível", () => {
    const { scene, lines } = setup();
    const ordered = scene.ordered();
    expect(scene.selected).toBe(ordered[0]);
    expect(scene.status(ordered[0])).toBe("available");
    expect(scene.status(ordered.at(-1)!)).toBe("locked");
    expect(scene.questButtons.get(ordered[0].id)!.text.text).toBe(
      `${ordered[0].name} · ${STATUS_LABELS.available}`,
    );
    expect(scene.titleText.text).toBe(ordered[0].name);
    expect(scene.actionButton.visible).toBe(true);
    expect(scene.actionButton.text.text).toBe("Aceitar");
    expect(lines()[0]).toMatch(/^0\/\d+ — /);
    expect(scene.detailsText.text).toMatch(/^Recompensas: /);
  });

  it("quest bloqueada mostra os requisitos e não tem ação", () => {
    const { scene } = setup();
    tap(scene.questButtons.get("last-crossing")!);
    expect(scene.selected.id).toBe("last-crossing");
    expect(scene.descriptionText.text).toContain(
      "Mercador Tito · Cadeia principal · bloqueada",
    );
    expect(scene.detailsText.text).toContain(
      'Requisitos: PMC nível 8; Concluir "O preço da passagem"',
    );
    expect(scene.actionButton.visible).toBe(false);
    expect(scene.act()).toBeNull();
  });

  it("aceitar, entregar em partes e concluir", () => {
    const { scene, player, lines } = setup();
    tap(scene.questButtons.get("emergency-stock")!);
    expect(scene.descriptionText.text).toContain("Doutora Iara · disponível");
    tap(scene.actionButton);
    expect(scene.messageText.text).toBe("Quest aceita");
    expect(scene.messageText.style.fill).toBe(OK_COLOR);
    expect(player.quests["emergency-stock"].status).toBe("active");
    expect(scene.actionButton.visible).toBe(false);
    // o kit inicial tem 2 ataduras no estoque
    tap(scene.deliverButtons.get(0)!);
    expect(scene.messageText.text).toBe("Entregou 2");
    expect(lines()[0]).toBe("2/3 — Entregar Atadura x3");
    tap(scene.deliverButtons.get(0)!);
    expect(scene.messageText.text).toBe("Nenhum item para entregar");
    expect(scene.messageText.style.fill).toBe(ERROR_COLOR);
    const { stash } = player.inventory;
    const bandage = player.factory.create("med_bandage");
    const spot = stash.findFreeSpot(bandage)!;
    stash.place(bandage, spot.x, spot.y, spot.rotated);
    tap(scene.deliverButtons.get(0)!);
    expect(scene.messageText.text).toBe("Entregou 1");
    expect(lines()[0]).toBe("Feito — Entregar Atadura x3");
    expect(scene.deliverButtons.size).toBe(0);
    expect(scene.actionButton.text.text).toBe("Concluir");
    expect(scene.questButtons.get("emergency-stock")!.text.text).toContain(
      STATUS_LABELS.ready,
    );
    tap(scene.actionButton);
    expect(scene.messageText.text).toBe("Quest concluída");
    expect(player.quests["emergency-stock"].status).toBe("completed");
    expect(scene.questButtons.get("emergency-stock")!.text.text).toContain(
      STATUS_LABELS.completed,
    );
  });

  it("concluir a quest final chama o final; outras não", () => {
    const { scene, player, onEnding } = setup();
    player.quests["last-crossing"] = { status: "active", progress: [1] };
    tap(scene.questButtons.get("last-crossing")!);
    tap(scene.actionButton);
    expect(onEnding).toHaveBeenCalledOnce();
    player.quests.recon = { status: "active", progress: [1] };
    tap(scene.questButtons.get("recon")!);
    tap(scene.actionButton);
    expect(onEnding).toHaveBeenCalledOnce();
  });

  it("sem final configurado e conclusão recusada", () => {
    const player = createNewPlayer(new ManualClock());
    const scene = new QuestsScene(player, {
      ctx: CTX,
      clock: new ManualClock(),
      onBack: vi.fn(),
    });
    player.quests["last-crossing"] = { status: "active", progress: [1] };
    scene.select(QUESTS.find((q) => q.id === "last-crossing")!);
    expect(scene.act()?.ok).toBe(true);
    // estoque cheio: recompensa não cabe
    player.quests.cleanup = { status: "active", progress: [5] };
    const { stash } = player.inventory;
    for (let i = 0; i < 200; i++) {
      const bolts = player.factory.create("barter_bolts");
      const spot = stash.findFreeSpot(bolts);
      if (!spot) break;
      stash.place(bolts, spot.x, spot.y, false);
    }
    scene.select(QUESTS.find((q) => q.id === "cleanup")!);
    expect(scene.act()?.ok).toBe(false);
    expect(scene.messageText.text).toBe(
      "Sem espaço no estoque para as recompensas",
    );
  });

  it("voltar e redimensionar", () => {
    const { scene, onBack } = setup();
    tap(scene.backButton);
    expect(onBack).toHaveBeenCalledOnce();
    scene.resize(100000, 100000);
    expect(scene.content.scale.x).toBe(1.5);
    scene.resize(502, 100000);
    expect(scene.content.scale.x).toBeCloseTo(0.5);
  });
});
