import { describe, expect, test, vi } from "vitest";
import { checkEnvVars } from "../general";
import { beforeEach } from "node:test";

describe("General utility functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("should throw if env vars are missing", () => {
    const mock = vi.fn().mockImplementation(checkEnvVars);
    expect(() => {
      mock(["testEnv1", "testEnv2"]);
    }).toThrow();
  });
  test("should not throw if env vars are set", () => {
    vi.stubEnv("testEnv1", "true");
    vi.stubEnv("testEnv2", "true");
    const mock = vi.fn().mockImplementation(checkEnvVars);
    mock(["testEnv1", "testEnv2"]);
    expect(mock).toHaveBeenCalled();
  });
});
