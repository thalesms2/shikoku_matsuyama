import { describe, expect, it } from "vitest";

import { GameRoom } from "../../server/GameRoom.ts";
import { GameState, Player } from "../../server/GameState.ts";
import { server } from "../../server/index.ts";
import { filterBy, onAuth, routes } from "../../server/platform.ts";

describe("server", () => {
  it("registra a sala game com a GameRoom e os filtros da plataforma", () => {
    const game = server["~rooms"].game;
    expect(game.klass).toBe(GameRoom);
    expect(game.filterOptions).toEqual(filterBy);
  });

  it("usa as rotas da plataforma", () => {
    expect(server.router).toBe(routes);
  });
});

describe("platform (web)", () => {
  it("deixa qualquer jogador entrar", async () => {
    expect(await onAuth()).toBe(true);
  });

  it("não separa jogadores em salas", () => {
    expect(filterBy).toEqual([]);
  });
});

describe("GameState", () => {
  it("guarda jogadores por sessão", () => {
    const state = new GameState();
    const player = new Player({ x: 1, y: 2, name: "Bia" });
    state.players.set("s1", player);
    expect(state.players.get("s1")).toMatchObject({ x: 1, y: 2, name: "Bia" });
  });
});
