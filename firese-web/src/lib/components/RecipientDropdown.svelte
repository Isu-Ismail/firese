<script>
  import { roomStore } from '../stores/roomStore.js';
  import { formatPeerName } from '../services/peerUtils.js';
  import { Users, User, ChevronDown } from '@lucide/svelte';

  /** @type {string} */
  export let selected = 'group';
  /** @type {boolean} */
  export let disabled = false;

  let isDropdownOpen = false;

  /**
   * Dynamically calculate button text label for active recipient selection
   */
  $: selectedLabel = formatPeerName(selected, $roomStore.peers, $roomStore.userProfile.nickname, true);

  /**
   * @param {string} targetKey
   */
  function selectRecipient(targetKey) {
    selected = targetKey;
    isDropdownOpen = false;
  }
</script>

<div class="relative inline-block text-left">
  <button
    type="button"
    on:click|stopPropagation={() => !disabled && (isDropdownOpen = !isDropdownOpen)}
    {disabled}
    class="flex items-center space-x-2 px-3 py-1.5 bg-dark-surface rounded-xl text-white font-medium text-xs hover:opacity-90 transition-opacity shadow-sm border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <span class="text-fire-500 flex items-center">
      {#if selected === 'group'}
        <Users class="w-3.5 h-3.5" />
      {:else}
        <User class="w-3.5 h-3.5" />
      {/if}
    </span>
    <span class="truncate max-w-[110px] sm:max-w-[130px]">{selectedLabel}</span>
    <ChevronDown class="w-3 h-3 text-gray-400 transition-transform {isDropdownOpen ? 'rotate-180' : ''}" />
  </button>

  {#if isDropdownOpen}
    <!-- Backdrop to close on click outside -->
    <button
      type="button"
      class="fixed inset-0 z-30 cursor-default bg-transparent border-none p-0"
      on:click|stopPropagation={() => (isDropdownOpen = false)}
      aria-label="Close dropdown"
    ></button>

    <div
      class="absolute right-0 top-8 min-w-[160px] max-w-[calc(100vw-2rem)] bg-dark-surface rounded-xl shadow-2xl z-40 overflow-hidden border border-gray-700/60 text-xs animate-fadeIn"
    >
      <!-- Group Chat Option -->
      <button
        type="button"
        on:click|stopPropagation={() => selectRecipient('group')}
        class="w-full text-left px-3.5 py-2.5 font-medium flex items-center space-x-2 transition-colors border-none cursor-pointer group
          {$roomStore.peers.length > 0 ? 'border-b border-gray-700/40' : ''}
          {selected === 'group'
            ? 'text-fire-500 font-semibold bg-transparent'
            : 'text-white hover:bg-fire-500/10 hover:text-fire-500'}"
      >
        <Users class="w-3.5 h-3.5 transition-colors {selected === 'group' ? 'text-fire-500' : 'text-white group-hover:text-fire-500'}" />
        <span class="whitespace-nowrap">Group (All)</span>
      </button>

      <!-- Connected Peers Options -->
      {#each $roomStore.peers as peer, idx}
        {@const isPeerSelected = selected === peer.peerId || selected === peer.nickname}
        <button
          type="button"
          on:click|stopPropagation={() => selectRecipient(peer.peerId || peer.nickname)}
          class="w-full text-left px-3.5 py-2.5 font-medium flex items-center space-x-2 transition-colors border-none cursor-pointer group
            {idx < $roomStore.peers.length - 1 ? 'border-b border-gray-700/40' : ''}
            {isPeerSelected
              ? 'text-fire-500 font-semibold bg-transparent'
              : 'text-white hover:bg-fire-500/10 hover:text-fire-500'}"
        >
          <User class="w-3.5 h-3.5 transition-colors {isPeerSelected ? 'text-fire-500' : 'text-white group-hover:text-fire-500'}" />
          <span class="truncate">{formatPeerName(peer.peerId || peer.nickname, $roomStore.peers, $roomStore.userProfile.nickname)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
