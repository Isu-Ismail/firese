<script>
  import RoomJoin from './lib/components/RoomJoin.svelte';
  import PeerStatus from './lib/components/PeerStatus.svelte';
  import DropZone from './lib/components/DropZone.svelte';
  import ChatPanel from './lib/components/ChatPanel.svelte';
  import ThemeSwitcher from './lib/components/ThemeSwitcher.svelte';
  import ServerSettingsModal from './lib/components/ServerSettingsModal.svelte';
  import FireseLogo from './lib/components/FireseLogo.svelte';
  import { roomStore } from './lib/stores/roomStore.js';
  import { endSessionAndClearCache } from './lib/services/websocket.js';
  import { Flame, ShieldCheck, HardDrive, User, Globe, LogOut, X, Server } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { fetchPublicIp } from './lib/services/ipService.js';
 
  let showMobileProfileModal = false;
  let showServerSettingsModal = false;

  onMount(() => {
    if (typeof window !== 'undefined') {
      const savedNickname = localStorage.getItem('firese_nickname');
      if (savedNickname) {
        roomStore.update(s => ({
          ...s,
          userProfile: { ...s.userProfile, nickname: savedNickname }
        }));
      }
    }
    fetchPublicIp();
  });
</script>

<main
  class="w-full max-w-full bg-dark-base text-gray-100 flex flex-col p-3 sm:p-4 relative transition-colors overflow-x-hidden
    {!$roomStore.userProfile.nickname
      ? 'h-screen max-h-screen overflow-hidden'
      : 'min-h-screen lg:h-screen lg:max-h-screen overflow-y-auto lg:overflow-hidden'}"
>
  <!-- Ambient Glow Accents -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-fire-600/10 rounded-full blur-3xl"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-fire-800/10 rounded-full blur-3xl"></div>
  </div>

  <!-- Header & Top Bar -->
  <header class="w-full max-w-6xl mx-auto flex items-center justify-between gap-2 py-2 px-3 sm:px-4 bg-dark-card rounded-2xl mb-2.5 shadow-lg transition-colors flex-shrink-0 flex-nowrap">
    <!-- Brand Logo + Version Badge -->
    <div class="flex items-center space-x-2.5 flex-shrink-0">
      <FireseLogo size={32} />
      <div class="flex flex-col justify-center leading-tight">
        <h1 class="text-base sm:text-lg font-bold tracking-tight text-white">Firese</h1>
        <div class="text-[10px] sm:text-xs text-fire-500 font-mono font-semibold mt-0.5 flex items-center space-x-1">
          <span>v1.0 • E2EE</span>
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        </div>
      </div>
    </div>

    <!-- Header Action Controls -->
    <div class="flex items-center space-x-1.5 sm:space-x-2 text-xs flex-shrink-0">
      <!-- Header E2EE Security Badge -->
      <div
        title="Zero-Knowledge AES-256 End-to-End Encrypted"
        class="hidden md:flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-mono font-semibold"
      >
        <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
        <span>AES-256 E2EE</span>
      </div>

      <!-- Relay Server Settings Button -->
      <button
        type="button"
        on:click={() => (showServerSettingsModal = true)}
        title="Relay Server Settings (Self-Hosted)"
        aria-label="Relay Server Settings"
        class="p-1.5 sm:px-3 sm:py-1.5 bg-dark-surface rounded-xl text-gray-300 hover:text-fire-500 hover:bg-fire-500/10 transition-colors cursor-pointer border-none flex items-center space-x-1.5"
      >
        <Server class="w-4 h-4 text-fire-500" />
        <span class="hidden sm:inline font-medium text-xs">Relay Node</span>
      </button>

      {#if $roomStore.userProfile.nickname}
        <!-- Desktop Profile Info Badge -->
        <div class="hidden sm:flex items-center space-x-2 bg-dark-surface rounded-xl px-3 py-1.5">
          <div class="flex items-center space-x-1.5 text-gray-300">
            <User class="w-3.5 h-3.5 text-fire-500" />
            <span class="font-semibold text-white">{$roomStore.userProfile.nickname}</span>
          </div>
          <span class="text-gray-400">|</span>
          <div class="flex items-center space-x-1 font-mono text-gray-400 text-[11px]">
            <Globe class="w-3 h-3 text-emerald-500" />
            <span>{$roomStore.userProfile.ip}</span>
          </div>
        </div>

        <!-- Desktop Logout Button -->
        <button
          type="button"
          on:click={endSessionAndClearCache}
          title="End Session & Clear Local Cache"
          aria-label="End Session & Clear Local Cache"
          class="hidden sm:flex p-2 sm:px-3 py-1.5 bg-dark-surface rounded-xl hover-danger-btn items-center justify-center space-x-1.5 border-none cursor-pointer"
        >
          <LogOut class="w-4 h-4 text-fire-500" />
          <span class="font-medium text-xs text-gray-400">Logout</span>
        </button>

        <!-- Mobile Profile Icon Button (Opens Profile Drawer Modal) -->
        <button
          type="button"
          on:click={() => (showMobileProfileModal = true)}
          title="View Profile Details"
          aria-label="View Profile Details"
          class="sm:hidden p-1.5 bg-dark-surface rounded-xl text-fire-500 hover:bg-fire-500/10 transition-colors cursor-pointer border-none flex items-center justify-center"
        >
          <User class="w-4 h-4 text-fire-500" />
        </button>
      {/if}

      <ThemeSwitcher />
    </div>
  </header>

  <!-- Main Content Container -->
  <div class="w-full max-w-6xl mx-auto flex-1 flex flex-col min-h-0 space-y-2.5 z-10">
    {#if !$roomStore.userProfile.nickname}
      <!-- Screen Centering for Nickname Entry Card -->
      <div class="flex-1 flex items-center justify-center w-full my-auto min-h-0">
        <RoomJoin />
      </div>
    {:else}
      <!-- Room Control Bar -->
      <PeerStatus />

      <!-- Side-by-Side Dual Panel Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch flex-1 min-h-0">
        <!-- Left Panel: File Relay -->
        <div class="flex flex-col h-full min-h-0">
          <DropZone />
        </div>

        <!-- Right Panel: Live Text Chat -->
        <div class="flex flex-col h-full min-h-0">
          <ChatPanel />
        </div>
      </div>
    {/if}
  </div>

  <!-- Mobile Profile Drawer Modal -->
  {#if showMobileProfileModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        on:click={() => (showMobileProfileModal = false)}
        aria-label="Close backdrop"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 border-none p-0 cursor-default"
      ></button>

      <div class="relative w-full max-w-xs bg-dark-card rounded-2xl p-5 shadow-2xl z-50 flex flex-col space-y-4 border-none animate-fadeIn">
        <div class="flex items-center justify-between border-b border-gray-700/40 pb-3">
          <div class="flex items-center space-x-2">
            <User class="w-5 h-5 text-fire-500" />
            <h3 class="font-bold text-base text-white">Your Profile</h3>
          </div>
          <button
            type="button"
            on:click={() => (showMobileProfileModal = false)}
            aria-label="Close modal"
            class="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-dark-surface transition-colors cursor-pointer border-none"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div class="bg-dark-surface p-3 rounded-xl flex items-center justify-between">
            <span class="text-gray-400">Nickname:</span>
            <span class="font-bold text-white font-mono">{$roomStore.userProfile.nickname}</span>
          </div>

          <div class="bg-dark-surface p-3 rounded-xl flex flex-col space-y-1">
            <span class="text-gray-400">IP Address:</span>
            <span class="font-mono text-emerald-400 font-medium text-[11px] break-all">{$roomStore.userProfile.ip}</span>
          </div>
        </div>

        <button
          type="button"
          on:click={() => { showMobileProfileModal = false; endSessionAndClearCache(); }}
          class="w-full py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer border-none"
        >
          <LogOut class="w-4 h-4 text-red-400" />
          <span>End Session & Clear Cache</span>
        </button>
      </div>
    </div>
  {/if}

  <!-- Self-Hosted Relay Server Settings Modal -->
  <ServerSettingsModal bind:isOpen={showServerSettingsModal} />

  <!-- Footer (Single Line Row with Tight Margins on Mobile & Desktop) -->
  <footer class="w-full max-w-6xl mx-auto mt-2.5 pt-2 border-t border-gray-700/40 text-[11px] sm:text-xs text-gray-500 flex flex-row items-center justify-between gap-2 flex-shrink-0">
    <div class="flex items-center space-x-1.5 truncate">
      <HardDrive class="w-3.5 h-3.5 text-fire-500 flex-shrink-0" />
      <span class="truncate">0 Disk Writes • In-Memory</span>
    </div>
    <div class="flex items-center space-x-1.5 font-mono text-emerald-400 font-medium flex-shrink-0">
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      <span>AES-256 E2EE</span>
    </div>
  </footer>
</main>
