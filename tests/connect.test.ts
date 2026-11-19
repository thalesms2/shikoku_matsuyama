import { beforeEach, describe, expect, it, vi } from "vitest";

const joinOrCreate = vi.fn();

vi.mock("@colyseus/sdk", () => ({
  Client: vi.fn(function () {
    return { joinOrCreate };
  }),
}));

const { joinGame } = await import("../src/connect.ts");

describe("joinGame", () => {
  beforeEach(() => {
    joinOrCreate.mockReset();
  });

  it("entra na sala game", async () => {
    const room = { sessionId: "abc" };
    joinOrCreate.mockResolvedValue(room);
    await expect(joinGame()).resolves.toBe(room);
    expect(joinOrCreate).toHaveBeenCalledWith("game");
  });

  it("troca o erro de conexão por uma mensagem clara", async () => {
    const cause = new Error("conexão recusada");
    joinOrCreate.mockImplementation(async () => {
      throw cause;
    });
    let error: unknown;
    try {
      await joinGame();
    } catch (e) {
      error = e;
    }
    expect(error instanceof Error && error.message).toBe(
      "Can't reach the game server",
    );
    expect(error instanceof Error && error.cause === cause).toBe(true);
  });
});
