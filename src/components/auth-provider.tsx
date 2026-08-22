'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  username: string;
  role: 'USER' | 'ADMIN';
  nickname?: string;
  adminSidebarCollapsed?: boolean;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ['/login'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
      return;
    }

    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      router.push('/login');
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 200) {
          setUser(data.data);
          setToken(savedToken);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  useEffect(() => {
    const refreshUser = async () => {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) return;
      try {
        const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } });
        const data = await response.json();
        if (data.code === 200) {
          setUser(data.data);
          setToken(savedToken);
          localStorage.setItem('user', JSON.stringify(data.data));
        }
      } catch {
        // 账号资料刷新失败不打断当前页面，下一次路径切换会再次校验。
      }
    };
    window.addEventListener('filmforest:auth-changed', refreshUser);
    return () => window.removeEventListener('filmforest:auth-changed', refreshUser);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      router.replace('/login');
    };
    window.addEventListener('film-forest:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('film-forest:unauthorized', handleUnauthorized);
  }, [router]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return <AuthContext.Provider value={{ user, token, logout, loading: false }}>{children}</AuthContext.Provider>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, token, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
