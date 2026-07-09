"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./Markdown";
import { MermaidView } from "./MermaidView";
import type { ReviewPayload } from "./types";

const TYPE_LABEL: Record<string, string> = {
  c4_diagram: "架构图",
  adr: "架构决策记录",
  interview_script: "面试讲解稿",
};

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ArtifactsPanel({
  artifacts,
  submissionTitle,
}: {
  artifacts: ReviewPayload["artifacts"];
  submissionTitle: string;
}) {
  const ordered = ["c4_diagram", "adr", "interview_script"]
    .map((type) => artifacts.find((artifact) => artifact.type === type))
    .filter((artifact): artifact is ReviewPayload["artifacts"][number] => Boolean(artifact));
  const [activeId, setActiveId] = useState<string | null>(ordered[0]?.id ?? null);

  if (ordered.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">产物尚未生成。</p>;
  }

  const active = ordered.find((artifact) => artifact.id === activeId) ?? ordered[0];

  const exportAll = () => {
    const combined = ordered
      .map((artifact) => {
        const body =
          artifact.type === "c4_diagram"
            ? `\`\`\`mermaid\n${artifact.content}\n\`\`\``
            : artifact.content;
        return `# ${artifact.title}\n\n${body}`;
      })
      .join("\n\n---\n\n");
    downloadMarkdown(`${submissionTitle}-评审产物.md`, combined);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {ordered.map((artifact) => (
          <button
            key={artifact.id}
            onClick={() => setActiveId(artifact.id)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              active.id === artifact.id
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {TYPE_LABEL[artifact.type] ?? artifact.type}
          </button>
        ))}
        <span className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadMarkdown(
              `${submissionTitle}-${TYPE_LABEL[active.type]}.md`,
              active.type === "c4_diagram"
                ? `\`\`\`mermaid\n${active.content}\n\`\`\``
                : active.content,
            )
          }
        >
          下载此篇
        </Button>
        <Button variant="outline" size="sm" onClick={exportAll}>
          全部导出
        </Button>
      </div>

      <h3 className="font-display mb-4 text-lg font-bold">{active.title}</h3>
      {active.type === "c4_diagram" ? (
        <MermaidView source={active.content} renderRisk={active.meta?.renderRisk} />
      ) : (
        <Markdown content={active.content} />
      )}
    </div>
  );
}
