'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
      <TooltipPrimitive.Positioner side="top" sideOffset={8} className={`${UI_LAYER_CLASSES.tooltip} pointer-events-none max-w-[min(36rem,calc(100vw-2rem))]`}>
        <TooltipPrimitive.Popup className="relative w-max max-w-[min(36rem,calc(100vw-2rem))] overflow-visible rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-xl shadow-black/10 outline-none transition-[opacity,transform] duration-100 data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0 data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0">
          <TooltipPrimitive.Arrow className="pointer-events-none absolute -bottom-1 left-1/2 z-0 size-2.5 -translate-x-1/2 rotate-45 border-b border-r border-border/80 bg-popover" />
          <span className="relative z-[1] whitespace-normal break-words [overflow-wrap:anywhere]">{content}</span>
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
        delay={0}
        closeDelay={80}
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
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const updateOverflow = () => {
      setIsOverflowing(trigger.scrollWidth > trigger.clientWidth + 1 || trigger.scrollHeight > trigger.clientHeight + 1);
    };
    const frame = window.requestAnimationFrame(updateOverflow);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflow);
    observer?.observe(trigger);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [children, className, content]);

  const trigger = (
    <span ref={triggerRef} className={cn('block min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/35', className)}>
      {children}
    </span>
  );

  if (!isOverflowing) return trigger;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        delay={0}
        closeDelay={80}
        render={trigger}
      >
      </TooltipPrimitive.Trigger>
      <TooltipBubble content={content} />
    </TooltipPrimitive.Root>
  );
}
