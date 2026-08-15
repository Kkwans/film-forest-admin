/**
 * Shared stacking order for the admin UI overlays.
 *
 * Popovers deliberately sit above modal content so a Select opened inside a
 * Modal remains usable. Confirmation dialogs and toasts stay above both.
 */
export const UI_LAYER_CLASSES = {
  sidebarTrigger: 'z-50',
  sidebar: 'z-[51]',
  modalBackdrop: 'z-[100]',
  modal: 'z-[150]',
  popover: 'z-[250]',
  dialogBackdrop: 'z-[300]',
  dialog: 'z-[350]',
  toast: 'z-[400]',
} as const;

export const UI_LAYER_VALUES = {
  sidebarTrigger: 50,
  sidebar: 51,
  modalBackdrop: 100,
  modal: 150,
  popover: 250,
  dialogBackdrop: 300,
  dialog: 350,
  toast: 400,
} as const;

export type UiLayer = keyof typeof UI_LAYER_VALUES;

export function isLayerAbove(upper: UiLayer, lower: UiLayer): boolean {
  return UI_LAYER_VALUES[upper] > UI_LAYER_VALUES[lower];
}
