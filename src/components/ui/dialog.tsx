'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { AlertTriangle, HelpCircle, Info, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogOptions {
  title?: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning';
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface DialogContextValue {
  confirm: (options: DialogOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

const VARIANT_STYLES = {
  default: {
    icon: HelpCircle,
    iconClass: 'bg-muted text-muted-foreground',
    buttonClass: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
  danger: {
    icon: AlertTriangle,
    iconClass: 'bg-destructive/10 text-destructive',
    buttonClass: 'bg-destructive text-white hover:bg-destructive/90',
  },
  warning: {
    icon: Info,
    iconClass: 'bg-warning/15 text-warning-foreground dark:text-warning',
    buttonClass: 'bg-warning text-warning-foreground hover:bg-warning/90',
  },
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => new Promise(resolve => {
    setDialog(options);
    setIsOpen(true);
    resolveRef.current = resolve;
  }), []);

  const alert = useCallback((message: string, title?: string): Promise<void> => new Promise(resolve => {
    setDialog({ content: message, title, confirmText: '确定' });
    setIsOpen(true);
    resolveRef.current = () => resolve();
  }), []);

  const finishClose = useCallback((confirmed: boolean) => {
    const current = dialog;
    if (!confirmed) current?.onCancel?.();
    setIsOpen(false);
    setDialog(null);
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
  }, [dialog]);

  const handleClose = useCallback(async (confirmed: boolean) => {
    if (loading) return;
    if (confirmed && dialog?.onConfirm) {
      setLoading(true);
      try {
        await dialog.onConfirm();
      } catch {
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    finishClose(confirmed);
  }, [dialog, finishClose, loading]);

  const variant = dialog?.variant ?? 'default';
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;
  const accessibleTitle = dialog?.title || (variant === 'danger' ? '确认危险操作' : '请确认');

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      <DialogPrimitive.Root
        open={isOpen}
        onOpenChange={open => {
          if (!open) void handleClose(false);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <DialogPrimitive.Viewport className="fixed inset-0 z-[81] flex items-center justify-center p-4">
            {dialog && (
              <DialogPrimitive.Popup
                initialFocus={confirmButtonRef}
                className="w-full max-w-md origin-center overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none transition-[transform,opacity] duration-150 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0"
              >
                <div className="flex items-start gap-4 px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
                  <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', styles.iconClass)}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-foreground">
                      {accessibleTitle}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {dialog.content}
                    </DialogPrimitive.Description>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleClose(false)}
                    disabled={loading}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    aria-label="关闭对话框"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/35 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                  {dialog.cancelText && (
                    <button
                      type="button"
                      onClick={() => void handleClose(false)}
                      disabled={loading}
                      className="h-9 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {dialog.cancelText}
                    </button>
                  )}
                  <button
                    ref={confirmButtonRef}
                    type="button"
                    onClick={() => void handleClose(true)}
                    disabled={loading}
                    className={cn('flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60', styles.buttonClass)}
                  >
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    {loading ? '处理中' : (dialog.confirmText || '确定')}
                  </button>
                </div>
              </DialogPrimitive.Popup>
            )}
          </DialogPrimitive.Viewport>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}
