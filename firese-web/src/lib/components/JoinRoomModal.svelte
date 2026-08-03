<script>
  import { X, LogIn, ArrowRight, User, ShieldCheck, Zap, Server, Users, History, Clock } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { connectWebSocket } from '../services/websocket.js';
  import { roomStore } from '../stores/roomStore.js';

  export let isOpen = false;

  const dispatch = createEventDispatcher();

  let roomIdInput = '';
  let showHistory = false;

  $: if (isOpen) {
    if (typeof window !== 'undefined') {
      const savedLast = localStorage.getItem('firese_last_room');
      if (savedLast) {
        roomIdInput = savedLast;
      } else if ($roomStore.roomId) {
        roomIdInput = $roomStore.roomId;
      }
    }
  }

  function handleClose() {
    isOpen = false;
    dispatch('close');
  }

  async function handleJoinRoom() {
    const clean = roomIdInput.trim().substring(0, 10);
    if (!clean) return;

    isOpen = false;
    await connectWebSocket(clean);
    dispatch('close');
  }

  function selectHistory(/** @type {string} */ code) {
    roomIdInput = code;
    showHistory = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
    <!-- Backdrop Button -->
    <button
      type="button"
      class="fixed inset-0 bg-transparent border-none p-0 cursor-default"
      on:click={handleClose}
      aria-label="Close modal backdrop"
    ></button>

    <div class="relative w-full max-w-md bg-dark-card border border-emerald-500/40 rounded-3xl p-6 shadow-2xl z-10 flex flex-col space-y-4 animate-scaleUp">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-gray-700/40">
        <div class="flex items-center space-x-2.5">
          <div class="p-2 bg-emerald-500/15 rounded-xl text-emerald-400">
            <LogIn class="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 class="font-bold text-base text-white tracking-tight">Join Existing Room</h3>
            <p class="text-xs text-gray-400">Enter Room Code & Auto-Connect</p>
          </div>
        </div>
        <button
          type="button"
          on:click={handleClose}
          class="p-1.5 text-gray-400 hover:text-white bg-dark-surface rounded-xl transition-colors cursor-pointer border-none"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Room ID Input & History -->
      <div class="relative">
        <div class="flex items-center justify-between mb-1.5">
          <label for="join-room-id" class="block text-xs font-semibold text-gray-400">Target Room Code</label>
          {#if $roomStore.roomHistory.length > 0}
            <button
              type="button"
              on:click={() => (showHistory = !showHistory)}
              class="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center space-x-1 border-none bg-transparent cursor-pointer"
            >
              <History class="w-3 h-3 text-emerald-400" />
              <span>Room History ({$roomStore.roomHistory.length})</span>
            </button>
          {/if}
        </div>

        <input
          id="join-room-id"
          type="text"
          bind:value={roomIdInput}
          maxlength="10"
          placeholder="Enter 10-char room code..."
          class="w-full px-3.5 py-2.5 bg-dark-surface rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 border-none"
        />

        <!-- Room History Dropdown -->
        {#if showHistory && $roomStore.roomHistory.length > 0}
          <div class="absolute left-0 right-0 top-full mt-1 bg-dark-surface border border-gray-700/60 rounded-xl p-2 shadow-xl z-20 space-y-1">
            <div class="text-[10px] font-semibold text-gray-400 uppercase px-2 py-1 flex items-center justify-between border-b border-gray-700/40">
              <span>Recent Rooms</span>
              <Clock class="w-3 h-3 text-emerald-400" />
            </div>
            <div class="max-h-40 overflow-y-auto space-y-1">
              {#each $roomStore.roomHistory as item}
                <button
                  type="button"
                  on:click={() => selectHistory(item.roomId)}
                  class="w-full text-left p-2 hover:bg-dark-card rounded-lg transition-colors flex items-center justify-between text-xs cursor-pointer border-none"
                >
                  <span class="font-mono font-bold text-white">{item.roomId}</span>
                  <span class="text-[10px] text-gray-400">{item.lastConnected}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Live Room Details Card -->
      {#if roomIdInput.trim()}
        <div class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1.5 text-xs">
          <div class="flex items-center justify-between text-emerald-300 font-semibold">
            <div class="flex items-center space-x-1.5">
              <ShieldCheck class="w-4 h-4 text-emerald-400" />
              <span>Auto-Adapting to Host Protocol</span>
            </div>
            <span class="font-mono font-bold text-white uppercase">{roomIdInput.trim()}</span>
          </div>
          <p class="text-[11px] text-gray-400 leading-tight">
            Your client will automatically join room <strong class="text-gray-200">{roomIdInput.trim()}</strong> and derive the AES-256 decryption key in browser RAM.
          </p>
        </div>
      {/if}

      <!-- Submit Button -->
      <div class="flex items-center space-x-2 pt-2">
        <button
          type="button"
          on:click={handleClose}
          class="px-4 py-2.5 bg-dark-surface text-gray-300 font-semibold text-xs rounded-xl cursor-pointer border-none flex-1"
        >
          Cancel
        </button>
        <button
          type="button"
          on:click={handleJoinRoom}
          disabled={!roomIdInput.trim()}
          class="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white-force font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer border-none disabled:opacity-40 flex-1"
        >
          <span>Join Room</span>
          <LogIn class="w-4 h-4 text-white-force" />
        </button>
      </div>
    </div>
  </div>
{/if}
