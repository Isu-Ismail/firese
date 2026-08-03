<script>
  import { roomStore } from '../stores/roomStore.js';
  import { connectWebSocket, disconnectWebSocket } from '../services/websocket.js';
  import { loadChatHistory } from '../services/chatService.js';
  import PeersModal from './PeersModal.svelte';
  import { Users, Copy, Check, LogOut, Plug, Dices, KeyRound, RotateCcw, History, Clock, Loader2, X, ShieldCheck, Zap, AlertTriangle } from '@lucide/svelte';
  import { onMount, onDestroy } from 'svelte';

  let roomIdInput = $roomStore.roomId || '';
  let lastConnectedRoomId = '';
  let copied = false;
  let showModal = false;
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

  function handleConnectToggle() {
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

      connectWebSocket(roomIdInput.trim().substring(0, 10));
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

    <!-- Room ID Input Bar -->
    <div class="relative flex items-center flex-1 sm:flex-none sm:w-64 min-w-0 h-8 sm:h-9">
      <div class="absolute left-2.5 inset-y-0 flex items-center justify-center pointer-events-none text-gray-400">
        <KeyRound class="w-3.5 h-3.5" />
      </div>

      <input
        type="text"
        maxlength="10"
        placeholder="Enter room ID"
        bind:value={roomIdInput}
        on:input={handleRoomIdChange}
        on:keydown={handleKeyDown}
        disabled={$roomStore.isConnected || isConnecting}
        class="w-full h-full pl-8 pr-20 sm:pr-24 bg-dark-surface rounded-xl text-white font-mono text-xs sm:text-sm focus:outline-none border-none disabled:opacity-80 flex items-center"
      />

      <!-- Quick Action Buttons inside Room Input -->
      <div class="absolute right-1 inset-y-0 flex items-center space-x-0.5 sm:space-x-1">
        <!-- Room History Button -->
        {#if $roomStore.roomHistory.length > 0 && !$roomStore.isConnected && !isConnecting}
          <div class="relative flex items-center">
            <button
              type="button"
              on:click={() => (showHistoryDropdown = !showHistoryDropdown)}
              title="Previously Connected Rooms"
              aria-label="Previously Connected Rooms"
              class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-fire-500 hover:bg-dark-card transition-colors cursor-pointer border-none"
            >
              <History class="w-3.5 h-3.5" />
            </button>

            <!-- Room History Dropdown Menu -->
            {#if showHistoryDropdown}
              <div
                class="absolute right-0 top-8 w-56 sm:w-64 bg-dark-card rounded-xl shadow-2xl p-2 z-30 space-y-1 animate-fadeIn border-none"
              >
                <div class="text-[10px] font-semibold text-gray-400 uppercase px-2 py-1 flex items-center justify-between border-b border-gray-700/40">
                  <span>Room History</span>
                  <Clock class="w-3 h-3 text-fire-500" />
                </div>
                <div class="max-h-48 overflow-y-auto space-y-1">
                  {#each $roomStore.roomHistory as item}
                    <button
                      type="button"
                      on:click={() => selectHistoryRoom(item.roomId)}
                      class="w-full text-left p-2 hover:bg-dark-surface rounded-lg transition-colors flex items-center justify-between text-xs cursor-pointer border-none"
                    >
                      <span class="font-mono font-bold text-white">{item.roomId}</span>
                      <span class="text-[10px] text-gray-400">{item.lastConnected}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Revert to Last Connected Room ID Button -->
        {#if lastConnectedRoomId && roomIdInput !== lastConnectedRoomId && !$roomStore.isConnected && !isConnecting}
          <button
            type="button"
            on:click={revertToLastConnectedId}
            title="Revert to last connected ID ({lastConnectedRoomId})"
            aria-label="Revert to last connected ID"
            class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-amber-400 hover:text-amber-300 hover:bg-dark-card transition-colors animate-pulse cursor-pointer border-none"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        {/if}

        <!-- Dice Icon for 10-char Alphanumeric Generator -->
        <button
          type="button"
          on:click={generateRandomRoomId}
          disabled={$roomStore.isConnected || isConnecting}
          title="Generate random Room ID"
          aria-label="Generate random Room ID"
          class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-fire-500 hover:bg-dark-card transition-colors disabled:opacity-40 cursor-pointer border-none"
        >
          <Dices class="w-3.5 h-3.5" />
        </button>

        <!-- Copy Room ID -->
        <button
          type="button"
          on:click={copyRoomCode}
          title="Copy Room ID"
          aria-label="Copy Room ID"
          class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-dark-card transition-colors cursor-pointer border-none"
        >
          {#if copied}
            <Check class="w-3.5 h-3.5 text-emerald-500" />
          {:else}
            <Copy class="w-3.5 h-3.5" />
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Right Side: Peers Counter + Connect / Disconnect / Cancel Button -->
  <div class="flex items-center space-x-1.5 flex-shrink-0">
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
    {/if}

    <!-- Connect / Disconnect / Cancel Button (Dead Center Circle on Mobile, Pill Badge on Desktop) -->
    <button
      type="button"
      on:click={handleConnectToggle}
      disabled={(!roomIdInput.trim() && !$roomStore.isConnected && !isConnecting) || (isConnecting && connectingSeconds < 5)}
      class="w-8 h-8 sm:w-auto sm:px-4 sm:h-9 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center sm:space-x-1.5 shadow-md transition-all duration-100 ease-out hover:scale-[1.03] cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0
        {$roomStore.isConnected
          ? 'bg-dark-surface hover:bg-red-500/20 text-red-400'
          : (isConnecting
              ? (connectingSeconds >= 5 ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 cursor-pointer' : 'bg-amber-500/10 text-amber-400')
              : 'bg-fire-500 hover:bg-fire-600 text-white-force')}"
    >
      {#if $roomStore.isConnected}
        <LogOut class="w-4 h-4 text-red-400 flex-shrink-0" />
        <span class="hidden sm:inline">Disconnect</span>
      {:else if isConnecting}
        {#if connectingSeconds >= 5}
          <!-- Cancel Button after 5 seconds -->
          <X class="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span class="hidden sm:inline">Cancel</span>
        {:else}
          <!-- Spinner during first 5 seconds -->
          <Loader2 class="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
          <span class="hidden sm:inline">Connecting...</span>
        {/if}
      {:else}
        <Plug class="w-4 h-4 text-white-force flex-shrink-0" />
        <span class="hidden sm:inline">Connect</span>
      {/if}
    </button>
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

<!-- Peers List Popup Modal -->
{#if showModal}
  <PeersModal on:close={() => (showModal = false)} />
{/if}
