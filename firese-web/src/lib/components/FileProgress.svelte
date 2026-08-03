<script>
  import { roomStore } from '../stores/roomStore.js';
  import { CheckCircle2, FileText } from '@lucide/svelte';

  /**
   * @param {number} bytes
   * @returns {string}
   */
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

{#if ($roomStore.transfersHistory || []).length > 0}
  <div class="w-full bg-dark-card rounded-2xl p-3 sm:p-4 shadow-md mt-2 flex-shrink-0">
    <h4 class="text-xs font-semibold text-gray-300 mb-2.5 flex items-center space-x-1.5">
      <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
      <span>Recent Transfers</span>
    </h4>

    <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
      {#each ($roomStore.transfersHistory || []) as item}
        <div class="flex items-center justify-between p-2 sm:p-2.5 bg-dark-surface rounded-xl text-xs">
          <div class="flex items-center space-x-2 truncate">
            <FileText class="w-3.5 h-3.5 text-fire-500 flex-shrink-0" />
            <span class="text-gray-200 font-medium truncate max-w-[140px] sm:max-w-xs">{item.name}</span>
          </div>
          <div class="flex items-center space-x-2 text-[10px] font-mono text-gray-400 flex-shrink-0">
            <span>{formatBytes(item.size)}</span>
            <span class="px-1.5 py-0.5 rounded-md text-[9px] font-sans uppercase font-bold
              {item.type === 'sent' ? 'bg-fire-500/20 text-fire-400' : 'bg-emerald-500/20 text-emerald-400'}">
              {item.type}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
