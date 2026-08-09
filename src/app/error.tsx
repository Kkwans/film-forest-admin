"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[Route Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight">页面暂时无法加载</h2>
      <p className="mb-6 max-w-md text-sm leading-6 text-muted-foreground">
        运行过程中遇到了意外错误。您可以重试当前操作，或返回工作台继续处理其他任务。
        {error.digest && (
          <span className="mt-2 block font-mono text-xs opacity-70">
            错误编号：{error.digest}
          </span>
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={reset}>
          <RefreshCw className="size-4" />
          重试
        </Button>
        <Button
          variant="default"
          onClick={() => router.push("/")}
        >
          <Home className="size-4" />
          返回工作台
        </Button>
      </div>
    </div>
  );
}
