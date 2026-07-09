import { cn } from "@/lib/utils";

const GRADE_COLORS: Record<string, string> = {
  S: "text-grade-s border-grade-s",
  A: "text-grade-a border-grade-a",
  B: "text-grade-b border-grade-b",
  C: "text-grade-c border-grade-c",
  D: "text-grade-d border-grade-d",
};

interface GradeStampProps {
  grade: string;
  score?: number | null;
  size?: "sm" | "lg";
  animate?: boolean;
  className?: string;
}

/** 评审等级印章：仿公文批注的旋转圆章 */
export function GradeStamp({ grade, score, size = "sm", animate = false, className }: GradeStampProps) {
  const color = GRADE_COLORS[grade] ?? GRADE_COLORS.D;
  return (
    <span
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-full border-2 font-display font-bold -rotate-6 select-none",
        color,
        size === "lg" ? "h-24 w-24 border-[3px]" : "h-10 w-10 text-sm",
        animate && "animate-stamp",
        className,
      )}
      aria-label={`评级 ${grade}${score != null ? `，${score} 分` : ""}`}
    >
      <span className={size === "lg" ? "text-4xl leading-none" : "leading-none"}>{grade}</span>
      {size === "lg" && score != null && (
        <span className="mt-0.5 font-mono text-xs font-normal opacity-80">{score}</span>
      )}
    </span>
  );
}
