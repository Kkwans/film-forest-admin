'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  const applyTheme = (t: Theme) => {
    localStorage.setItem('theme', t);
    // Use global function if available (from layout script)
    if (typeof window !== 'undefined' && (window as any).__applyTheme) {
      (window as any).__applyTheme(t);
    } else {
      const root = document.documentElement;
      if (t === 'dark') root.classList.add('dark');
      else if (t === 'light') root.classList.remove('dark');
      else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
      }
    }
  };

  const cycleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  const btnClass = "size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center";

  if (!mounted) {
    return <button type="button" className={btnClass} aria-label="切换主题"><Sun className="w-5 h-5" /></button>;
  }

  return (
    <button type="button" onClick={cycleTheme} className={btnClass} aria-label="切换主题"
      title={theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}>
      {theme === 'light' && <Sun className="w-5 h-5" />}
      {theme === 'dark' && <Moon className="w-5 h-5" />}
      {theme === 'system' && <Monitor className="w-5 h-5" />}
    </button>
  );
}
