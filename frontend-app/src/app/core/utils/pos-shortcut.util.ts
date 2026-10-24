export const PosShortcutAction = {
  SAVE_AND_PRINT: 'SAVE_AND_PRINT',
  SAVE: 'SAVE',
  PAY_CASH: 'PAY_CASH',
  PAY_CARD: 'PAY_CARD',
  PAY_ONLINE: 'PAY_ONLINE',
  HOLD: 'HOLD',
  NEW_BILL: 'NEW_BILL',
} as const;

export type PosShortcutAction = (typeof PosShortcutAction)[keyof typeof PosShortcutAction];

export const POS_SHORTCUT_KEYS: Record<PosShortcutAction, string> = {
  SAVE_AND_PRINT: 'F1',
  SAVE: 'F2',
  PAY_CASH: 'F3',
  PAY_CARD: 'F4',
  PAY_ONLINE: 'F7',
  HOLD: 'F10',
  NEW_BILL: 'F12',
};

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function shortcutActionFor(event: ShortcutKeyEvent): PosShortcutAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  const match = (Object.keys(POS_SHORTCUT_KEYS) as PosShortcutAction[]).find(
    action => POS_SHORTCUT_KEYS[action] === event.key
  );
  return match ?? null;
}
