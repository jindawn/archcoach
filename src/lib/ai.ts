import { createGateway, loadGatewayConfig, type Gateway } from "@/core/llm";
import { insertCallLog } from "@/db/repositories/callLogs";

const globalForAi = globalThis as unknown as { gateway?: Gateway };

/** Lazily built singleton so importing this module never throws before env is ready. */
export function getGateway(): Gateway {
  if (!globalForAi.gateway) {
    globalForAi.gateway = createGateway(loadGatewayConfig(), async (entry) => {
      await insertCallLog(entry);
    });
  }
  return globalForAi.gateway;
}
