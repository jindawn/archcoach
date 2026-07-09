import { describe, expect, test } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  test("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  test("resolves tailwind conflicts with last-wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  test("ignores falsy values", () => {
    expect(cn("a", false && "b", undefined)).toBe("a");
  });
});
