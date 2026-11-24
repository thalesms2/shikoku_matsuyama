import type { QuestDef } from "../core/quests/types.ts";

/**
 * Quests dos vendedores. As marcadas `main` formam a cadeia da fuga; a
 * `final` termina o jogo.
 */
export const QUESTS: readonly QuestDef[] = [
  // ------------------------------------------------- cadeia principal
  {
    id: "recon",
    name: "Reconhecimento",
    trader: "colonel",
    main: true,
    description:
      "O Coronel quer saber se a Periferia ainda tem saída. Entre, olhe em volta e volte vivo para contar.",
    requires: {},
    objectives: [{ kind: "extract", count: 1, map: "outskirts" }],
    rewards: {
      xp: 1000,
      items: [{ item: "money_rub", count: 15_000 }],
      reputation: [{ trader: "colonel", amount: 0.05 }],
    },
  },
  {
    id: "cleanup",
    name: "Limpeza",
    trader: "colonel",
    main: true,
    description:
      "Bandos de Scavs bloqueiam as rotas de abastecimento. Abata alguns e o Coronel abre o arsenal para você.",
    requires: { quests: ["recon"] },
    objectives: [{ kind: "kill", target: "scav", count: 5 }],
    rewards: {
      xp: 2000,
      items: [
        { item: "money_rub", count: 25_000 },
        { item: "ammo_545", count: 60 },
      ],
      reputation: [{ trader: "colonel", amount: 0.05 }],
    },
  },
  {
    id: "radio-parts",
    name: "Peças para o rádio",
    trader: "scrapper",
    main: true,
    description:
      "Nico está montando um rádio para falar com quem está fora da cidade. Precisa de uma placa de vídeo tirada direto de uma raid, sem passar por outras mãos.",
    requires: { quests: ["cleanup"], pmcLevel: 3 },
    objectives: [{ kind: "deliver", item: "barter_gpu", count: 1, fir: true }],
    rewards: {
      xp: 3000,
      items: [{ item: "money_rub", count: 40_000 }],
      reputation: [{ trader: "scrapper", amount: 0.1 }],
    },
  },
  {
    id: "harbor-route",
    name: "Rota do porto",
    trader: "merchant",
    main: true,
    description:
      "Tito precisa saber se dá para atravessar o Porto Velho sem chamar atenção. Faça o caminho em silêncio e saia de lá.",
    requires: { quests: ["radio-parts"] },
    objectives: [
      { kind: "extract", count: 1, map: "harbor", strategy: "stealth" },
    ],
    rewards: {
      xp: 4000,
      items: [{ item: "money_usd", count: 300 }],
      reputation: [{ trader: "merchant", amount: 0.1 }],
    },
  },
  {
    id: "passage-price",
    name: "O preço da passagem",
    trader: "merchant",
    main: true,
    description:
      "O contrabandista do porto aceita levar mais um passageiro, mas cobra em ouro. Correntes encontradas na raid, nada de joia de vitrine.",
    requires: {
      quests: ["harbor-route"],
      loyalty: { trader: "merchant", level: 2 },
    },
    objectives: [
      { kind: "deliver", item: "barter_goldchain", count: 3, fir: true },
    ],
    rewards: {
      xp: 6000,
      reputation: [{ trader: "merchant", amount: 0.15 }],
    },
  },
  {
    id: "last-crossing",
    name: "A última travessia",
    trader: "merchant",
    main: true,
    final: true,
    description:
      "Está tudo pronto. Chegue ao cais, pague o barqueiro e deixe a cidade para trás.",
    requires: { quests: ["passage-price"], pmcLevel: 8 },
    objectives: [
      {
        kind: "extract",
        count: 1,
        map: "harbor",
        extract: "smuggler-boat",
      },
    ],
    rewards: { xp: 10_000 },
  },

  // ----------------------------------------------------- secundárias
  {
    id: "emergency-stock",
    name: "Estoque de emergência",
    trader: "doctor",
    description: "O posto de saúde está sem curativos. Qualquer atadura ajuda.",
    requires: {},
    objectives: [{ kind: "deliver", item: "med_bandage", count: 3 }],
    rewards: {
      xp: 500,
      items: [{ item: "med_kit", count: 1 }],
      reputation: [{ trader: "doctor", amount: 0.05 }],
    },
  },
  {
    id: "clean-water",
    name: "Água limpa",
    trader: "doctor",
    description:
      "A Doutora não confia na água vendida no mercado. Traga garrafas encontradas em raid, ainda lacradas.",
    requires: { quests: ["emergency-stock"] },
    objectives: [{ kind: "find", item: "food_water", count: 2 }],
    rewards: {
      xp: 1000,
      items: [{ item: "money_rub", count: 12_000 }],
      reputation: [{ trader: "doctor", amount: 0.05 }],
    },
  },
  {
    id: "pmc-hunt",
    name: "Caça na cimenteira",
    trader: "colonel",
    description:
      "Um grupo de PMCs tomou a Cimenteira. O Coronel paga bem por cada um que deixar de voltar.",
    requires: { quests: ["cleanup"], pmcLevel: 4 },
    objectives: [{ kind: "kill", target: "pmc", count: 2, map: "cement" }],
    rewards: {
      xp: 3000,
      items: [{ item: "money_rub", count: 40_000 }],
      reputation: [{ trader: "colonel", amount: 0.08 }],
    },
  },
  {
    id: "locked-garage",
    name: "Garagem trancada",
    trader: "scrapper",
    description:
      "Nico sabe onde está a chave da garagem da Periferia, mas quer a área mais calma antes de mandar alguém buscar.",
    requires: {},
    objectives: [{ kind: "kill", target: "scav", count: 3, map: "outskirts" }],
    rewards: {
      xp: 800,
      items: [{ item: "key_garage", count: 1 }],
      reputation: [{ trader: "scrapper", amount: 0.05 }],
    },
  },
];
