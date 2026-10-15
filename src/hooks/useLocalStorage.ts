import { useEffect, useState } from 'react';

/**
 * Drop-in replacement for useState that persists its value to localStorage
 * under `key`, and rehydrates from it on mount. Used for theme preference,
 * calculation history, and saved graph equations.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage may be unavailable (e.g. private browsing quota) — fail silently.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
