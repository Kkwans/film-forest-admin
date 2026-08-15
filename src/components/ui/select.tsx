'use client';

import { useMemo, useRef, useState } from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI_LAYER_CLASSES } from '@/components/ui/layers';
import { filterSelectOptions, getNextOptionIndex } from '@/components/ui/interaction-contracts';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

interface OptionsPopupProps {
  options: SelectOption[];
  selectedValues: string[];
  searchable: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  size: 'sm' | 'default';
}

function OptionsPopup({ options, selectedValues, searchable, search, onSearchChange, searchRef, size }: OptionsPopupProps) {
  const filtered = useMemo(
    () => filterSelectOptions(options, search, selectedValues),
    [options, search, selectedValues],
  );

  const popupRef = useRef<HTMLDivElement>(null);

  const focusOption = (direction: 'next' | 'previous') => {
    const items = Array.from(
      popupRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    ).filter(item => item.getAttribute('aria-disabled') !== 'true');
    if (items.length === 0) return;
    const activeIndex = items.findIndex(item => item.dataset.highlighted !== undefined || item.tabIndex === 0);
    const nextIndex = getNextOptionIndex(items.length, activeIndex, direction);
    items[nextIndex]?.focus();
  };

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        sideOffset={6}
        align="start"
        alignItemWithTrigger={false}
        className={`${UI_LAYER_CLASSES.popover} w-[var(--anchor-width)] min-w-44 max-w-[calc(100vw-1.5rem)]`}
      >
        <SelectPrimitive.Popup ref={popupRef} className="origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl outline-none transition-[transform,opacity] duration-150 motion-reduce:transition-none data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0">
          {searchable && (
            <div className="border-b border-border p-2">
              <label className="relative block">
                <span className="sr-only">搜索选项</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={event => onSearchChange(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      focusOption('next');
                      return;
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      focusOption('previous');
                      return;
                    }
                    if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation();
                  }}
                  placeholder="搜索选项"
                  className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </label>
            </div>
          )}
          <SelectPrimitive.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">没有匹配选项</p>
            ) : (
              filtered.map(option => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  disabled={option.disabled}
                  className={cn(
                    'grid cursor-default grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-2.5 outline-none select-none',
                    size === 'sm' ? 'min-h-8 text-xs' : 'min-h-9 text-sm',
                    'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
                  )}
                >
                  <SelectPrimitive.ItemText className="truncate">{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="text-primary">
                    <Check className="size-4" strokeWidth={2.2} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))
            )}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function Select({
  options,
  value,
  onChange,
  placeholder = '请选择',
  searchable = false,
  clearable = false,
  disabled = false,
  className,
  size = 'default',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find(option => option.value === value);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
    } else if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  };

  return (
    <div className={cn('relative', className)}>
      <SelectPrimitive.Root
        items={options}
        value={value || null}
        onValueChange={nextValue => onChange?.(nextValue ?? '')}
        open={open}
        onOpenChange={handleOpenChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 text-left text-foreground outline-none transition-[border-color,box-shadow,background-color]',
            size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
            clearable && selected && 'pr-16',
            'hover:border-muted-foreground/55 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} className="min-w-0 truncate data-[placeholder]:text-muted-foreground">
            {() => selected?.label ?? placeholder}
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon className="ml-auto shrink-0 text-muted-foreground transition-transform data-[popup-open]:rotate-180">
            <ChevronDown className="size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <OptionsPopup
          options={options}
          selectedValues={value ? [value] : []}
          searchable={searchable}
          search={search}
          onSearchChange={setSearch}
          searchRef={searchRef}
          size={size}
        />
      </SelectPrimitive.Root>
      {clearable && selected && !disabled && (
        <button
          type="button"
          onClick={() => onChange?.('')}
          className="absolute right-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`清除${selected.label}`}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

interface MultiSelectProps {
  options: SelectOption[];
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  maxDisplay?: number;
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = '请选择',
  searchable = false,
  disabled = false,
  className,
  maxDisplay = 3,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.filter(option => value.includes(option.value));
  const visibleLabels = selected.slice(0, maxDisplay).map(option => option.label);
  const hiddenCount = Math.max(0, selected.length - maxDisplay);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
    } else if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  };

  return (
    <div className={cn('relative', className)}>
      <SelectPrimitive.Root
        multiple
        items={options}
        value={value}
        onValueChange={nextValue => onChange?.(nextValue)}
        open={open}
        onOpenChange={handleOpenChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger className="flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-1.5 text-left text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] hover:border-muted-foreground/55 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55">
          <SelectPrimitive.Value placeholder={placeholder} className="min-w-0 flex-1 truncate data-[placeholder]:text-muted-foreground">
            {() => selected.length === 0
              ? placeholder
              : `${visibleLabels.join('、')}${hiddenCount > 0 ? `，另 ${hiddenCount} 项` : ''}`}
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon className="shrink-0 text-muted-foreground transition-transform data-[popup-open]:rotate-180">
            <ChevronDown className="size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <OptionsPopup
          options={options}
          selectedValues={value}
          searchable={searchable}
          search={search}
          onSearchChange={setSearch}
          searchRef={searchRef}
          size="default"
        />
      </SelectPrimitive.Root>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="已选择项目">
          {selected.map(option => (
            <span key={option.value} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
              {option.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange?.(value.filter(item => item !== option.value))}
                  className="rounded text-accent-foreground/65 transition-colors hover:text-accent-foreground"
                  aria-label={`移除${option.label}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
