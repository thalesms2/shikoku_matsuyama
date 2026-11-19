import { describe, expect, it, vi } from "vitest";

import { EventBus } from "../../src/core/events.ts";

type Events = { hit: number; msg: string };

describe("EventBus", () => {
  it("entrega o payload aos listeners do evento", () => {
    const bus = new EventBus<Events>();
    const hit = vi.fn();
    const msg = vi.fn();
    bus.on("hit", hit);
    bus.on("msg", msg);
    bus.emit("hit", 10);
    expect(hit).toHaveBeenCalledWith(10);
    expect(msg).not.toHaveBeenCalled();
  });

  it("emit sem listeners não falha", () => {
    expect(() => new EventBus<Events>().emit("hit", 1)).not.toThrow();
  });

  it("a função devolvida por on remove o listener", () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    const off = bus.on("hit", fn);
    off();
    bus.emit("hit", 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("off remove o listener e ignora eventos desconhecidos", () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.on("hit", fn);
    bus.off("hit", fn);
    bus.off("msg", fn);
    bus.emit("hit", 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("once roda uma única vez", () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.once("hit", fn);
    bus.emit("hit", 1);
    bus.emit("hit", 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it("once pode ser cancelado antes de disparar", () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    const off = bus.once("hit", fn);
    off();
    bus.emit("hit", 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("listeners podem se remover durante o emit sem pular os outros", () => {
    const bus = new EventBus<Events>();
    const second = vi.fn();
    const off = bus.on("hit", () => off());
    bus.on("hit", second);
    bus.emit("hit", 1);
    expect(second).toHaveBeenCalledOnce();
  });

  it("clear remove listeners de um evento ou de todos", () => {
    const bus = new EventBus<Events>();
    const hit = vi.fn();
    const msg = vi.fn();
    bus.on("hit", hit);
    bus.on("msg", msg);
    bus.clear("hit");
    bus.emit("hit", 1);
    bus.emit("msg", "a");
    expect(hit).not.toHaveBeenCalled();
    expect(msg).toHaveBeenCalledOnce();
    bus.clear();
    bus.emit("msg", "b");
    expect(msg).toHaveBeenCalledOnce();
  });
});
