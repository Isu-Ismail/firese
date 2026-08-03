<script>
  import { roomStore } from '../stores/roomStore.js';
  import { sendTextMessage, clearChatHistory } from '../services/chatService.js';
  import { formatPeerName } from '../services/peerUtils.js';
  import { Send, MessageSquare, Trash2, AlertCircle, Users } from '@lucide/svelte';
  import RecipientDropdown from './RecipientDropdown.svelte';
  import { onMount } from 'svelte';

  let messageInput = '';
  let recipient = 'group';
  
  /** @type {HTMLDivElement | null} */
  let chatContainer = null;
  let userScrolledUp = false;

  $: canInteract = $roomStore.isConnected;
  $: canSendChat = $roomStore.isConnected && $roomStore.peerCount >= 2;

  // Verify active recipient is connected or reset to group
  $: if (recipient !== 'group' && $roomStore.peers.length > 0) {
    const exists = $roomStore.peers.some(p => p.peerId === recipient || p.nickname === recipient);
    if (!exists) recipient = 'group';
  }

  // Filter messages strictly according to current recipient selection (peerId or 'group')
  $: filteredMessages = $roomStore.chatMessages.filter(msg => {
    if (recipient === 'group') {
      return msg.target === 'group' || msg.targetPeerId === 'group';
    } else {
      const myPeerId = $roomStore.userProfile.peerId;
      const myName = $roomStore.userProfile.nickname;
      
      const isFromTarget = (msg.senderPeerId && msg.senderPeerId === recipient) || (msg.sender === recipient);
      const isToTarget = (msg.targetPeerId && msg.targetPeerId === recipient) || (msg.target === recipient);
      const isToMe = (msg.targetPeerId && msg.targetPeerId === myPeerId) || (msg.target === myName);
      const isFromMe = (msg.senderPeerId && msg.senderPeerId === myPeerId) || (msg.sender === myName);

      return (isFromTarget && isToMe) || (isFromMe && isToTarget);
    }
  });

  function handleScroll() {
    if (!chatContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    userScrolledUp = distanceFromBottom > 60;
  }

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
      });
      userScrolledUp = false;
    }
  }

  // Auto-scroll when new messages arrive if user hasn't manually scrolled up
  $: if (filteredMessages && chatContainer && !userScrolledUp) {
    setTimeout(() => {
      if (chatContainer && !userScrolledUp) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 50);
  }

  function handleSend() {
    if (!canSendChat) return;
    if (messageInput.trim()) {
      sendTextMessage(messageInput.trim(), recipient);
      messageInput = '';
      userScrolledUp = false;
      setTimeout(scrollToBottom, 50);
    }
  }

  function handleClearChat() {
    clearChatHistory(recipient);
    const isPeerOnline = $roomStore.peers.some(p => p.peerId === recipient || p.nickname === recipient);
    if (recipient !== 'group' && !isPeerOnline) {
      recipient = 'group';
    }
  }

  /**
   * Helper to format recipient display label
   * @param {string} targetKey
   * @returns {string}
   */
  function getRecipientLabel(targetKey) {
    return formatPeerName(targetKey, $roomStore.peers, $roomStore.userProfile.nickname);
  }

  /**
   * @param {KeyboardEvent} e
   */
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && canSendChat) {
      e.preventDefault();
      handleSend();
    }
  }
</script>

<div class="w-full h-[340px] sm:h-[380px] lg:h-full lg:min-h-0 bg-dark-card rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between relative overflow-hidden">
  <!-- Header with Recipient Control Bar & Clear Chat Button -->
  <div class="flex items-center justify-between pb-2 mb-1 border-b border-gray-700/40 flex-shrink-0 z-20">
    <div class="flex items-center space-x-2">
      <MessageSquare class="w-5 h-5 text-fire-500" />
      <span class="font-bold text-sm sm:text-base text-white">Live Text Chat</span>
    </div>

    <!-- Recipient Custom Dropdown & Clear Button -->
    <div class="flex items-center space-x-2">
      <span class="text-xs text-gray-400 font-medium">To:</span>
      <RecipientDropdown bind:selected={recipient} disabled={!canInteract} />

      <!-- Clear Chat Trash Button -->
      <button
        type="button"
        on:click={handleClearChat}
        disabled={!canInteract}
        aria-label="Clear Chat History"
        title="Clear Chat History"
        class="p-1.5 bg-dark-surface rounded-xl hover-danger-btn flex items-center justify-center border-none cursor-pointer text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>

  <!-- Messages List Outer Container -->
  <div class="relative flex-1 min-h-0 mb-2 z-10">
    <!-- Hidden Scrollbar Message List -->
    <div
      bind:this={chatContainer}
      on:scroll={handleScroll}
      class="h-full overflow-y-auto space-y-2.5 pr-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {#if !canInteract}
        <div class="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs sm:text-sm space-y-2 p-4">
          <AlertCircle class="w-8 h-8 text-gray-500" />
          <p class="font-bold text-white">Connect to a Room to Chat</p>
          <p class="text-[11px] text-gray-400">Join a room to send and receive real-time messages</p>
        </div>
      {:else if $roomStore.peerCount <= 1 && filteredMessages.length === 0}
        <div class="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs sm:text-sm space-y-2 p-4">
          <Users class="w-8 h-8 text-amber-400 animate-pulse" />
          <p class="font-bold text-amber-300">Waiting for Another Peer</p>
          <p class="text-[11px] text-gray-400">Messages will be enabled once another peer joins this room</p>
        </div>
      {:else if filteredMessages.length === 0}
        <div class="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs sm:text-sm space-y-2">
          <MessageSquare class="w-8 h-8 text-gray-400 animate-pulse" />
          <p>No messages in {getRecipientLabel(recipient)}</p>
          <p class="text-[11px] text-gray-400">Send a message below to start chatting</p>
        </div>
      {:else}
        {#each filteredMessages as msg (msg.id)}
          {@const isSelf = (msg.senderPeerId && msg.senderPeerId === $roomStore.userProfile.peerId) || (msg.sender === $roomStore.userProfile.nickname)}
          <div class="flex flex-col {isSelf ? 'items-end' : 'items-start'}">
            <!-- Sender -> Recipient Metadata Header -->
            <div class="flex items-center space-x-1.5 mb-1 text-[11px] text-gray-400 font-mono">
              <span class="font-semibold text-gray-300">{isSelf ? 'You' : formatPeerName(msg.senderPeerId || msg.sender, $roomStore.peers, $roomStore.userProfile.nickname)}</span>
              <span class="text-fire-500">→</span>
              <span class="font-medium text-gray-400">{msg.target === 'group' || msg.targetPeerId === 'group' ? 'Group' : (isSelf ? formatPeerName(msg.targetPeerId || msg.target, $roomStore.peers, $roomStore.userProfile.nickname) : 'You')}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <!-- Message Bubble -->
            <div
              class="max-w-[85%] sm:max-w-md px-3.5 py-2 rounded-2xl text-xs sm:text-sm shadow-sm break-words
                {isSelf ? 'msg-bubble-self rounded-tr-none' : 'msg-bubble-peer rounded-tl-none'}"
            >
              {msg.text}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Message Input Bar (Disabled when not connected or peerCount <= 1) -->
  <div class="flex items-center space-x-2 pt-2 border-t border-gray-700/40 flex-shrink-0 z-20">
    <input
      type="text"
      placeholder={!$roomStore.isConnected
        ? 'Connect to a room to send messages...'
        : ($roomStore.peerCount <= 1
            ? 'Waiting for another peer to join room...'
            : (recipient === 'group' ? 'Type a message to room...' : `Private message to ${getRecipientLabel(recipient)}...`))}
      bind:value={messageInput}
      on:keydown={handleKeyDown}
      disabled={!canSendChat}
      class="flex-1 px-3.5 py-2 bg-dark-surface rounded-xl text-white text-xs sm:text-sm focus:outline-none placeholder:text-gray-400 border-none disabled:opacity-40 disabled:cursor-not-allowed"
    />
    <button
      type="button"
      on:click={handleSend}
      disabled={!canSendChat || !messageInput.trim()}
      title={!canSendChat ? 'Waiting for another peer to join room' : 'Send message'}
      class="px-4 py-2 bg-fire-500 hover:bg-fire-600 text-white-force rounded-xl font-semibold shadow-md flex items-center justify-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm border-none cursor-pointer"
    >
      <span>Send</span>
      <Send class="w-3.5 h-3.5 text-white-force" />
    </button>
  </div>
</div>
