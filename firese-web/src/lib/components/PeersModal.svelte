<script>
  import { roomStore } from '../stores/roomStore.js';
  import { createEventDispatcher, onMount } from 'svelte';
  import { X, Users, User, Globe } from '@lucide/svelte';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  /**
   * @param {KeyboardEvent} e
   */
  function handleKeydown(e) {
    if (e.key === 'Escape') {
      close();
    }
  }

  /** @type {HTMLDivElement | null} */
  let dialogRef = null;

  onMount(() => {
    dialogRef?.focus();
  });

  /**
   * @param {import('../stores/roomStore.js').Peer} peer
   */
  function isDuplicateNickname(peer) {
    const count = $roomStore.peers.filter(p => p.nickname === peer.nickname).length;
    const sameAsSelf = $roomStore.userProfile.nickname === peer.nickname;
    return count > 1 || sameAsSelf;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Modal Outer Container & Backdrop Button -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <!-- Backdrop Button (Button tag for keyboard a11y) -->
  <button
    type="button"
    on:click={close}
    aria-label="Close modal backdrop"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 border-none p-0 cursor-default"
  ></button>

  <!-- Modal Dialog Box -->
  <div
    bind:this={dialogRef}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-labelledby="peers-modal-title"
    class="relative w-full max-w-sm bg-dark-card rounded-2xl p-5 shadow-2xl z-50 flex flex-col max-h-[80vh] border-none outline-none animate-fadeIn"
  >
    <!-- Header -->
    <div class="flex items-center justify-between pb-3 mb-3 border-b border-gray-700/40">
      <div class="flex items-center space-x-2">
        <Users class="w-5 h-5 text-fire-500" />
        <h3 id="peers-modal-title" class="font-bold text-base text-white">
          Connected Peers ({1 + $roomStore.peers.length})
        </h3>
      </div>
      <button
        type="button"
        on:click={close}
        aria-label="Close modal"
        class="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-dark-surface transition-colors cursor-pointer border-none"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Peer List (Max ~5 visible items, scrollable) -->
    <div class="overflow-y-auto space-y-2 pr-1 max-h-[280px]">
      <!-- Self Profile -->
      <div class="flex items-center justify-between p-2.5 bg-fire-500/10 rounded-xl border-none">
        <div class="flex items-center space-x-2">
          <div class="p-1.5 bg-fire-500/20 rounded-lg text-fire-500">
            <User class="w-4 h-4" />
          </div>
          <div>
            <div class="text-xs font-bold text-white flex items-center space-x-1.5">
              <span>{$roomStore.userProfile.nickname}</span>
              <span class="px-1.5 py-0.2 bg-fire-500 text-white-force rounded text-[9px] font-mono">You</span>
              <span class="text-[9px] font-mono text-gray-400">#{$roomStore.userProfile.peerId.slice(-4)}</span>
            </div>
            <div class="text-[10px] text-gray-400 font-mono flex items-center space-x-1">
              <Globe class="w-3 h-3 text-emerald-500" />
              <span>{$roomStore.userProfile.ip}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Online Peers -->
      {#each $roomStore.peers as peer (peer.peerId)}
        <div class="flex items-center justify-between p-2.5 bg-dark-surface rounded-xl border-none">
          <div class="flex items-center space-x-2">
            <div class="p-1.5 bg-dark-card rounded-lg text-gray-400">
              <User class="w-4 h-4" />
            </div>
            <div>
              <div class="text-xs font-semibold text-white flex items-center space-x-1.5">
                <span>{peer.nickname}</span>
                {#if isDuplicateNickname(peer)}
                  <span class="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                    #{peer.peerId.slice(-4)}
                  </span>
                {/if}
              </div>
              <div class="text-[10px] text-gray-400 font-mono flex items-center space-x-1">
                <Globe class="w-3 h-3 text-emerald-500" />
                <span>{peer.ip}</span>
              </div>
            </div>
          </div>
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
      {/each}
    </div>

    <!-- Close Button -->
    <button
      type="button"
      on:click={close}
      class="w-full mt-4 py-2 bg-dark-surface hover:bg-dark-surface-hover text-gray-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer border-none"
    >
      Close
    </button>
  </div>
</div>
