<script>
  import { roomStore } from '../stores/roomStore.js';
  import { connectWebSocket, disconnectWebSocket } from '../services/websocket.js';
  import { loadChatHistory } from '../services/chatService.js';
  import PeersModal from './PeersModal.svelte';
  import CreateRoomModal from './CreateRoomModal.svelte';
  import JoinRoomModal from './JoinRoomModal.svelte';
  import { Users, Copy, Check, LogOut, Plug, Dices, KeyRound, RotateCcw, History, Clock, Loader2, X, ShieldCheck, Zap, AlertTriangle, PlusCircle, LogIn } from '@lucide/svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let roomIdInput = $roomStore.roomId || '';
  let lastConnectedRoomId = '';
  let copied = false;
  let showModal = false;
  let showCreateModal = false;
  let showJoinModal = false;
  let showHistoryDropdown = false;

  // Connection Lifecycle Timers
  let isConnecting = false;
  let connectingSeconds = 0;
  /** @type {any} */
  let intervalTimer = null;
  let minWaitCompleted = false;

  onMount(() => {
    if (typeof window !== 'undefined') {
      const savedRoom = localStorage.getItem('firese_last_room');
      if (savedRoom) {
        const clean = savedRoom.substring(0, 10);
        roomIdInput = clean;
        lastConnectedRoomId = clean;
        loadChatHistory(clean);
      }
    }
  });

  onDestroy(() => {
    clearConnectingTimers();
  });

  function clearConnectingTimers() {
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    connectingSeconds = 0;
    isConnecting = false;
    minWaitCompleted = false;
  }

  // React to connection success from roomStore
  $: if ($roomStore.isConnected) {
    if (minWaitCompleted) {
      isConnecting = false;
      if (intervalTimer) clearInterval(intervalTimer);
    }
  }

  $: if ($roomStore.isConnected && $roomStore.roomId) {
    const currentClean = $roomStore.roomId.substring(0, 10);
    roomIdInput = currentClean;
    lastConnectedRoomId = currentClean;
  }

  // Load chat history dynamically when typing/selecting a room ID
  function handleRoomIdChange() {
    if (roomIdInput.trim()) {
      loadChatHistory(roomIdInput.trim().substring(0, 10));
    }
  }

  function generateRandomRoomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let str = '';
    for (let i = 0; i < 10; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    roomIdInput = str;
    handleRoomIdChange();
  }

  function revertToLastConnectedId() {
    if (lastConnectedRoomId) {
      roomIdInput = lastConnectedRoomId;
      handleRoomIdChange();
    }
  }

  /**
   * @param {string} historyRoomId
   */
  function selectHistoryRoom(historyRoomId) {
    roomIdInput = historyRoomId.substring(0, 10);
    showHistoryDropdown = false;
    handleRoomIdChange();
  }

  async function handleConnectToggle() {
    if ($roomStore.isConnected) {
      disconnectWebSocket();
      clearConnectingTimers();
    } else if (isConnecting && connectingSeconds >= 5) {
      // User clicked Cancel after 5 seconds
      disconnectWebSocket();
      clearConnectingTimers();
    } else if (!isConnecting) {
      if (!roomIdInput.trim()) return;

      isConnecting = true;
      connectingSeconds = 0;
      minWaitCompleted = false;

      // Minimum 1 second lock before unlocking
      setTimeout(() => {
        minWaitCompleted = true;
        if ($roomStore.isConnected) {
          isConnecting = false;
          if (intervalTimer) clearInterval(intervalTimer);
        }
      }, 1000);

      // Start 1-second elapsed timer (up to 60s max)
      intervalTimer = setInterval(() => {
        connectingSeconds += 1;

        // Auto timeout at 60 seconds
        if (connectingSeconds >= 60) {
          disconnectWebSocket();
          clearConnectingTimers();
          alert('Connection timed out after 60 seconds. Please try again.');
        }
      }, 1000);

      await connectWebSocket(roomIdInput.trim().substring(0, 10));
    }
  }

  function copyRoomCode() {
    if (roomIdInput.trim()) {
      navigator.clipboard.writeText(roomIdInput.trim());
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  /**
   * @param {KeyboardEvent} e
   */
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !$roomStore.isConnected && !isConnecting) {
      handleConnectToggle();
    }
  }
</script>

<!-- Room Control Bar (Symmetrical Dead-Center Alignment on Mobile & Desktop) -->
<div class="w-full bg-dark-card rounded-2xl p-2 sm:p-3 shadow-md flex items-center justify-between gap-1.5 sm:gap-3">
  <!-- Left Side: Status Badge + E2EE Badge + Compact Room ID Input -->
  <div class="flex items-center space-x-1.5 sm:space-x-2 flex-1 sm:flex-initial min-w-0">
    <!-- Status Indicator (Dead Center Circle on Mobile, Pill Badge on Desktop) -->
    <div
      title={$roomStore.isConnected ? 'Connected' : (isConnecting ? `Connecting (${connectingSeconds}s)` : 'Disconnected')}
      class="w-8 h-8 sm:w-auto sm:px-3.5 sm:py-1.5 rounded-full text-xs font-mono font-semibold transition-all flex items-center justify-center sm:space-x-1.5 flex-shrink-0
        {$roomStore.isConnected
          ? 'bg-emerald-500/10 text-emerald-400'
          : (isConnecting ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400')}"
    >
      {#if isConnecting}
        <Loader2 class="w-3.5 h-3.5 text-amber-400 animate-spin flex-shrink-0" />
      {:else}
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 {$roomStore.isConnected ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
      {/if}

      <span class="hidden sm:inline">
        {#if $roomStore.isConnected}
          Connected
        {:else if isConnecting}
          Connecting...
        {:else}
          Disconnected
        {/if}
      </span>
    </div>

    <!-- Active Transport Engine Badge (WebSocket vs WebRTC) -->
    {#if $roomStore.isConnected}
      <div
        title={$roomStore.transportMode === 'webrtc' ? `WebRTC Direct P2P Status: ${$roomStore.webrtcStatus}` : 'WebSocket Relay Engine Active'}
        class="hidden md:flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium flex-shrink-0
          {$roomStore.transportMode === 'webrtc'
            ? ($roomStore.webrtcStatus === 'connected'
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : ($roomStore.webrtcStatus === 'failed' ? 'bg-red-500/15 border border-red-500/40 text-red-400' : 'bg-dark-surface border border-gray-700/50 text-gray-400'))
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}"
      >
        {#if $roomStore.transportMode === 'webrtc'}
          <Zap class="w-3.5 h-3.5 {$roomStore.webrtcStatus === 'connected' ? 'text-amber-400 animate-pulse' : 'text-gray-400'}" />
          <span>WebRTC P2P</span>
        {:else}
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
          <span>AES-256 E2EE</span>
        {/if}
      </div>
    {/if}

    <!-- Room Action Controls -->
    <div class="flex items-center space-x-2 flex-1 sm:flex-none">
      {#if !$roomStore.isConnected && !isConnecting}
        <!-- Create Room Button -->
        <button
          type="button"
          on:click={() => (showCreateModal = true)}
          class="h-8 sm:h-9 px-3.5 sm:px-4 bg-fire-500/10 hover:bg-fire-500/20 border border-fire-500/30 text-fire-400 font-semibold text-xs sm:text-xs rounded-full shadow-sm flex items-center space-x-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 flex-shrink-0"
        >
          <PlusCircle class="w-3.5 h-3.5 text-fire-400" />
          <span>Create Room</span>
        </button>

        <!-- Join Room Button -->
        <button
          type="button"
          on:click={() => (showJoinModal = true)}
          class="h-8 sm:h-9 px-3.5 sm:px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold text-xs sm:text-xs rounded-full shadow-sm flex items-center space-x-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 flex-shrink-0"
        >
          <LogIn class="w-3.5 h-3.5 text-emerald-400" />
          <span>Join Room</span>
        </button>
      {:else}
        <!-- Active Connected Room ID Badge -->
        <div class="h-8 sm:h-9 px-3 bg-dark-surface rounded-xl flex items-center space-x-2 border-none">
          <KeyRound class="w-3.5 h-3.5 text-fire-500 flex-shrink-0" />
          <span class="font-mono font-bold text-xs sm:text-sm text-white tracking-wider">{$roomStore.roomId}</span>
          <button
            type="button"
            on:click={copyRoomCode}
            title="Copy Room Code"
            class="p-1 text-gray-400 hover:text-white rounded transition-colors cursor-pointer border-none flex items-center justify-center"
          >
            {#if copied}
              <Check class="w-3.5 h-3.5 text-emerald-400" />
            {:else}
              <Copy class="w-3.5 h-3.5 text-gray-400" />
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Right Side: E2EE Security Badge + Peers Counter + Disconnect Button -->
  <div class="flex items-center space-x-1.5 flex-shrink-0">
    <!-- Clickable AES-256 E2EE Security Inspector Badge -->
    <button
      type="button"
      on:click={() => dispatch('openSecurity')}
      title="Inspect Zero-Knowledge AES-256 End-to-End Encryption"
      aria-label="Inspect Security Payload"
      class="h-8 sm:h-9 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono font-semibold transition-all flex items-center space-x-1 cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex-shrink-0"
    >
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
      <span class="hidden xs:inline sm:inline">AES-256 E2EE</span>
    </button>

    {#if $roomStore.isConnected}
      <button
        type="button"
        on:click={() => (showModal = true)}
        class="h-8 sm:h-9 px-2.5 sm:px-3 rounded-full text-xs text-gray-300 bg-dark-surface hover:bg-fire-500/10 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer border-none"
        title="View Connected Peers"
      >
        <Users class="w-3.5 h-3.5 text-fire-500" />
        <span class="font-mono font-bold">{1 + $roomStore.peers.length}</span>
        <span class="hidden sm:inline">{(1 + $roomStore.peers.length) === 1 ? 'Peer' : 'Peers'}</span>
      </button>

      <!-- Disconnect Button -->
      <button
        type="button"
        on:click={handleConnectToggle}
        class="h-8 sm:h-9 px-3 bg-dark-surface hover:bg-red-500/20 text-red-400 font-semibold text-xs rounded-full flex items-center space-x-1.5 cursor-pointer border-none transition-colors"
      >
        <LogOut class="w-4 h-4 text-red-400 flex-shrink-0" />
        <span class="hidden sm:inline">Leave Room</span>
      </button>
    {:else if isConnecting}
      <!-- Connecting Spinner -->
      <div class="h-8 sm:h-9 px-3 bg-amber-500/10 text-amber-400 font-semibold text-xs rounded-full flex items-center space-x-1.5">
        <Loader2 class="w-4 h-4 text-amber-400 animate-spin" />
        <span>Connecting...</span>
      </div>
    {/if}
  </div>
</div>

<!-- Firewall Blocked Warning Banner when WebRTC P2P fails -->
{#if $roomStore.isConnected && $roomStore.transportMode === 'webrtc' && $roomStore.webrtcStatus === 'failed'}
  <div class="mt-2 w-full p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center justify-between animate-fadeIn">
    <div class="flex items-center space-x-2">
      <AlertTriangle class="w-4 h-4 text-red-400 flex-shrink-0" />
      <span><strong>P2P Connection Blocked by Firewall:</strong> Direct WebRTC connection failed. Please switch to <strong>WebSocket Relay Mode</strong> in Relay Settings.</span>
    </div>
  </div>
{/if}

<!-- Modals -->
{#if showModal}
  <PeersModal on:close={() => (showModal = false)} />
{/if}

<CreateRoomModal bind:isOpen={showCreateModal} />
<JoinRoomModal bind:isOpen={showJoinModal} />
