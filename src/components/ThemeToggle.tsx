'use client';

import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Theme = 'light' | 'dark' | 'system';

const THEME_LABELS: Record<Theme, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
};

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = theme === 'light' || theme === 'dark' ? theme : 'system';
  const ResolvedIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-9 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/30 data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground"
        aria-label={`切换主题，当前${THEME_LABELS[currentTheme]}`}
        title={`外观：${THEME_LABELS[currentTheme]}`}
      >
        <ResolvedIcon className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>外观</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentTheme} onValueChange={value => setTheme(value as Theme)}>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            跟随系统
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun />
            浅色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            深色
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
