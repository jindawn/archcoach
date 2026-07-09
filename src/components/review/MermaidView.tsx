"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidViewProps {
  source: string;
  renderRisk?: boolean;
}

let mermaidReady: Promise<typeof import("mermaid")> | null = null;

function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((mod) => {
      mod.default.initialize({ startOnLoad: false, theme: "dark", darkMode: true });
      return mod;
    });
  }
  return mermaidReady;
}

/** 客户端渲染 mermaid；渲染失败时回退展示源码 */
export function MermaidView({ source, renderRisk }: MermaidViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.default.render(id, source);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (failed || renderRisk) {
    return (
      <div>
        {!failed && renderRisk && <DiagramFallbackNote />}
        {failed && <DiagramFallbackNote />}
        <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-xs leading-relaxed">
          {source}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto rounded-lg border border-border bg-card p-4 [&_svg]:mx-auto [&_svg]:max-w-full"
    />
  );
}

function DiagramFallbackNote() {
  return (
    <p className="mb-3 rounded-md border border-severity-medium/40 bg-severity-medium/10 px-3 py-2 text-xs text-severity-medium">
      该图的源码未通过语法校验，以下展示原始源码。你可以复制到 mermaid.live 手动修正。
    </p>
  );
}
