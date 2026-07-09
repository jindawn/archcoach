#!/usr/bin/env node
/**
 * MCP server smoke check against a running ArchCoach instance.
 * Requires: docker compose up (or pnpm dev) + a configured LLM provider.
 *
 *   node mcp/smoke.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "archcoach-mcp.mjs");

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
  env: { ...process.env, ARCHCOACH_URL: process.env.ARCHCOACH_URL ?? "http://localhost:3000" },
});
const client = new Client({ name: "smoke", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((tool) => tool.name).join(", "));

const scenarios = await client.callTool({ name: "list_training_scenarios", arguments: {} });
console.log("\nSCENARIOS:\n" + scenarios.content[0].text);

const clarify = await client.callTool({
  name: "get_clarifying_questions",
  arguments: {
    title: "MCP 冒烟：短链接服务",
    businessContext: "面向内部系统的短链接服务，日均生成 10 万条，读取 2000 QPS，链接永不过期。",
    solutionMd:
      "单体 Go 服务，MySQL 存映射，Redis 缓存热点链接，自增 ID 转 base62 作为短码，Nginx 前置。",
    techStack: "Go + MySQL + Redis",
    constraints: { qps: 2000, teamSize: 2 },
  },
});
console.log("\nCLARIFY (truncated):\n" + clarify.content[0].text.slice(0, 600));

await client.close();
console.log("\nSMOKE_OK");
