<script>
  import { roomStore } from '../stores/roomStore.js';
  import { kickPeer, setRoomProtocol } from '../services/websocket.js';
  import { createEventDispatcher, onMount } from 'svelte';
  import { X, Users, User, Globe, Crown, UserMinus, ShieldCheck, Zap, AlertTriangle, Server } from '@lucide/svelte';

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

  function handleKick(/** @type {string} */ targetPeerId) {
    if (confirm('Are you sure you want to kick this peer from the room?')) {
      kickPeer(targetPeerId);
    }
  }

  function handleSwitchToRelay() {
    setRoomProtocol('relay');
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
    class="relative w-full max-w-md bg-dark-card rounded-2xl p-5 shadow-2xl z-50 flex flex-col max-h-[85vh] border-none outline-none animate-fadeIn"
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

    <!-- Peer List -->
    <div class="overflow-y-auto space-y-2 pr-1 max-h-[320px]">
      <!-- Self Profile -->
      <div class="flex items-center justify-between p-3 bg-fire-500/10 rounded-xl border-none">
        <div class="flex items-center space-x-2.5">
          <div class="p-2 bg-fire-500/20 rounded-lg text-fire-500">
            <User class="w-4 h-4" />
          </div>
          <div>
            <div class="text-xs font-bold text-white flex items-center space-x-1.5">
              <span>{$roomStore.userProfile.nickname}</span>
              <span class="px-1.5 py-0.2 bg-fire-500 text-white-force rounded text-[9px] font-mono">You</span>
              {#if $roomStore.isHost}
                <span class="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[9px] font-mono font-bold flex items-center space-x-0.5">
                  <Crown class="w-3 h-3 text-amber-400" />
                  <span>Host</span>
                </span>
              {/if}
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
        {@const status = $roomStore.peerStatuses[peer.peerId] || ($roomStore.transportMode === 'websocket' ? 'relay' : 'p2p_connected')}
        {@const isPeerHost = $roomStore.hostPeerId === peer.peerId}
        <div class="flex items-center justify-between p-3 bg-dark-surface rounded-xl border-none">
          <div class="flex items-center space-x-2.5">
            <div class="p-2 bg-dark-card rounded-lg text-gray-400">
              <User class="w-4 h-4" />
            </div>
            <div>
              <div class="text-xs font-semibold text-white flex items-center space-x-1.5">
                <span>{peer.nickname}</span>
                {#if isPeerHost}
                  <span class="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[9px] font-mono font-bold flex items-center space-x-0.5">
                    <Crown class="w-3 h-3 text-amber-400" />
                    <span>Host</span>
                  </span>
                {/if}
                {#if isDuplicateNickname(peer)}
                  <span class="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                    #{peer.peerId.slice(-4)}
                  </span>
                {/if}
              </div>
              
              <!-- Connection Status Badge -->
              <div class="flex items-center space-x-1 text-[10px] font-mono mt-0.5">
                {#if status === 'p2p_connected'}
                  <span class="text-emerald-400 flex items-center space-x-1">
                    <Zap class="w-3 h-3 text-emerald-400" />
                    <span>P2P Connected</span>
                  </span>
                {:else if status === 'p2p_failed'}
                  <span class="text-red-400 flex items-center space-x-1 font-semibold">
                    <AlertTriangle class="w-3 h-3 text-red-400" />
                    <span>P2P Blocked (Firewall)</span>
                  </span>
                {:else}
                  <span class="text-amber-400 flex items-center space-x-1">
                    <Server class="w-3 h-3 text-amber-400" />
                    <span>WebSocket Relay</span>
                  </span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Host Actions (Kick Peer Button) -->
          {#if $roomStore.isHost && !isPeerHost}
            <button
              type="button"
              on:click={() => handleKick(peer.peerId)}
              title="Kick Peer from Room"
              aria-label="Kick Peer"
              class="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer border-none flex items-center space-x-1"
            >
              <UserMinus class="w-4 h-4 text-red-400" />
              <span class="text-[11px] font-semibold">Kick</span>
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Host Firewall Resolution Callout -->
    {#if $roomStore.isHost && Object.values($roomStore.peerStatuses).includes('p2p_failed')}
      <div class="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2">
        <div class="flex items-start space-x-2 text-amber-300">
          <AlertTriangle class="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span><strong>Peer Connection Blocked:</strong> One or more peers in your room cannot connect via direct WebRTC P2P (STUN blocked by their firewall).</span>
        </div>

        <div class="flex items-center space-x-2 pt-1">
          <button
            type="button"
            on:click={handleSwitchToRelay}
            class="flex-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-dark-base font-bold text-xs rounded-lg transition-colors cursor-pointer border-none"
          >
            Switch Room to WebSocket Relay
          </button>
        </div>
      </div>
    {/if}

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
