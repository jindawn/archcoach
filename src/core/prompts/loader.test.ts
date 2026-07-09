import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { clearPromptCache, loadPromptTemplate, renderTemplate } from "./loader";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prompts-"));
  fs.writeFileSync(
    path.join(dir, "greet.md"),
    `---\nversion: v1\n---\nHello {{name}}, review {{thing}}.`,
  );
  fs.writeFileSync(path.join(dir, "no-version.md"), `---\nfoo: bar\n---\nbody`);
  fs.mkdirSync(path.join(dir, "roles"));
  fs.writeFileSync(path.join(dir, "roles", "sre.md"), `---\nversion: v2\n---\nSRE prompt`);
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  clearPromptCache();
});

describe("loadPromptTemplate", () => {
  test("loads template with version from frontmatter", () => {
    const tpl = loadPromptTemplate("greet", dir);
    expect(tpl.version).toBe("v1");
    expect(tpl.content).toContain("Hello {{name}}");
  });

  test("supports nested names", () => {
    expect(loadPromptTemplate("roles/sre", dir).version).toBe("v2");
  });

  test("throws for a missing file", () => {
    expect(() => loadPromptTemplate("nope", dir)).toThrow(/not found/);
  });

  test("throws when version frontmatter is missing", () => {
    expect(() => loadPromptTemplate("no-version", dir)).toThrow(/version/);
  });
});

describe("renderTemplate", () => {
  test("substitutes variables", () => {
    expect(renderTemplate("Hi {{a}} and {{b}}", { a: "x", b: "y" })).toBe("Hi x and y");
  });

  test("throws on missing variables", () => {
    expect(() => renderTemplate("Hi {{missing}}", {})).toThrow(/missing/);
  });
});
