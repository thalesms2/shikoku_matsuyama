import { describe, expect, it, vi } from "vitest";

import type { CliDeps } from "../../../scripts/items/cli.ts";

const { main } = vi.hoisted(() => ({ main: vi.fn(async () => 3) }));

vi.mock("../../../scripts/items/cli.ts", () => ({ main }));

describe("run.ts", () => {
  it("chama a CLI com os argumentos e as dependências reais", async () => {
    const argv = process.argv;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    process.argv = ["node", "run.ts", "export", "--out", "x.json"];
    try {
      await import("../../../scripts/items/run.ts");
    } finally {
      process.argv = argv;
    }
    expect(process.exitCode).toBe(3);
    process.exitCode = undefined;

    const [args, deps] = main.mock.calls[0] as unknown as [string[], CliDeps];
    expect(args).toEqual(["export", "--out", "x.json"]);
    expect(deps.root).toBe(process.cwd());
    expect(deps.fetchFn).toBe(fetch);
    expect(deps.now()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    deps.log("oi");
    deps.error("erro");
    expect(log).toHaveBeenCalledWith("oi");
    expect(error).toHaveBeenCalledWith("erro");
    const db = deps.openDb(":memory:");
    db.close();
  });
});
