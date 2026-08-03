<script>
  import { roomStore } from '../stores/roomStore.js';
  import { connectWebSocket } from '../services/websocket.js';
  import { Server, Check, RotateCcw, X, ShieldCheck, Cpu, Zap } from '@lucide/svelte';
  import { onMount } from 'svelte';

  export let isOpen = false;

  let serverMode = 'default'; // 'default' | 'custom'
  /** @type {'websocket' | 'webrtc'} */
  let transportMode = 'websocket';
  let customWsUrl = '';
  let activeUrl = '';

  function loadSettings() {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('firese_custom_ws_url');
    if (saved && saved.trim()) {
      serverMode = 'custom';
      customWsUrl = saved.trim();
    } else {
      serverMode = 'default';
      customWsUrl = '';
    }

    const savedTransport = localStorage.getItem('firese_transport_mode');
    transportMode = savedTransport === 'webrtc' ? 'webrtc' : 'websocket';

    updateActiveUrlDisplay();
  }

  function updateActiveUrlDisplay() {
    if (serverMode === 'custom' && customWsUrl.trim()) {
      activeUrl = customWsUrl.trim();
    } else {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      activeUrl = isHttps ? 'wss://firese-server.onrender.com/ws' : 'ws://localhost:8080/ws';
    }
  }

  onMount(() => {
    loadSettings();
  });

  $: if (isOpen) {
    loadSettings();
  }

  function handleSave() {
    if (typeof window === 'undefined') return;

    if (serverMode === 'custom' && customWsUrl.trim()) {
      let cleanUrl = customWsUrl.trim();
      if (!cleanUrl.startsWith('ws://') && !cleanUrl.startsWith('wss://')) {
        cleanUrl = 'ws://' + cleanUrl;
      }
      localStorage.setItem('firese_custom_ws_url', cleanUrl);
    } else {
      localStorage.removeItem('firese_custom_ws_url');
    }

    localStorage.setItem('firese_transport_mode', transportMode);
    roomStore.update(s => ({ ...s, transportMode, webrtcStatus: 'idle' }));

    // Reconnect active room if already connected
    if ($roomStore.roomId) {
      connectWebSocket($roomStore.roomId);
    }

    isOpen = false;
  }

  function handleResetDefault() {
    serverMode = 'default';
    transportMode = 'websocket';
    customWsUrl = '';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('firese_custom_ws_url');
      localStorage.setItem('firese_transport_mode', 'websocket');
    }
    roomStore.update(s => ({ ...s, transportMode: 'websocket', webrtcStatus: 'idle' }));
    updateActiveUrlDisplay();
  }

  function closeModal() {
    isOpen = false;
  }
</script>

{#if isOpen}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click={closeModal}
  >
    <!-- Modal Dialog (Stop propagation) -->
    <div
      role="dialog"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown={(e) => e.key === 'Escape' && closeModal()}
      class="w-full max-w-md bg-dark-card rounded-2xl p-5 sm:p-6 shadow-2xl border border-gray-700/60 text-left relative animate-fadeIn space-y-4 cursor-default"
    >
      <!-- Close Button -->
      <button
        type="button"
        on:click={closeModal}
        class="absolute top-4 right-4 p-1.5 bg-dark-surface hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors border-none cursor-pointer"
      >
        <X class="w-4 h-4" />
      </button>

      <!-- Header Title -->
      <div class="flex items-center space-x-2.5">
        <div class="p-2.5 bg-fire-500/10 rounded-xl text-fire-500">
          <Server class="w-6 h-6" />
        </div>
        <div>
          <h3 class="text-base font-bold text-white">Relay Server Settings</h3>
          <p class="text-xs text-gray-400">Use default or connect to your own self-hosted relay</p>
        </div>
      </div>

      <!-- Active Server Status Badge -->
      <div class="p-3 bg-dark-surface rounded-xl border border-gray-700/40 space-y-1">
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-400 font-medium">Active WebSocket Node:</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
            {serverMode === 'custom' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
            {serverMode === 'custom' ? 'Self-Hosted' : 'Default Relay'}
          </span>
        </div>
        <div class="font-mono text-xs font-semibold text-gray-200 truncate">
          {activeUrl}
        </div>
      </div>

      <!-- Server Options Radio Selection -->
      <div class="space-y-3 pt-1">
        <!-- Option 1: Default Firese Relay -->
        <label class="flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer
          {serverMode === 'default' ? 'bg-fire-500/10 border-fire-500/60' : 'bg-dark-surface border-gray-700/40 hover:border-gray-600'}">
          <input
            type="radio"
            name="serverMode"
            value="default"
            bind:group={serverMode}
            on:change={updateActiveUrlDisplay}
            class="mt-1 accent-fire-500"
          />
          <div class="space-y-0.5 text-xs">
            <span class="font-bold text-white flex items-center space-x-1.5">
              <span>Default Relay Server</span>
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
            </span>
            <p class="text-gray-400 text-[11px]">Default zero-storage WebSocket relay instance</p>
          </div>
        </label>

        <!-- Option 2: Custom Self-Hosted Relay -->
        <label class="flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer
          {serverMode === 'custom' ? 'bg-fire-500/10 border-fire-500/60' : 'bg-dark-surface border-gray-700/40 hover:border-gray-600'}">
          <input
            type="radio"
            name="serverMode"
            value="custom"
            bind:group={serverMode}
            on:change={updateActiveUrlDisplay}
            class="mt-1 accent-fire-500"
          />
          <div class="space-y-0.5 text-xs w-full">
            <span class="font-bold text-white flex items-center space-x-1.5">
              <span>Self-Hosted Custom Relay</span>
              <Cpu class="w-3.5 h-3.5 text-amber-400" />
            </span>
            <p class="text-gray-400 text-[11px]">Connect to your own private Go WebSocket server</p>

            {#if serverMode === 'custom'}
              <div class="pt-2">
                <input
                  type="text"
                  placeholder="ws://localhost:8080/ws"
                  bind:value={customWsUrl}
                  on:input={updateActiveUrlDisplay}
                  class="w-full px-3 py-2 bg-dark-card border border-gray-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-fire-500"
                />
                <span class="text-[10px] text-gray-400 mt-1 block">e.g. ws://192.168.1.50:8080/ws</span>
              </div>
            {/if}
          </div>
        </label>
      </div>

      <!-- Network Transport Engine Selection -->
      <div class="space-y-2 pt-2 border-t border-gray-700/40">
        <span class="block text-xs font-semibold text-gray-400">Network Transport Engine</span>
        <div class="grid grid-cols-2 gap-2">
          <!-- WebSocket Relay Mode -->
          <label class="flex items-center space-x-2 p-2.5 rounded-xl border transition-all cursor-pointer
            {transportMode === 'websocket' ? 'bg-fire-500/10 border-fire-500/60' : 'bg-dark-surface border-gray-700/40 hover:border-gray-600'}">
            <input
              type="radio"
              name="transportMode"
              value="websocket"
              bind:group={transportMode}
              class="accent-fire-500"
            />
            <div class="space-y-0.5 text-xs">
              <span class="font-bold text-white flex items-center space-x-1">
                <Server class="w-3.5 h-3.5 text-fire-500" />
                <span>WebSocket</span>
              </span>
              <span class="text-[10px] text-gray-400 block">Server Relay</span>
            </div>
          </label>

          <!-- Direct WebRTC P2P Mode -->
          <label class="flex items-center space-x-2 p-2.5 rounded-xl border transition-all cursor-pointer
            {transportMode === 'webrtc' ? 'bg-fire-500/10 border-fire-500/60' : 'bg-dark-surface border-gray-700/40 hover:border-gray-600'}">
            <input
              type="radio"
              name="transportMode"
              value="webrtc"
              bind:group={transportMode}
              class="accent-fire-500"
            />
            <div class="space-y-0.5 text-xs">
              <span class="font-bold text-white flex items-center space-x-1">
                <Zap class="w-3.5 h-3.5 text-amber-400" />
                <span>WebRTC P2P</span>
              </span>
              <span class="text-[10px] text-gray-400 block">Direct Stream</span>
            </div>
          </label>
        </div>
      </div>

      <!-- Modal Footer Action Buttons -->
      <div class="flex items-center justify-between pt-2 border-t border-gray-700/40">
        <button
          type="button"
          on:click={handleResetDefault}
          class="px-3 py-2 text-xs font-medium text-gray-400 hover:text-white flex items-center space-x-1.5 border-none bg-transparent cursor-pointer"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset Default</span>
        </button>

        <button
          type="button"
          on:click={handleSave}
          class="px-4 py-2 bg-fire-500 hover:bg-fire-600 text-white-force font-semibold text-xs rounded-xl shadow-lg flex items-center space-x-1.5 transition-all border-none cursor-pointer"
        >
          <Check class="w-3.5 h-3.5 text-white-force" />
          <span>Save & Apply</span>
        </button>
      </div>
    </div>
  </div>
{/if}
