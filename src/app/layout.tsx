import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ArchCoach — AI 架构评审委员会",
  description:
    "提交你的架构方案，6 位 AI 评委追问、评审、打分，产出评审报告、架构图、ADR 和面试讲解稿。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border/70 bg-background/60 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5">
            <Link href="/" className="flex items-baseline gap-2.5">
              <span className="font-display text-lg font-bold tracking-wide text-primary">
                ArchCoach
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                架构评审委员会
              </span>
            </Link>
            <nav aria-label="主导航" className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                评审记录
              </Link>
              <Link
                href="/new"
                className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                发起评审
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
        <footer className="border-t border-border/50 py-5 text-center text-xs text-muted-foreground">
          ArchCoach — 开源的 AI 架构评审委员会 · 本地运行，方案不出你的机器（Ollama 模式）
        </footer>
      </body>
    </html>
  );
}
