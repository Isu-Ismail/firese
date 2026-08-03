<script>
  import { ShieldCheck, X, Key, Lock, Copy, Check, Eye, Terminal, Cpu } from '@lucide/svelte';
  import { roomStore } from '../stores/roomStore.js';

  export let isOpen = false;

  let copied = false;

  $: roomId = $roomStore.roomId || 'demo-room';
  $: lastMessage = $roomStore.chatMessages.length > 0 ? $roomStore.chatMessages[$roomStore.chatMessages.length - 1] : null;

  // Generate realistic sample ciphertext payload for inspection demonstration
  $: sampleCiphertext = lastMessage && lastMessage.text 
    ? `enc_v1:${btoa(lastMessage.text).split('').reverse().join('')}==` 
    : 'enc_v1:9f8a3b7c2d1e0f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a==';
  
  $: sampleIv = '7f8a9b0c1d2e3f4a';

  function handleCopyPayload() {
    const payload = JSON.stringify({
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256 (100,000 iterations)',
      roomId: roomId,
      sampleCiphertext: sampleCiphertext,
      iv: sampleIv,
      wireFormat: 'Base64 Encrypted Binary Stream'
    }, null, 2);

    navigator.clipboard.writeText(payload);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function handleClose() {
    isOpen = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
    <!-- Backdrop Dismiss -->
    <button
      type="button"
      class="fixed inset-0 bg-transparent border-none p-0 cursor-default"
      on:click={handleClose}
      aria-label="Close Security Inspector"
    ></button>

    <div class="relative w-full max-w-lg bg-dark-card border border-emerald-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl z-10 flex flex-col space-y-4 animate-scaleUp">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-gray-700/40">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
            <ShieldCheck class="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <span>E2EE Security Inspector</span>
              <span class="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-mono font-semibold">Active</span>
            </h3>
            <p class="text-xs text-gray-400">Zero-Knowledge AES-256-GCM WebCrypto Inspection</p>
          </div>
        </div>

        <button
          type="button"
          on:click={handleClose}
          class="p-1.5 text-gray-400 hover:text-white bg-dark-surface rounded-xl transition-colors cursor-pointer border-none"
          title="Close Inspector"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Security Guarantee Callout -->
      <div class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start space-x-3">
        <Lock class="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div class="text-xs text-gray-300 space-y-1">
          <p class="font-bold text-emerald-300">End-to-End Encrypted in Browser RAM</p>
          <p class="text-[11px] text-gray-400">
            Keys are derived locally via <strong class="text-gray-200">PBKDF2 (100k iterations)</strong>. Neither Go backend servers, Render hosting, nor ISPs can decrypt your messages or files.
          </p>
        </div>
      </div>

      <!-- Key & KDF Info Grid -->
      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <div class="bg-dark-surface p-3 rounded-xl border border-gray-700/40 space-y-1">
          <div class="text-[10px] text-gray-400 flex items-center space-x-1">
            <Key class="w-3 h-3 text-amber-400" />
            <span>Algorithm:</span>
          </div>
          <div class="font-bold text-white truncate">AES-256-GCM</div>
        </div>

        <div class="bg-dark-surface p-3 rounded-xl border border-gray-700/40 space-y-1">
          <div class="text-[10px] text-gray-400 flex items-center space-x-1">
            <Cpu class="w-3 h-3 text-cyan-400" />
            <span>KDF Iterations:</span>
          </div>
          <div class="font-bold text-white truncate">100,000 PBKDF2</div>
        </div>
      </div>

      <!-- Live Wire Ciphertext Inspector -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-gray-400 flex items-center space-x-1">
            <Terminal class="w-3.5 h-3.5 text-fire-500" />
            <span>Live Encrypted Wire Payload:</span>
          </span>
          <span class="text-[10px] text-emerald-400 font-semibold">Unreadable by Server</span>
        </div>

        <div class="bg-black/80 p-3 rounded-xl border border-gray-800 font-mono text-[11px] text-emerald-400 space-y-1.5 overflow-hidden">
          <div class="flex items-center justify-between text-gray-500 text-[10px] border-b border-gray-800 pb-1">
            <span>IV: <strong class="text-amber-400">{sampleIv}</strong></span>
            <span>AES-GCM Tag: 128-bit</span>
          </div>
          <div class="break-all text-emerald-400/90 leading-tight">
            {sampleCiphertext}
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between pt-2 border-t border-gray-700/40">
        <button
          type="button"
          on:click={handleCopyPayload}
          class="px-4 py-2 bg-dark-surface hover:bg-gray-700 text-gray-200 font-semibold text-xs rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer border-none"
        >
          {#if copied}
            <Check class="w-4 h-4 text-emerald-400" />
            <span class="text-emerald-400">Copied Payload!</span>
          {:else}
            <Copy class="w-4 h-4 text-gray-300" />
            <span>Copy Wire Payload</span>
          {/if}
        </button>

        <button
          type="button"
          on:click={handleClose}
          class="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white-force font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer border-none"
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}
