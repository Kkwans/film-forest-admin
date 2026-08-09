'use client';

import { type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

const WIDTH_MAP = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-4xl',
};

export function Modal({ open, onClose, title, description, children, width = 'md', footer }: ModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[75] bg-black/45 backdrop-blur-[2px] transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-[76] flex items-end justify-center md:items-center md:p-4">
          <DialogPrimitive.Popup
            className={cn(
              'relative flex h-dvh w-full flex-col bg-popover text-popover-foreground shadow-2xl outline-none',
              'transition-[transform,opacity] duration-200 data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0 data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0',
              'md:h-auto md:max-h-[min(88dvh,56rem)] md:rounded-2xl md:border md:border-border md:data-[starting-style]:translate-y-0 md:data-[starting-style]:scale-[0.98] md:data-[ending-style]:translate-y-0 md:data-[ending-style]:scale-[0.98]',
              WIDTH_MAP[width],
            )}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-muted/30 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:py-5">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className={cn('text-lg font-semibold tracking-tight text-foreground', !title && 'sr-only')}>
                  {title || '对话框'}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="mt-1 text-sm leading-5 text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="关闭对话框">
                <X className="size-4" />
              </DialogPrimitive.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-5">
              {children}
            </div>
            {footer && (
              <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-popover/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:flex-row sm:justify-end md:px-6 md:py-4">
                {footer}
              </footer>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
