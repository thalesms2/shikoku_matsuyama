import { defineRoom, defineServer } from "colyseus";

import { BalanceRoom } from "./BalanceRoom.ts";
import { GameRoom } from "./GameRoom.ts";
import { filterBy, routes } from "./platform.ts";

export const server = defineServer({
  rooms: {
    // The platform can split players into separate rooms, as Discord does
    // with one room per Activity session
    game: defineRoom(GameRoom).filterBy(filterBy),
    // Valores de balanceamento do jogo (janela de admin em desenvolvimento)
    balance: defineRoom(BalanceRoom),
  },
  routes,
});
