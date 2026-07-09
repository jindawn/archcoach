import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // mermaid + jsdom power the server-side diagram syntax validation; they
  // must resolve natively instead of being bundled (DOMPurify needs the
  // jsdom window injected at runtime).
  serverExternalPackages: ["mermaid", "jsdom"],
};

export default nextConfig;
