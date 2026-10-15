import { createContext, useContext } from 'react';

export type Theme = 'dark' | 'light';

export const ThemeContext = createContext<Theme>('dark');

/** Convenience hook — components call useTheme() instead of importing the context directly. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
