'use client';

import type { ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI_LAYER_CLASSES } from '@/components/ui/layers';

interface TooltipTextProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

function TooltipBubble({ content }: { content: ReactNode }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side="top" sideOffset={8} className={`${UI_LAYER_CLASSES.tooltip} max-w-[min(24rem,calc(100vw-2rem))]`}>
        <TooltipPrimitive.Popup className="rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-xl shadow-black/10 outline-none transition-[opacity,transform] duration-150 data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0 data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0">
          <TooltipPrimitive.Arrow className="-mb-px size-2.5 rotate-45 border-b border-r border-border/80 bg-popover" />
          {content}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export function InfoHint({ label, content, className }: { label: string; content: ReactNode; className?: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        type="button"
        aria-label={`${label}说明`}
        className={cn('inline-grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground/70 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/35', className)}
      >
        <CircleHelp aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
      </TooltipPrimitive.Trigger>
      <TooltipBubble content={content} />
    </TooltipPrimitive.Root>
  );
}

export function TooltipText({ content, children, className }: TooltipTextProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        render={<span className={cn('min-w-0 truncate text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/35', className)} />}
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipBubble content={content} />
    </TooltipPrimitive.Root>
  );
}
