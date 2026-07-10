"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AuthControls({ email }: { email: string }) {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">{email}</span>
      <Button variant="ghost" size="sm" onClick={logout}>退出</Button>
    </div>
  );
}
