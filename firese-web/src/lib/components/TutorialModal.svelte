<script>
  import { HelpCircle, X, ChevronRight, ChevronLeft, CheckCircle2, ShieldCheck, Flame, Zap, UploadCloud, MessageSquare, Users, Server, LogOut } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;

  const dispatch = createEventDispatcher();

  let currentStep = 0;

  const steps = [
    {
      title: 'Welcome to Firese!',
      subtitle: 'Zero-Knowledge E2EE Peer-to-Peer File Sharing & Live Chat',
      icon: Flame,
      color: 'text-fire-500',
      bg: 'from-fire-500/20 to-fire-700/20',
      description: 'Firese allows you to transfer files and chat directly with peers in real-time. All data is end-to-end encrypted with AES-256 in your browser before ever touching the network.'
    },
    {
      title: '1. Connect to a Secret Room',
      subtitle: 'Room Codes & Instant Share Links',
      icon: Users,
      color: 'text-amber-400',
      bg: 'from-amber-500/20 to-amber-700/20',
      description: 'Enter any custom Room ID or click Generate to create a room. Anyone with the same Room ID can connect to you instantly. Use the Share button to copy a direct room link.'
    },
    {
      title: '2. Transport Modes (P2P vs Relay)',
      subtitle: 'WebRTC Direct P2P & WebSocket Fallback',
      icon: Zap,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-emerald-700/20',
      description: 'By default, WebRTC connects directly P2P with no file size limits and 100MB/s+ speeds. If your college or corporate network blocks P2P, switch to WebSocket Relay mode in Relay Settings.'
    },
    {
      title: '3. Drag & Drop File Sharing',
      subtitle: 'Direct Peer Selection & Auto-Save',
      icon: UploadCloud,
      color: 'text-fire-400',
      bg: 'from-fire-500/20 to-fire-700/20',
      description: 'Drag & drop any file, click to browse, or press Ctrl+V to paste screenshots! You can send files to the whole Group or pick a specific peer. Turn Save ON to auto-download incoming files.'
    },
    {
      title: '4. Live Encrypted Text Chat',
      subtitle: 'Private & Group E2EE Messages',
      icon: MessageSquare,
      color: 'text-cyan-400',
      bg: 'from-cyan-500/20 to-cyan-700/20',
      description: 'Send instant encrypted text messages to everyone or target a single peer privately. Messages are never saved on any server and vanish when you close your tab.'
    },
    {
      title: '5. Connected Peers & Live Status',
      subtitle: 'View Room Members & Candidate Types',
      icon: Users,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-emerald-700/20',
      description: 'Click the Peers counter badge on the room bar to see who is currently in your room, view their display names, IP addresses, and inspect active P2P or Relay connections.'
    },
    {
      title: '6. End Session & Clear Cache',
      subtitle: 'Instant Memory & Local Storage Wipe',
      icon: LogOut,
      color: 'text-red-400',
      bg: 'from-red-500/20 to-red-700/20',
      description: 'Click the Logout button in the header or mobile drawer to instantly close WebRTC DataChannels, disconnect WebSockets, clear local cache, and wipe all file buffers from RAM.'
    }
  ];

  function handleComplete() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('firese_tutorial_complete', 'true');
    }
    isOpen = false;
    currentStep = 0;
    dispatch('close');
  }

  function handleSkip() {
    handleComplete();
  }

  function handleNext() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    } else {
      handleComplete();
    }
  }

  function handlePrev() {
    if (currentStep > 0) {
      currentStep--;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
    <!-- Backdrop dismiss handler -->
    <button
      type="button"
      class="absolute inset-0 bg-transparent border-none p-0 cursor-default"
      on:click={handleSkip}
      aria-label="Dismiss Tutorial"
    ></button>

    <div class="relative w-full max-w-lg bg-dark-card border border-gray-700/60 rounded-3xl p-5 sm:p-7 shadow-2xl z-10 flex flex-col justify-between space-y-5 animate-scaleUp">
      <!-- Top Bar: Step Indicator & Close Button -->
      <div class="flex items-center justify-between pb-3 border-b border-gray-700/40">
        <div class="flex items-center space-x-2">
          <div class="p-1.5 bg-fire-500/10 rounded-lg text-fire-500 font-bold text-xs font-mono">
            Step {currentStep + 1} of {steps.length}
          </div>
          <span class="text-xs font-medium text-gray-400 hidden sm:inline">Firese Quick Tour</span>
        </div>

        <button
          type="button"
          on:click={handleSkip}
          class="p-1.5 text-gray-400 hover:text-white bg-dark-surface rounded-xl transition-colors cursor-pointer border-none"
          title="Skip Tour"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Step Content Area -->
      {#each [steps[currentStep]] as step (currentStep)}
        <div class="flex flex-col items-center text-center space-y-3 py-1 animate-fadeIn">
          <div class="p-3.5 bg-gradient-to-br {step.bg} rounded-2xl border border-gray-700/60 shadow-xl">
            <svelte:component this={step.icon} class="w-9 h-9 sm:w-11 sm:h-11 {step.color}" />
          </div>

          <div>
            <h3 class="text-base sm:text-lg font-bold text-white tracking-tight">
              {step.title}
            </h3>
            <p class="text-xs font-semibold text-fire-400 mt-0.5">
              {step.subtitle}
            </p>
          </div>

          <p class="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-md">
            {step.description}
          </p>

          <!-- Step 2 Special UI Preview (Relay Node Header Icon & Transport Mode badges) -->
          {#if currentStep === 2}
            <div class="w-full bg-dark-surface p-3 rounded-2xl border border-gray-700/60 flex flex-col items-center space-y-2 mt-1">
              <div class="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                <span>Click Top Bar Header Button:</span>
              </div>
              
              <!-- Header Relay Node Button Mock -->
              <div class="px-3 py-1.5 bg-dark-card rounded-xl text-gray-200 border border-fire-500/40 shadow-sm flex items-center space-x-1.5 text-xs font-semibold">
                <Server class="w-4 h-4 text-fire-500" />
                <span>Relay Node</span>
              </div>

              <!-- Select Transport Mode Options -->
              <div class="grid grid-cols-2 gap-2 w-full pt-1">
                <div class="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col items-center text-center space-y-0.5">
                  <div class="text-emerald-400 font-bold text-[11px] flex items-center space-x-1">
                    <Zap class="w-3 h-3 text-amber-400" />
                    <span>WebRTC P2P</span>
                  </div>
                  <span class="text-[10px] text-gray-400">Direct 100MB/s+ (No limits)</span>
                </div>

                <div class="p-2 bg-fire-500/10 border border-fire-500/30 rounded-xl flex flex-col items-center text-center space-y-0.5">
                  <div class="text-fire-400 font-bold text-[11px] flex items-center space-x-1">
                    <Server class="w-3 h-3 text-fire-400" />
                    <span>WebSocket Relay</span>
                  </div>
                  <span class="text-[10px] text-gray-400">For strict college firewalls</span>
                </div>
              </div>
            </div>
          {:else if currentStep === 5}
            <!-- Step 5 Peers Status Preview -->
            <div class="w-full bg-dark-surface p-3 rounded-2xl border border-gray-700/60 flex flex-col items-center space-y-2 mt-1">
              <div class="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
                Room Bar Peers Counter:
              </div>
              <div class="h-8 px-3 rounded-full text-xs text-gray-300 bg-dark-card border border-fire-500/30 flex items-center justify-center space-x-1.5 font-semibold">
                <Users class="w-3.5 h-3.5 text-fire-500" />
                <span class="font-mono font-bold text-white">2 Peers Connected</span>
              </div>
            </div>
          {:else if currentStep === 6}
            <!-- Step 6 Logout & Clear Cache Preview -->
            <div class="w-full bg-dark-surface p-3 rounded-2xl border border-gray-700/60 flex flex-col items-center space-y-2 mt-1">
              <div class="text-[11px] font-mono text-gray-400 font-semibold uppercase tracking-wider">
                Header Logout Button:
              </div>
              <div class="px-3.5 py-1.5 bg-red-500/15 border border-red-500/30 text-red-400 font-semibold text-xs rounded-xl flex items-center space-x-2">
                <LogOut class="w-4 h-4 text-red-400" />
                <span>End Session & Clear Cache</span>
              </div>
            </div>
          {/if}
        </div>
      {/each}

      <!-- Progress Dots -->
      <div class="flex items-center justify-center space-x-1.5 pt-1">
        {#each steps as _, idx}
          <button
            type="button"
            on:click={() => (currentStep = idx)}
            class="h-2 rounded-full transition-all border-none cursor-pointer p-0
              {idx === currentStep ? 'w-6 bg-fire-500' : 'w-2 bg-gray-700 hover:bg-gray-500'}"
            aria-label="Go to step {idx + 1}"
          ></button>
        {/each}
      </div>

      <!-- Footer Buttons -->
      <div class="flex items-center justify-between pt-2 border-t border-gray-700/40">
        <button
          type="button"
          on:click={handleSkip}
          class="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white bg-transparent border-none cursor-pointer transition-colors"
        >
          Skip Tour
        </button>

        <div class="flex items-center space-x-2">
          {#if currentStep > 0}
            <button
              type="button"
              on:click={handlePrev}
              class="px-4 py-2 bg-dark-surface hover:bg-gray-700 text-gray-200 font-semibold text-xs rounded-xl flex items-center space-x-1 transition-all cursor-pointer border-none"
            >
              <ChevronLeft class="w-4 h-4" />
              <span>Back</span>
            </button>
          {/if}

          <button
            type="button"
            on:click={handleNext}
            class="px-5 py-2 bg-gradient-to-r from-fire-600 to-fire-500 hover:from-fire-500 hover:to-fire-400 text-white-force font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-fire-600/30 flex items-center space-x-1.5 transition-all cursor-pointer border-none hover:scale-105"
          >
            <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
            {#if currentStep < steps.length - 1}
              <ChevronRight class="w-4 h-4 text-white-force" />
            {:else}
              <CheckCircle2 class="w-4 h-4 text-emerald-300" />
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
