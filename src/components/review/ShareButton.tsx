"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  sessionId: string;
  shareSlug: string | null | undefined;
  onChanged: () => void;
}

export function ShareButton({ sessionId, shareSlug, onChanged }: ShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async (slug: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/reviews/${sessionId}/share`, { method: "POST" });
      const body = await response.json();
      if (body.success) {
        await copyLink(body.data.slug);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await fetch(`/api/reviews/${sessionId}/share`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (shareSlug) {
    return (
      <span className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => copyLink(shareSlug)} disabled={busy}>
          {copied ? "已复制链接" : "复制分享链接"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={revoke}
          disabled={busy}
        >
          取消分享
        </Button>
      </span>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={enable} disabled={busy}>
      {busy ? "生成链接…" : copied ? "已复制链接" : "分享报告"}
    </Button>
  );
}
