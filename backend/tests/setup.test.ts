import { describe, expect, it } from "vitest";

describe("backend test environment", () => {
  it("runs in test mode without browser globals", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect("window" in globalThis).toBe(false);
    expect("document" in globalThis).toBe(false);
  });
});
