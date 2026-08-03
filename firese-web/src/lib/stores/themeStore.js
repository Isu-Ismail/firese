import { writable } from 'svelte/store';

/**
 * @typedef {'dark' | 'light' | 'system'} ThemeMode
 */

const STORAGE_KEY = 'firese_theme';

/**
 * @returns {ThemeMode}
 */
function getSavedTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'dark';
}

/** @type {import('svelte/store').Writable<ThemeMode>} */
export const themeStore = writable(getSavedTheme());

/**
 * @param {ThemeMode} theme
 */
export function setTheme(theme) {
  themeStore.set(theme);
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEY, theme);

  const root = document.documentElement;
  root.classList.remove('dark', 'light');

  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(systemDark ? 'dark' : 'light');
  } else {
    root.classList.add(theme);
  }
}

// Initialize theme on load
if (typeof window !== 'undefined') {
  const current = getSavedTheme();
  setTheme(current);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    themeStore.subscribe((theme) => {
      if (theme === 'system') {
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        root.classList.add(e.matches ? 'dark' : 'light');
      }
    })();
  });
}
