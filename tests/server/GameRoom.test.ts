import type { Client } from "colyseus";
import { describe, expect, it, vi } from "vitest";

import { GameRoom } from "../../server/GameRoom.ts";
import { onAuth } from "../../server/platform.ts";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../../server/world.ts";

function fakeClient(sessionId: string, auth?: { name: string }) {
  return { sessionId, auth } as unknown as Client<{ auth?: { name: string } }>;
}

function roomWithPlayer(sessionId = "a") {
  const room = new GameRoom();
  const client = fakeClient(sessionId);
  room.onJoin(client);
  return { room, client, player: room.state.players.get(sessionId)! };
}

describe("GameRoom", () => {
  it("usa o onAuth da plataforma", () => {
    expect(GameRoom.onAuth).toBe(onAuth);
  });

  describe("onJoin", () => {
    it("cria um jogador dentro do mundo, com o nome do auth", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const room = new GameRoom();
      room.onJoin(fakeClient("a", { name: "Ana" }));
      const player = room.state.players.get("a")!;
      expect(player.x).toBe(WORLD_WIDTH / 2);
      expect(player.y).toBe(WORLD_HEIGHT / 2);
      expect(player.name).toBe("Ana");
    });

    it("usa nome vazio sem auth", () => {
      const { player } = roomWithPlayer();
      expect(player.name).toBe("");
    });

    it("não recria um jogador que já está na sala", () => {
      const { room, client, player } = roomWithPlayer();
      room.onJoin(client);
      expect(room.state.players.size).toBe(1);
      expect(room.state.players.get("a")).toBe(player);
    });
  });

  it("onLeave remove o jogador", () => {
    const { room, client } = roomWithPlayer();
    room.onLeave(client);
    expect(room.state.players.size).toBe(0);
  });

  describe("move", () => {
    it("move o jogador para a posição pedida", () => {
      const { room, client, player } = roomWithPlayer();
      room.messages.move(client, { x: 100, y: 200 });
      expect([player.x, player.y]).toEqual([100, 200]);
    });

    it("limita a posição às bordas do mundo", () => {
      const { room, client, player } = roomWithPlayer();
      room.messages.move(client, { x: -50, y: WORLD_HEIGHT + 50 });
      expect([player.x, player.y]).toEqual([0, WORLD_HEIGHT]);
      room.messages.move(client, { x: WORLD_WIDTH + 1, y: -1 });
      expect([player.x, player.y]).toEqual([WORLD_WIDTH, 0]);
    });

    it.each([
      ["sem mensagem", undefined],
      ["x inválido", { x: Number.NaN, y: 1 }],
      ["y inválido", { x: 1, y: Number.POSITIVE_INFINITY }],
    ])("ignora mensagens inválidas (%s)", (_label, message) => {
      const { room, client, player } = roomWithPlayer();
      const before = [player.x, player.y];
      room.messages.move(client, message as { x: number; y: number });
      expect([player.x, player.y]).toEqual(before);
    });

    it("ignora clientes que não estão na sala", () => {
      const { room, player } = roomWithPlayer();
      const before = [player.x, player.y];
      room.messages.move(fakeClient("outro"), { x: 1, y: 1 });
      expect([player.x, player.y]).toEqual(before);
    });
  });

  it("jump avisa todos os jogadores", () => {
    const { room, client } = roomWithPlayer();
    const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
    room.messages.jump(client);
    expect(broadcast).toHaveBeenCalledWith("jump", "a");
  });

  it("onUncaughtException registra o erro sem derrubar o servidor", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("falhou");
    new GameRoom().onUncaughtException(error);
    expect(log).toHaveBeenCalledWith(error);
  });
});
