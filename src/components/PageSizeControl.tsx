'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_LIST_PAGE_SIZE, MIN_LIST_PAGE_SIZE } from '@/hooks/useListPageSize';

interface PageSizeControlProps {
  value: number;
  saving?: boolean;
  onChange: (value: number) => void | Promise<void>;
  className?: string;
}

export function PageSizeControl({ value, saving = false, onChange, className }: PageSizeControlProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const commit = async () => {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < MIN_LIST_PAGE_SIZE || next > MAX_LIST_PAGE_SIZE) {
      setInvalid(true);
      setDraft(String(value));
      return;
    }
    setInvalid(false);
    try {
      await onChange(next);
    } catch {
      setInvalid(true);
      setDraft(String(value));
    }
  };

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <label htmlFor={id} className="whitespace-nowrap">每页</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={MIN_LIST_PAGE_SIZE}
        max={MAX_LIST_PAGE_SIZE}
        step={1}
        value={editing ? draft : String(value)}
        onFocus={() => { setEditing(true); setDraft(String(value)); }}
        onChange={event => { setEditing(true); setDraft(event.target.value); setInvalid(false); }}
        onBlur={() => { void commit().finally(() => setEditing(false)); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-help` : undefined}
        className={cn(
          'h-8 w-[4.25rem] rounded-lg border border-input bg-background px-2 text-center text-sm tabular-nums text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15',
          invalid && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15',
        )}
        title={`请输入 ${MIN_LIST_PAGE_SIZE} 到 ${MAX_LIST_PAGE_SIZE} 条`}
      />
      {saving ? <Loader2 className="size-3.5 animate-spin" aria-label="保存分页偏好" /> : <span className="whitespace-nowrap">条</span>}
      {invalid && <span id={`${id}-help`} className="sr-only">请输入 2 到 100 之间的整数</span>}
      <span className="sr-only">支持输入 2 到 100，偏好会按当前登录账号保存</span>
      <Button type="button" variant="ghost" size="sm" className="sr-only" onClick={() => void commit()}>应用</Button>
    </div>
  );
}
