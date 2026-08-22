'use client';

import { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { DialogProvider } from '@/components/ui/dialog';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DialogProvider>
      <TooltipPrimitive.Provider delay={0} closeDelay={100}>
          {children}
        </TooltipPrimitive.Provider>
      </DialogProvider>
    </ToastProvider>
  );
}
