import type { Metadata } from "next";
import "./globals.css";
import AdminShell from "@/components/AdminShell";
import PageTitle from "@/components/PageTitle";
import { Providers } from "@/components/providers";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "影视森林 - 管理后台",
  description: "影视森林内容管理/爬虫任务管理/数据维护",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground antialiased">
        <ThemeProvider>
          <Providers>
            <AuthProvider>
              <PageTitle />
              <AdminShell>{children}</AdminShell>
            </AuthProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
