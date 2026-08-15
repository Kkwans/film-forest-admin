'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI_LAYER_CLASSES } from '@/components/ui/layers';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  count: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const MAX_VISIBLE_TOASTS = 4;

const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    shell: 'border-success/30 bg-card',
    iconClass: 'bg-success/12 text-success',
  },
  error: {
    icon: AlertCircle,
    shell: 'border-destructive/35 bg-card',
    iconClass: 'bg-destructive/12 text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    shell: 'border-warning/40 bg-card',
    iconClass: 'bg-warning/16 text-warning-foreground dark:text-warning',
  },
  info: {
    icon: Info,
    shell: 'border-info/30 bg-card',
    iconClass: 'bg-info/12 text-info',
  },
} satisfies Record<ToastType, { icon: typeof Info; shell: string; iconClass: string }>;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts(previous => previous.filter(item => item.id !== id));
  }, []);

  useEffect(() => () => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return;

    const id = `${type}:${normalizedMessage}`;
    const actualDuration = duration ?? (type === 'error' ? 6000 : 3500);

    setToasts(previous => {
      const existing = previous.find(item => item.id === id);
      const nextItem: ToastItem = {
        id,
        type,
        message: normalizedMessage,
        count: (existing?.count ?? 0) + 1,
      };
      const withoutExisting = previous.filter(item => item.id !== id);
      return [...withoutExisting, nextItem].slice(-MAX_VISIBLE_TOASTS);
    });

    const existingTimer = timersRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);
    if (actualDuration > 0) {
      timersRef.current.set(id, setTimeout(() => remove(id), actualDuration));
    }
  }, [remove]);

  const success = useCallback((message: string, duration?: number) => toast(message, 'success', duration), [toast]);
  const error = useCallback((message: string, duration?: number) => toast(message, 'error', duration), [toast]);
  const warning = useCallback((message: string, duration?: number) => toast(message, 'warning', duration), [toast]);
  const info = useCallback((message: string, duration?: number) => toast(message, 'info', duration), [toast]);
  const value = useMemo<ToastContextValue>(() => ({ toast, success, error, warning, info }), [error, info, success, toast, warning]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section
        className={`pointer-events-none fixed inset-x-4 top-4 ${UI_LAYER_CLASSES.toast} ml-auto flex max-w-sm flex-col gap-2 md:left-auto md:right-4`}
        aria-label="系统通知"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map(item => {
          const styles = TOAST_STYLES[item.type];
          const Icon = styles.icon;
          const isAssertive = item.type === 'error';
          return (
            <div
              key={item.id}
              role={isAssertive ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-3 text-foreground shadow-xl backdrop-blur-xl',
                'animate-in fade-in slide-in-from-top-2 duration-150',
                styles.shell,
              )}
            >
              <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', styles.iconClass)}>
                <Icon className="size-4" />
              </span>
              <p className="min-w-0 flex-1 break-words pt-1 text-sm leading-5">
                {item.message}
                {item.count > 1 && (
                  <span className="ml-2 inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    ×{item.count}
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭通知"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
