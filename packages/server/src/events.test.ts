import { describe, expect, test } from "bun:test";
import { EventEmitter } from "./events";

interface TestEvents {
  changed: number;
}

describe("EventEmitter", () => {
  test("isolates sync and async listener failures", async () => {
    const events = new EventEmitter<TestEvents>();
    const received: number[] = [];
    events.on("changed", () => {
      throw new Error("sync failure");
    });
    events.on("changed", async () => {
      throw new Error("async failure");
    });
    events.on("changed", (value) => {
      received.push(value);
    });

    expect(() => events.emit("changed", 21)).not.toThrow();
    await Promise.resolve();

    expect(received).toEqual([21]);
  });

  test("returns an unsubscribe function", () => {
    const events = new EventEmitter<TestEvents>();
    const received: number[] = [];
    const unsubscribe = events.on("changed", (value) => {
      received.push(value);
    });

    events.emit("changed", 1);
    unsubscribe();
    events.emit("changed", 2);

    expect(received).toEqual([1]);
  });
});
