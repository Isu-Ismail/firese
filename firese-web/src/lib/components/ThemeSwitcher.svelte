<script>
  import { themeStore, setTheme } from '../stores/themeStore.js';
  import { Moon, Sun, Monitor } from '@lucide/svelte';

  /**
   * @param {import('../stores/themeStore.js').ThemeMode} mode
   */
  function handleSelect(mode) {
    setTheme(mode);
  }
</script>

<div class="flex items-center space-x-1 p-1 bg-dark-surface rounded-xl">
  <button
    type="button"
    on:click={() => handleSelect('dark')}
    title="Dark Theme"
    aria-label="Dark Theme"
    class="p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer
      {$themeStore === 'dark' ? 'bg-fire-500 text-white-force shadow-md' : 'text-gray-400 hover:text-fire-500'}"
  >
    <Moon class="w-3.5 h-3.5" />
  </button>

  <button
    type="button"
    on:click={() => handleSelect('light')}
    title="Light Theme"
    aria-label="Light Theme"
    class="p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer
      {$themeStore === 'light' ? 'bg-fire-500 text-white-force shadow-md' : 'text-gray-400 hover:text-fire-500'}"
  >
    <Sun class="w-3.5 h-3.5" />
  </button>

  <button
    type="button"
    on:click={() => handleSelect('system')}
    title="System Theme"
    aria-label="System Theme"
    class="p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer
      {$themeStore === 'system' ? 'bg-fire-500 text-white-force shadow-md' : 'text-gray-400 hover:text-fire-500'}"
  >
    <Monitor class="w-3.5 h-3.5" />
  </button>
</div>
