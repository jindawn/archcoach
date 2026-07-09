import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareReport } from "@/components/review/ShareReport";
import type { ReviewPayload } from "@/components/review/types";
import { getSessionByShareSlug } from "@/db/repositories/sessions";
import { buildReviewPayload } from "@/lib/review-payload";

export const dynamic = "force-dynamic";

interface ShareParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ShareParams): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSessionByShareSlug(slug);
  if (!session) return { title: "评审报告不存在 — ArchCoach" };
  const payload = await buildReviewPayload(session);
  const title = `${payload?.submission?.title ?? "架构方案"} — 评级 ${session.grade}（${session.overallScore} 分）`;
  const description =
    (payload?.session.summary as { overallAssessment?: string } | null)?.overallAssessment?.slice(
      0,
      120,
    ) ?? "由 ArchCoach AI 架构评审委员会生成的评审报告";
  return {
    title: `${title} — ArchCoach`,
    description,
    openGraph: { title, description, siteName: "ArchCoach" },
  };
}

export default async function SharePage({ params }: ShareParams) {
  const { slug } = await params;
  const session = await getSessionByShareSlug(slug);
  if (!session || session.status !== "completed") notFound();

  const payload = await buildReviewPayload(session);
  if (!payload) notFound();

  // the share page never exposes clarify answers
  const publicPayload = { ...payload, questions: [] };

  return (
    <section aria-labelledby="share-heading">
      <header className="mb-8">
        <p className="font-mono text-xs text-muted-foreground">
          公开评审报告 · 由 ArchCoach 评审委员会生成
        </p>
        <h1 id="share-heading" className="font-display mt-1 text-2xl font-bold">
          {payload.submission?.title}
        </h1>
      </header>

      <ShareReport data={publicPayload as unknown as ReviewPayload} />

      <footer className="mt-12 rounded-lg border border-border/60 bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">
          想让 6 位 AI 评委也评审你的架构方案？
        </p>
        <Link
          href="https://github.com/jindawn/archcoach"
          className="mt-2 inline-block font-display text-primary hover:underline"
        >
          ArchCoach — 开源 · 一条 docker compose up 即可运行 →
        </Link>
      </footer>
    </section>
  );
}
