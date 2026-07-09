import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface PromptTemplate {
  /** template name relative to the prompts dir, e.g. "roles/sre" */
  name: string;
  /** semantic version from frontmatter; logged with every LLM call */
  version: string;
  content: string;
}

const cache = new Map<string, PromptTemplate>();

function promptsDir(baseDir?: string): string {
  return baseDir ?? path.join(process.cwd(), "prompts");
}

/**
 * Loads a prompt template from /prompts/<name>.md. Templates are files under
 * git version control; the frontmatter `version` field must be bumped on any
 * change (enforced in CONTRIBUTING) and is recorded in llm_call_logs.
 */
export function loadPromptTemplate(name: string, baseDir?: string): PromptTemplate {
  const cacheKey = `${baseDir ?? ""}:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const filePath = path.join(promptsDir(baseDir), `${name}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt template not found: ${filePath}`);
  }

  const { data, content } = matter(fs.readFileSync(filePath, "utf8"));
  const version = typeof data.version === "string" ? data.version : undefined;
  if (!version) {
    throw new Error(`Prompt template "${name}" is missing a "version" frontmatter field.`);
  }

  const template: PromptTemplate = { name, version, content: content.trim() };
  cache.set(cacheKey, template);
  return template;
}

/** test hook */
export function clearPromptCache(): void {
  cache.clear();
}

/**
 * Renders {{variable}} placeholders. Unknown placeholders throw so a typo in
 * a template fails loudly instead of sending "{{foo}}" to the model.
 */
export function renderTemplate(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`Missing template variable "${key}".`);
    }
    return value;
  });
}
