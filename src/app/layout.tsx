import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AdminSidebar from "@/components/AdminSidebar";
import AdminHeader from "@/components/AdminHeader";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="zh-CN" className="h-full">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var root=document.documentElement;function apply(t){if(t==='dark'){root.classList.add('dark')}else if(t==='light'){root.classList.remove('dark')}else{var mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.matches){root.classList.add('dark')}else{root.classList.remove('dark')}mq.addEventListener('change',function(e){var cur=localStorage.getItem('theme');if(cur==='system'){if(e.matches){root.classList.add('dark')}else{root.classList.remove('dark')}}})}}var t=localStorage.getItem('theme');apply(t||'dark');window.__applyTheme=apply})()`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-full bg-background text-foreground`}>
        <div className="flex h-screen overflow-hidden">
          <AdminSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <AdminHeader />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}