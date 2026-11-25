import { describe, expect, it, vi } from "vitest";

const joinOrCreate = vi.fn(async (name: string) => ({ name }));

vi.mock("@colyseus/sdk", () => ({
  Client: vi.fn(function () {
    return { joinOrCreate };
  }),
}));

const { joinBalanceRoom } = await import("../src/balanceSync.ts");

describe("joinBalanceRoom", () => {
  it("entra na sala balance", async () => {
    await expect(joinBalanceRoom()).resolves.toEqual({ name: "balance" });
    expect(joinOrCreate).toHaveBeenCalledWith("balance");
  });
});
