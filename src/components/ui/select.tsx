'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI_LAYER_CLASSES } from '@/components/ui/layers';
import {
  filterSelectOptions,
  getNextOptionIndex,
  STABLE_POPUP_TRANSITION_CLASS,
} from '@/components/ui/interaction-contracts';

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
  label?: string;
}

interface OptionsPopupProps {
  options: SelectOption[];
  selectedValues: string[];
  searchable: boolean;
  compact?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  finalFocus: React.RefObject<HTMLElement | null>;
  size: 'sm' | 'default';
}

function OptionsPopup({ options, selectedValues, searchable, compact = false, search, onSearchChange, searchRef, finalFocus, size }: OptionsPopupProps) {
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
        <SelectPrimitive.Popup
          ref={popupRef}
          finalFocus={finalFocus}
          className={`origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl outline-none ${STABLE_POPUP_TRANSITION_CLASS} data-[starting-style]:opacity-0 data-[ending-style]:opacity-0`}
        >
          {searchable && (
            <div className="border-b border-border p-2">
              <label className="relative block">
                <span className="sr-only">搜索选项</span>
                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
          <SelectPrimitive.List className={cn(
            'max-h-[min(18rem,var(--available-height))] overflow-y-auto p-1.5',
            compact && 'flex flex-wrap content-start gap-2 p-3',
          )}>
            {filtered.length === 0 ? (
              <p className="w-full px-3 py-6 text-center text-sm text-muted-foreground">没有匹配选项</p>
            ) : (
              filtered.map(option => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  disabled={option.disabled}
                  className={cn(
                    'min-w-0 cursor-default items-center gap-1.5 outline-none select-none',
                    compact
                      ? 'inline-flex min-h-8 w-auto shrink-0 rounded-full border border-border bg-background px-3 text-sm font-medium'
                      : 'grid grid-cols-[minmax(0,1fr)_auto] rounded-lg px-2',
                    compact ? '' : size === 'sm' ? 'min-h-8 text-xs' : 'min-h-9 text-sm',
                    'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
                    compact && 'data-[selected]:border-primary/35 data-[selected]:bg-primary/10 data-[selected]:text-primary',
                  )}
                >
                  <SelectPrimitive.ItemText className={compact ? 'whitespace-nowrap' : 'min-w-0 truncate'}>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="text-primary">
                    <Check aria-hidden="true" className="size-4" strokeWidth={2.2} />
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
  label,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open || !searchable) return undefined;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, searchable]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
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
        {label && <SelectPrimitive.Label className="sr-only">{label}</SelectPrimitive.Label>}
        <SelectPrimitive.Trigger
          ref={triggerRef}
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
          <SelectPrimitive.Icon className="ml-auto shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none data-[popup-open]:rotate-180">
            <ChevronDown aria-hidden="true" className="size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <OptionsPopup
          options={options}
          selectedValues={value ? [value] : []}
          searchable={searchable}
          search={search}
          onSearchChange={setSearch}
          searchRef={searchRef}
          finalFocus={triggerRef}
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
  label?: string;
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = '请选择',
  searchable = false,
  disabled = false,
  className,
  label,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const selected = options.filter(option => value.includes(option.value));

  useEffect(() => {
    if (!open || !searchable) return undefined;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, searchable]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
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
        {label && <SelectPrimitive.Label className="sr-only">{label}</SelectPrimitive.Label>}
        <SelectPrimitive.Trigger
          ref={element => { triggerRef.current = element; }}
          nativeButton={false}
          render={<div />}
          className="flex min-h-10 w-full items-start justify-between gap-2 rounded-xl border border-input bg-background px-3 py-1.5 text-left text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] hover:border-muted-foreground/55 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55"
        >
          <div className="flex max-h-16 min-w-0 flex-1 flex-wrap content-start items-center gap-1 overflow-y-auto pr-1">
            {selected.length === 0 ? (
              <span className="py-1 text-muted-foreground">{placeholder}</span>
            ) : selected.map(option => (
              <span key={option.value} className="inline-flex max-w-full items-center gap-0.5 rounded-lg border border-primary/15 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                <span className="truncate">{option.label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onPointerDown={event => event.stopPropagation()}
                    onClick={event => {
                      event.stopPropagation();
                      onChange?.(value.filter(item => item !== option.value));
                    }}
                    onKeyDown={event => event.stopPropagation()}
                    className="shrink-0 rounded-md p-0.5 text-primary/65 transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    aria-label={`移除${option.label}`}
                    title={`移除${option.label}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          <SelectPrimitive.Icon className="mt-1 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none data-[popup-open]:rotate-180">
            <ChevronDown aria-hidden="true" className="size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <OptionsPopup
          options={options}
          selectedValues={value}
          searchable={searchable}
          compact
          search={search}
          onSearchChange={setSearch}
          searchRef={searchRef}
          finalFocus={triggerRef}
          size="default"
        />
      </SelectPrimitive.Root>
    </div>
  );
}
