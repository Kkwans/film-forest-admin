export const REDUCED_MOTION_TRANSITION_CLASS = 'motion-reduce:transition-none';
export const STABLE_TRIGGER_TRANSITION_CLASS = 'transition-[color,background-color,border-color,box-shadow]';
export const STABLE_POPUP_TRANSITION_CLASS = `transition-opacity duration-150 ${REDUCED_MOTION_TRANSITION_CLASS}`;
export const MODAL_SHELL_GEOMETRY_CLASS = 'overflow-hidden rounded-2xl';

export function filterSelectOptions<T extends { label: string; value: string }>(
  options: readonly T[],
  search: string,
  selectedValues: readonly string[],
): T[] {
  const query = search.trim().toLocaleLowerCase('zh-CN');
  if (!query) return [...options];

  const matching = options.filter(option => option.label.toLocaleLowerCase('zh-CN').includes(query));
  const selected = options.filter(option => selectedValues.includes(option.value));
  return [...matching, ...selected.filter(option => !matching.some(item => item.value === option.value))];
}

export function getNextOptionIndex(
  itemCount: number,
  activeIndex: number,
  direction: 'next' | 'previous',
): number {
  if (itemCount <= 0) return -1;
  const currentIndex = activeIndex >= 0 && activeIndex < itemCount
    ? activeIndex
    : direction === 'next' ? -1 : itemCount;
  return direction === 'next'
    ? Math.min(currentIndex + 1, itemCount - 1)
    : Math.max(currentIndex - 1, 0);
}

export const ACCORDION_PANEL_BASE_CLASS = `grid min-w-0 overflow-hidden transition-[grid-template-rows,opacity] duration-200 ${REDUCED_MOTION_TRANSITION_CLASS}`;

export function getAccordionPanelClass(open: boolean): string {
  return `${ACCORDION_PANEL_BASE_CLASS} ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`;
}
