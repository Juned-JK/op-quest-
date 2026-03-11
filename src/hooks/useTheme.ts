import { useState, useCallback, useEffect } from 'react';

export type Theme = 'dark' | 'eye' | 'light';

const STORAGE_KEY = 'op_quest_theme';
const CYCLE: Theme[] = ['dark', 'eye', 'light'];

function sanitize(raw: string | null): Theme {
  if (raw === 'light' || raw === 'eye' || raw === 'dark') return raw;
  return 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = sanitize(localStorage.getItem(STORAGE_KEY));
    // Apply immediately so there's no flash on first render
    document.documentElement.setAttribute('data-theme', initial);
    return initial;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Cycles: dark → mid → light → dark
  const toggle = useCallback(() => {
    setTheme((t) => {
      const idx = CYCLE.indexOf(t);
      return CYCLE[(idx + 1) % CYCLE.length];
    });
  }, []);

  return { theme, toggle };
}
