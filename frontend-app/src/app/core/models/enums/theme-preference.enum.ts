export const ThemePreference = {
  LIGHT: 'LIGHT',
  DARK: 'DARK',
} as const;

export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference];
