<script>
  import { X, Dices, Zap, Server, PlusCircle, ArrowRight, ShieldCheck, Lock } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { connectWebSocket } from '../services/websocket.js';
  import { setRoomProtocol } from '../services/websocket.js';
  import { roomStore } from '../stores/roomStore.js';

  export let isOpen = false;

  const dispatch = createEventDispatcher();

  let roomIdInput = '';
  /** @type {'webrtc' | 'relay'} */
  let selectedProtocol = 'webrtc';

  function generateRandomRoomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    roomIdInput = result;
  }

  onMount(() => {
    generateRandomRoomId();
  });

  function handleClose() {
    isOpen = false;
    dispatch('close');
  }

  async function handleCreateRoom() {
    const clean = roomIdInput.trim().substring(0, 10);
    if (!clean) return;

    isOpen = false;
    roomStore.update(s => ({
      ...s,
      roomProtocol: selectedProtocol,
      transportMode: selectedProtocol === 'relay' ? 'websocket' : 'webrtc'
    }));

    await connectWebSocket(clean);
    setRoomProtocol(selectedProtocol);
    dispatch('close');
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

    <div class="relative w-full max-w-md bg-dark-card border border-fire-500/40 rounded-3xl p-6 shadow-2xl z-10 flex flex-col space-y-4 animate-scaleUp">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-gray-700/40">
        <div class="flex items-center space-x-2.5">
          <div class="p-2 bg-fire-500/15 rounded-xl text-fire-500">
            <PlusCircle class="w-5 h-5 text-fire-500" />
          </div>
          <div>
            <h3 class="font-bold text-base text-white tracking-tight">Create New Room</h3>
            <p class="text-xs text-gray-400">Configure Room ID & Transport Protocol</p>
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

      <!-- Room ID Generator -->
      <div>
        <label for="create-room-id" class="block text-xs font-semibold text-gray-400 mb-1.5">Room ID Code</label>
        <div class="flex items-center space-x-2">
          <input
            id="create-room-id"
            type="text"
            bind:value={roomIdInput}
            maxlength="10"
            placeholder="Room code..."
            class="flex-1 px-3.5 py-2.5 bg-dark-surface rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-fire-500/30 border-none"
          />
          <button
            type="button"
            on:click={generateRandomRoomId}
            title="Generate Random Code"
            class="p-2.5 bg-dark-surface hover:bg-fire-500/20 text-gray-300 hover:text-fire-400 rounded-xl transition-colors cursor-pointer border-none flex items-center justify-center"
          >
            <Dices class="w-5 h-5 text-fire-500" />
          </button>
        </div>
      </div>

      <!-- Protocol Choice Cards -->
      <div>
        <span class="block text-xs font-semibold text-gray-400 mb-1.5">Select Transport Protocol</span>
        <div class="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            on:click={() => (selectedProtocol = 'webrtc')}
            class="p-3 rounded-2xl border text-left flex flex-col justify-between space-y-1 transition-all cursor-pointer border-none
              {selectedProtocol === 'webrtc'
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 ring-2 ring-emerald-500/30'
                : 'bg-dark-surface border-gray-700/60 text-gray-400 hover:text-gray-200'}"
          >
            <div class="text-xs font-bold flex items-center space-x-1.5">
              <Zap class="w-4 h-4 text-amber-400" />
              <span>WebRTC P2P</span>
            </div>
            <div class="text-[10px] opacity-80 leading-tight">Direct 100MB/s+ speed (Unlimited file size)</div>
          </button>

          <button
            type="button"
            on:click={() => (selectedProtocol = 'relay')}
            class="p-3 rounded-2xl border text-left flex flex-col justify-between space-y-1 transition-all cursor-pointer border-none
              {selectedProtocol === 'relay'
                ? 'bg-fire-500/15 border-fire-500/50 text-fire-400 ring-2 ring-fire-500/30'
                : 'bg-dark-surface border-gray-700/60 text-gray-400 hover:text-gray-200'}"
          >
            <div class="text-xs font-bold flex items-center space-x-1.5">
              <Server class="w-4 h-4 text-fire-400" />
              <span>WS Relay</span>
            </div>
            <div class="text-[10px] opacity-80 leading-tight">For strict firewalls (20MB max file size)</div>
          </button>
        </div>
      </div>

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
          on:click={handleCreateRoom}
          disabled={!roomIdInput.trim()}
          class="px-5 py-2.5 bg-gradient-to-r from-fire-600 to-fire-500 hover:from-fire-500 hover:to-fire-400 text-white-force font-semibold text-xs rounded-xl shadow-lg shadow-fire-600/30 flex items-center justify-center space-x-1.5 transition-all cursor-pointer border-none disabled:opacity-40 flex-1"
        >
          <span>Create & Connect</span>
          <ArrowRight class="w-4 h-4 text-white-force" />
        </button>
      </div>
    </div>
  </div>
{/if}
