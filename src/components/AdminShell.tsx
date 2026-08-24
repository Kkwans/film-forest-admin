'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname.startsWith('/login');

  if (isPublicRoute) {
    return (
      <main id="main-content" className="min-h-dvh bg-background">
        {children}
      </main>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <div className="app-shell flex h-dvh overflow-hidden">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdminHeader />
          <main id="main-content" tabIndex={-1} className="app-main min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
