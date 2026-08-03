<script>
  import { roomStore } from '../stores/roomStore.js';
  import { sendFile, cancelFileTransfer } from '../services/fileStreamer.js';
  import { formatPeerName } from '../services/peerUtils.js';
  import { UploadCloud, DownloadCloud, Clipboard, Zap, FileText, CheckCircle2, Send, X, AlertCircle, Users, Download, FileCheck, ShieldCheck, Save } from '@lucide/svelte';
  import RecipientDropdown from './RecipientDropdown.svelte';
  import { onMount, onDestroy } from 'svelte';

  let isDragging = false;
  /** @type {HTMLInputElement | null} */
  let fileInput = null;

  /** @type {File | null} */
  let stagedFile = null;
  let isTransferring = false;
  let fileRecipient = 'group';
  
  /** @type {{ name: string, size: number, type: string } | null} */
  let completedFile = null;

  $: canInteract = $roomStore.isConnected;
  $: canSendFile = $roomStore.isConnected && $roomStore.peerCount >= 2;
  $: isRelayExceeded = $roomStore.transportMode === 'websocket' && stagedFile && stagedFile.size > 20 * 1024 * 1024;

  function switchToWebRTC() {
    roomStore.update(s => ({ ...s, transportMode: 'webrtc' }));
  }

  // Reset fileRecipient to 'group' if selected peer disconnects
  $: if (fileRecipient !== 'group' && $roomStore.peers.length > 0) {
    const exists = $roomStore.peers.some(p => p.peerId === fileRecipient || p.nickname === fileRecipient);
    if (!exists) fileRecipient = 'group';
  }

  /**
   * @param {number} [bytes]
   * @returns {string}
   */
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * @param {FileList | File[] | null | undefined} files
   */
  function handleFileSelect(files) {
    if (!canInteract) return;
    if (files && files.length > 0) {
      clearReceivedFile();
      stagedFile = files[0];
      completedFile = null;
    }
  }

  /**
   * Start sending the staged file in real-time over WebSocket
   * @param {MouseEvent} [e]
   */
  async function triggerSend(e) {
    if (e) e.stopPropagation();
    if (!stagedFile || isTransferring || !canSendFile || isRelayExceeded) return;

    const currentFile = stagedFile;
    isTransferring = true;

    // Send file cleanly over WebSocket with targeted recipient ('group' or peer nickname/peerId)
    await sendFile(currentFile, fileRecipient);

    completedFile = {
      name: currentFile.name,
      size: currentFile.size,
      type: 'sent'
    };
    stagedFile = null;
    isTransferring = false;
  }

  /**
   * @param {MouseEvent} [e]
   */
  function handleCancelStream(e) {
    if (e) e.stopPropagation();
    cancelFileTransfer();
    clearStagedFile();
    clearReceivedFile();
  }

  /**
   * @param {MouseEvent} [e]
   */
  function clearStagedFile(e) {
    if (e) e.stopPropagation();
    stagedFile = null;
    completedFile = null;
    isTransferring = false;
    if (fileInput) fileInput.value = '';
  }

  /**
   * @param {MouseEvent} [e]
   */
  function clearReceivedFile(e) {
    if (e) e.stopPropagation();
    if ($roomStore.receivedFile?.blobUrl) {
      try { URL.revokeObjectURL($roomStore.receivedFile.blobUrl); } catch {}
    }
    roomStore.update(s => ({ ...s, receivedFile: null }));
  }

  /**
   * @param {MouseEvent} [e]
   */
  function triggerSendFiles(e) {
    if (e) e.stopPropagation();
    clearStagedFile();
    clearReceivedFile();
    setTimeout(() => {
      if (fileInput) fileInput.click();
    }, 50);
  }

  /**
   * @param {MouseEvent} [e]
   */
  function downloadReceivedFile(e) {
    if (e) e.stopPropagation();
    if ($roomStore.receivedFile && $roomStore.receivedFile.blobUrl) {
      const a = document.createElement('a');
      a.href = $roomStore.receivedFile.blobUrl;
      a.download = $roomStore.receivedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  /**
   * React to incoming / outgoing file transfer from roomStore
   */
  $: if ($roomStore.activeTransfer) {
    isTransferring = true;
  } else if (!stagedFile && !completedFile && !$roomStore.receivedFile) {
    isTransferring = false;
  }

  /**
   * @param {DragEvent} e
   */
  function handleDrop(e) {
    e.preventDefault();
    isDragging = false;
    if (!canInteract) return;
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  }

  /**
   * @param {DragEvent} e
   */
  function handleDragOver(e) {
    e.preventDefault();
    if (!canInteract) return;
    isDragging = true;
  }

  /**
   * @param {DragEvent} e
   */
  function handleDragLeave(e) {
    e.preventDefault();
    isDragging = false;
  }

  /**
   * @param {ClipboardEvent} e
   */
  function handlePaste(e) {
    if (!canInteract) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          handleFileSelect([file]);
          break;
        }
      }
    }
  }

  /**
   * @param {Event} e
   */
  function handleInputChange(e) {
    if (!canInteract) return;
    const target = /** @type {HTMLInputElement | null} */ (e.target);
    if (target && target.files) {
      handleFileSelect(target.files);
    }
  }

  /**
   * @param {KeyboardEvent} e
   */
  function handleKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ' ') && fileInput && canInteract && !stagedFile && !isTransferring && !completedFile && !$roomStore.receivedFile) {
      fileInput.click();
    }
  }

  let autoSave = false;

  /**
   * @param {MouseEvent} [e]
   */
  function toggleAutoSave(e) {
    if (e) e.stopPropagation();
    autoSave = !autoSave;
    if (typeof window !== 'undefined') {
      localStorage.setItem('firese_auto_download', autoSave ? 'true' : 'false');
    }
  }

  onMount(() => {
    window.addEventListener('paste', handlePaste);
    if (typeof window !== 'undefined') {
      autoSave = localStorage.getItem('firese_auto_download') === 'true';
    }
  });

  onDestroy(() => {
    window.removeEventListener('paste', handlePaste);
  });
</script>

<div
  role="button"
  tabindex="0"
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:click={() => canInteract && !stagedFile && !isTransferring && !completedFile && !$roomStore.receivedFile && fileInput?.click()}
  on:keydown={handleKeyDown}
  class="relative w-full h-full min-h-[300px] lg:min-h-0 flex-1 border-2 border-dashed rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all duration-200 group overflow-hidden
    {!canInteract
      ? 'border-gray-700/40 bg-dark-card/50 opacity-60 cursor-not-allowed'
      : (stagedFile || isTransferring || completedFile || $roomStore.receivedFile
          ? 'border-fire-500/60 bg-dark-card shadow-2xl cursor-default'
          : (isDragging
              ? 'border-fire-500 bg-fire-500/10 scale-[1.005] cursor-pointer'
              : 'border-gray-500/30 bg-dark-card hover:border-fire-500/50 cursor-pointer'))}"
>
  <input
    type="file"
    bind:this={fileInput}
    on:change={handleInputChange}
    disabled={!canInteract || !!stagedFile || isTransferring || !!completedFile || !!$roomStore.receivedFile}
    class="hidden"
  />

  <!-- Top Header Bar with Recipient Selector & Auto-Download Save Toggle -->
  <div class="flex items-center justify-between pb-2 mb-1 border-b border-gray-700/40 flex-shrink-0 z-20 w-full gap-2">
    <div class="flex items-center space-x-2 flex-shrink-0">
      <UploadCloud class="w-5 h-5 text-fire-500" />
      <span class="font-bold text-sm sm:text-base text-white">Send Files</span>
    </div>

    <!-- Controls: Auto-Download Save Toggle + Target Recipient Selector -->
    <div class="flex items-center space-x-1.5 sm:space-x-2.5 flex-shrink-0">
      <!-- Auto Save / Auto Download Toggle Button -->
      <button
        type="button"
        on:click|stopPropagation={toggleAutoSave}
        title={autoSave ? 'Auto-Download is ON (Received files download automatically)' : 'Auto-Download is OFF (Click to turn ON)'}
        aria-label="Toggle Auto Download"
        class="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border
          {autoSave
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-dark-surface border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600'}"
      >
        <Save class="w-3.5 h-3.5 {autoSave ? 'text-emerald-400' : 'text-gray-400'}" />
        <span>Save: {autoSave ? 'ON' : 'OFF'}</span>
      </button>

      <span class="text-xs text-gray-400 font-medium hidden sm:inline">To:</span>
      <RecipientDropdown bind:selected={fileRecipient} disabled={!canInteract} />
    </div>
  </div>

  <!-- Center Content Body (Scrollable Container with top padding) -->
  <div class="flex-1 flex flex-col items-center text-center py-2 z-10 w-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
    {#if !canInteract}
      <!-- STATE 0: Disconnected Lock -->
      <div class="w-full max-w-sm flex flex-col items-center space-y-3 my-auto animate-fadeIn">
        <div class="p-4 bg-dark-surface rounded-2xl border border-gray-700/60 text-gray-500">
          <AlertCircle class="w-10 h-10 text-gray-500" />
        </div>
        <h3 class="text-base font-bold text-white">Connect to a Room to Relay Files</h3>
        <p class="text-xs text-gray-400 max-w-xs">
          Enter a Room ID in the bar above and click <span class="text-fire-400 font-semibold">Connect</span> to start transferring files.
        </p>
      </div>

    {:else if $roomStore.activeTransfer}
      <!-- STATE 1: Real-Time Live Stream Transfer -->
      <div class="w-full max-w-sm flex flex-col items-center space-y-3 sm:space-y-4 my-auto animate-fadeIn">
        <div class="p-3 sm:p-4 bg-gradient-to-br from-fire-500/20 to-fire-700/20 rounded-2xl border border-fire-500/40 shadow-lg shadow-fire-500/10">
          {#if $roomStore.activeTransfer.isSending}
            <UploadCloud class="w-8 h-8 sm:w-12 sm:h-12 text-fire-500 animate-bounce" />
          {:else}
            <DownloadCloud class="w-8 h-8 sm:w-12 sm:h-12 text-emerald-400 animate-bounce" />
          {/if}
        </div>

        <div class="text-center w-full">
          <div class="text-xs font-semibold uppercase tracking-wider text-fire-400 mb-1 flex items-center justify-center space-x-1.5">
            <Zap class="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{$roomStore.activeTransfer.status || ($roomStore.activeTransfer.isSending ? 'Relaying File Stream...' : 'Receiving Stream...')}</span>
          </div>

          <!-- Sender & Target Detail -->
          <div class="text-[11px] font-mono text-gray-400 mb-1">
            {$roomStore.activeTransfer.isSending
              ? `Sender: You → Target: ${formatPeerName(fileRecipient, $roomStore.peers, $roomStore.userProfile.nickname)}`
              : `Sender: ${formatPeerName($roomStore.activeTransfer.senderPeerId || $roomStore.activeTransfer.sender, $roomStore.peers, $roomStore.userProfile.nickname)}`}
          </div>

          <h3 class="text-sm sm:text-base font-bold text-white truncate max-w-full px-2">
            {$roomStore.activeTransfer.name || stagedFile?.name || 'File'}
          </h3>

          <div class="text-xs text-gray-400 font-mono mt-0.5">
            {formatBytes($roomStore.activeTransfer.size || stagedFile?.size || 0)}
          </div>
        </div>

        <!-- Real-Time Progress Bar -->
        <div class="w-full space-y-1.5">
          <div class="flex items-center justify-between text-xs font-mono font-bold">
            <span class="text-gray-300">{$roomStore.activeTransfer.progress}%</span>
            <span class="text-amber-400">{$roomStore.activeTransfer.speed} MB/s</span>
          </div>

          <div class="w-full bg-dark-surface rounded-full h-2.5 overflow-hidden p-0.5 border border-gray-700/60 shadow-inner">
            <div
              class="bg-gradient-to-r from-fire-600 via-fire-500 to-amber-400 h-full rounded-full transition-all duration-150 shadow-md shadow-fire-500/30"
              style="width: {$roomStore.activeTransfer.progress}%"
            ></div>
          </div>
        </div>

        <div class="text-[11px] text-gray-400 font-mono">
          {$roomStore.activeTransfer.useWebRTC ? `${$roomStore.activeTransfer.chunkSizeLabel || '8MB'} Direct P2P Chunks` : '64KB Encrypted Relay Chunks'} • AES-256 E2EE
        </div>

        <!-- Cancel Stream Button -->
        <button
          type="button"
          on:click|stopPropagation={handleCancelStream}
          class="mt-1 px-4 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border-none"
        >
          <X class="w-3.5 h-3.5 text-red-400" />
          <span>Cancel Stream</span>
        </button>
      </div>

    {:else if $roomStore.receivedFile}
      <!-- STATE 2: Received File Preview & Manual Download Display -->
      <div class="w-full max-w-md flex flex-col items-center space-y-2 sm:space-y-3 animate-fadeIn pt-1 pb-2">
        <div class="text-center w-full">
          <div class="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1 flex items-center justify-center space-x-1.5">
            <FileCheck class="w-4 h-4 text-emerald-400" />
            <span>FILE RECEIVED</span>
          </div>

          <!-- Sender Detail -->
          <div class="text-xs font-mono text-gray-300 mb-1 bg-dark-surface px-3 py-1 rounded-full inline-block border border-gray-700/40">
            Sent by: <span class="font-bold text-emerald-400">{formatPeerName($roomStore.receivedFile.senderPeerId || $roomStore.receivedFile.sender, $roomStore.peers, $roomStore.userProfile.nickname)}</span>
          </div>

          <h3 class="text-sm sm:text-base font-bold text-white truncate max-w-full px-2">
            {$roomStore.receivedFile.name}
          </h3>

          <div class="text-xs text-gray-400 font-mono mt-0.5 mb-1">
            {formatBytes($roomStore.receivedFile.size)}
          </div>
        </div>

        <!-- In-Browser Inline Preview Container (Image / Video / PDF / Large File) -->
        {#if $roomStore.receivedFile.blobUrl}
          <div class="w-full max-h-44 sm:max-h-52 overflow-hidden flex items-center justify-center bg-dark-surface rounded-xl p-2 border border-gray-700/60 my-1">
            {#if $roomStore.receivedFile.mime?.startsWith('image/')}
              <img src={$roomStore.receivedFile.blobUrl} alt={$roomStore.receivedFile.name} class="max-h-36 sm:max-h-44 rounded-lg object-contain" />
            {:else if $roomStore.receivedFile.mime?.startsWith('video/')}
              <!-- svelte-ignore a11y-media-has-caption -->
              <video src={$roomStore.receivedFile.blobUrl} controls class="max-h-36 sm:max-h-44 w-full rounded-lg"></video>
            {:else if $roomStore.receivedFile.mime === 'application/pdf'}
              <iframe src={$roomStore.receivedFile.blobUrl} class="w-full h-36 sm:h-44 rounded-lg border-none" title={$roomStore.receivedFile.name}></iframe>
            {:else}
              <div class="flex flex-col items-center justify-center p-3 space-y-1 text-gray-400">
                <FileText class="w-8 h-8 text-fire-500" />
                <span class="text-xs font-mono">{$roomStore.receivedFile.mime || 'Binary Stream'}</span>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Action Buttons: Download, Send Files & Clear -->
        <div class="flex items-center space-x-2.5 pt-1">
          <button
            type="button"
            on:click|stopPropagation={downloadReceivedFile}
            class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white-force font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition-all cursor-pointer border-none hover:scale-105"
          >
            <Download class="w-4 h-4 text-white-force" />
            <span>Download File</span>
          </button>

          <button
            type="button"
            on:click|stopPropagation={triggerSendFiles}
            class="px-4 py-2 bg-fire-500 hover:bg-fire-600 text-white-force font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-fire-500/20 flex items-center space-x-2 transition-all cursor-pointer border-none hover:scale-105"
          >
            <Send class="w-4 h-4 text-white-force" />
            <span>Send Files</span>
          </button>

          <button
            type="button"
            on:click|stopPropagation={clearReceivedFile}
            title="Clear & Dismiss"
            class="p-2 bg-dark-surface hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer border-none"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

    {:else if completedFile}
      <!-- STATE 3: Completed Sent Status Inside Container -->
      <div class="w-full max-w-sm flex flex-col items-center space-y-3 sm:space-y-4 my-auto animate-fadeIn">
        <div class="p-3 sm:p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 class="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400 animate-pulse" />
        </div>

        <div class="text-center w-full">
          <div class="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            File Sent Successfully!
          </div>

          <div class="text-[11px] font-mono text-gray-400 mb-1">
            Sender: You → Target: {formatPeerName(fileRecipient, $roomStore.peers, $roomStore.userProfile.nickname)}
          </div>

          <h3 class="text-sm sm:text-base font-bold text-white truncate max-w-full px-2">
            {completedFile.name}
          </h3>

          <div class="text-xs text-gray-400 font-mono mt-0.5">
            {formatBytes(completedFile.size)}
          </div>
        </div>

        <!-- Action Button: Send Files (Clears Cache & Opens File Picker) -->
        <button
          type="button"
          on:click|stopPropagation={triggerSendFiles}
          class="mt-2 px-5 py-2.5 bg-fire-500 hover:bg-fire-600 text-white-force font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-fire-500/20 flex items-center space-x-2 transition-all cursor-pointer border-none hover:scale-105"
        >
          <Send class="w-4 h-4 text-white-force" />
          <span>Send Files</span>
        </button>
      </div>

    {:else if stagedFile}
      <!-- STATE 4: Staged File Preview + Send Button -->
      <div class="w-full max-w-sm flex flex-col items-center space-y-3 sm:space-y-4 my-auto animate-fadeIn">
        <div class="p-3 sm:p-4 bg-dark-surface rounded-2xl border border-gray-700/60 shadow-lg">
          <FileText class="w-8 h-8 sm:w-12 sm:h-12 text-fire-500" />
        </div>

        <div class="text-center w-full">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Ready to Send
          </div>

          <div class="text-[11px] font-mono text-gray-400 mb-1">
            Sender: You → Target: <span class="text-fire-400 font-semibold">{formatPeerName(fileRecipient, $roomStore.peers, $roomStore.userProfile.nickname)}</span>
          </div>

          <h3 class="text-sm sm:text-base font-bold text-white truncate max-w-full px-2">
            {stagedFile.name}
          </h3>

          <div class="text-xs text-gray-400 font-mono mt-0.5">
            {formatBytes(stagedFile.size)}
          </div>
        </div>

        <!-- Relay Mode 20MB Exceeded Warning -->
        {#if isRelayExceeded}
          <div class="w-full p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex flex-col items-center space-y-1.5 text-center">
            <div class="flex items-center space-x-1.5 font-bold">
              <AlertCircle class="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>Relay Limit Exceeded (Max 20 MB)</span>
            </div>
            <p class="text-[11px] text-gray-300">
              WebSocket Relay Mode is capped at 20 MB per file. Switch to <strong class="text-fire-400">WebRTC P2P Mode</strong> for unlimited file transfers, or choose a smaller file.
            </p>
          </div>

          <!-- Action Buttons for Exceeded Size -->
          <div class="flex items-center space-x-2 pt-1">
            <button
              type="button"
              on:click|stopPropagation={switchToWebRTC}
              class="px-4 py-2.5 bg-gradient-to-r from-fire-600 to-fire-500 hover:from-fire-500 hover:to-fire-400 text-white-force font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-fire-600/30 flex items-center space-x-2 transition-all cursor-pointer border-none hover:scale-105 active:scale-95"
            >
              <Zap class="w-4 h-4 text-amber-400" />
              <span>Switch to WebRTC P2P</span>
            </button>

            <button
              type="button"
              on:click|stopPropagation={clearStagedFile}
              class="px-3.5 py-2.5 bg-dark-surface hover:bg-red-500/20 text-gray-300 hover:text-red-400 font-semibold text-xs rounded-xl transition-colors cursor-pointer border-none"
            >
              Change File
            </button>
          </div>
        {:else}
          <!-- Peer Validation Warning if peerCount <= 1 -->
          {#if !canSendFile}
            <div class="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs flex items-center space-x-1.5">
              <Users class="w-3.5 h-3.5 flex-shrink-0" />
              <span>Waiting for another peer to join room...</span>
            </div>
          {/if}

          <!-- Action Buttons inside DropZone -->
          <div class="flex items-center space-x-2 pt-1">
            <button
              type="button"
              on:click|stopPropagation={triggerSend}
              disabled={!canSendFile}
              title={!canSendFile ? 'Waiting for another peer to join room' : 'Send File'}
              class="px-5 py-2.5 bg-gradient-to-r from-fire-600 to-fire-500 hover:from-fire-500 hover:to-fire-400 text-white-force font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-fire-600/30 flex items-center space-x-2 transition-all cursor-pointer border-none hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Send class="w-4 h-4 text-white-force" />
              <span>{canSendFile ? 'Send File' : 'Waiting for Peer...'}</span>
            </button>

            <button
              type="button"
              on:click|stopPropagation={clearStagedFile}
              title="Remove File"
              class="p-2.5 bg-dark-surface hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer border-none"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        {/if}
      </div>

    {:else}
      <!-- STATE 5: Idle Drop Zone -->
      <div class="w-full max-w-sm flex flex-col items-center justify-center my-auto">
        <div class="p-3 sm:p-4 bg-gradient-to-br from-fire-500/20 to-fire-700/20 rounded-2xl border border-fire-500/30 mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
          <UploadCloud class="w-7 h-7 sm:w-9 sm:h-9 text-fire-500" />
        </div>

        <h3 class="text-sm sm:text-base font-bold text-white mb-1">
          {isDragging ? 'Release file to prepare for send' : 'Drop files or screenshots here'}
        </h3>

        <p class="text-xs text-gray-400 max-w-xs mb-2">
          Tap to browse or press <kbd class="px-2 py-0.5 bg-dark-surface rounded text-[11px] text-gray-300">Ctrl+V</kbd> to paste screenshot
        </p>

        <div class="flex items-center space-x-1.5 text-xs text-gray-400">
          <Clipboard class="w-3.5 h-3.5 text-fire-500" />
          <span class="text-[11px] sm:text-xs">In-memory 64KB AES-256 E2EE Relay</span>
        </div>
      </div>
    {/if}
  </div>

  <!-- Bottom Footer Info -->
  <div class="flex items-center justify-between pt-1.5 border-t border-gray-700/40 text-[11px] text-gray-400 flex-shrink-0 z-20 w-full">
    <span>Target: <strong class="text-gray-300">{formatPeerName(fileRecipient, $roomStore.peers, $roomStore.userProfile.nickname, true)}</strong></span>
    <span class="text-emerald-400 font-medium flex items-center space-x-1">
      <ShieldCheck class="w-3 h-3 text-emerald-400" />
      <span>AES-256 E2EE</span>
    </span>
  </div>
</div>
