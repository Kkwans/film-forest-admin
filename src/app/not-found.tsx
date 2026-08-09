"use client";

import Link from "next/link";
import { ArrowLeft, Home, MapPinned } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-md space-y-6 px-4 text-center">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MapPinned className="size-7" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-[0.18em] text-primary">404</p>
          <h1 className="text-2xl font-semibold tracking-tight">没有找到这个页面</h1>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          当前地址可能已经失效，或您没有可用的入口。请返回工作台后从导航重新进入。
        </p>

        <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
          <Link
            href="/"
            className={buttonVariants()}
          >
            <Home className="size-4" />
            返回工作台
          </Link>
          <button
            onClick={() => window.history.back()}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft className="size-4" />
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}
