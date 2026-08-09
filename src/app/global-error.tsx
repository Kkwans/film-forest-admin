"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <head>
        <style>{`
          :root {
            --err-bg: #f6f5ef;
            --err-fg: #1c211d;
            --err-card: #e7eee7;
            --err-muted: #667069;
            --err-accent: #237a46;
            --err-accent-fg: #fff;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --err-bg: #111512;
              --err-fg: #edf0ed;
              --err-card: #1d2720;
              --err-muted: #a3ada5;
              --err-accent: #56b87c;
              --err-accent-fg: #fff;
            }
          }
          .dark {
            --err-bg: #111512;
            --err-fg: #edf0ed;
            --err-card: #1d2720;
            --err-muted: #a3ada5;
            --err-accent: #56b87c;
            --err-accent-fg: #fff;
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
          backgroundColor: "var(--err-bg)",
          color: "var(--err-fg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              backgroundColor: "var(--err-card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
            }}
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--err-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.73 18 13 3a2 2 0 0 0-3.46 0L.82 18A2 2 0 0 0 2.55 21h17.9A2 2 0 0 0 22.18 18Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.75rem",
            }}
          >
            管理后台暂时不可用
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--err-muted)",
              marginBottom: "1.5rem",
              maxWidth: "24rem",
            }}
          >
            应用遇到了无法自动恢复的错误。请刷新后重试；若问题持续，请记录错误编号并检查服务日志。
            {error.digest && (
              <span style={{ display: "block", marginTop: "0.5rem", fontFamily: "monospace" }}>
                错误编号：{error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 2rem",
              borderRadius: "0.75rem",
              border: "none",
              backgroundColor: "var(--err-accent)",
              color: "var(--err-accent-fg)",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            刷新页面
          </button>
        </div>
      </body>
    </html>
  );
}
