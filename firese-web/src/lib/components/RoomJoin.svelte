<script>
  import { roomStore } from "../stores/roomStore.js";
  import { Flame, ArrowRight, User, Check } from "@lucide/svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
  let nickname = $roomStore.userProfile.nickname || "";
  let wantTour = typeof window !== 'undefined' ? localStorage.getItem('firese_tutorial_complete') !== 'true' : true;

  function handleSaveNickname() {
    const trimmed = nickname.trim();
    if (trimmed) {
      localStorage.setItem("firese_nickname", trimmed);
      roomStore.update((s) => ({
        ...s,
        userProfile: { ...s.userProfile, nickname: trimmed }
      }));

      if (wantTour) {
        dispatch("startTour");
      }
      dispatch("save");
    }
  }

  /**
   * @param {KeyboardEvent} e
   */
  function handleKeydown(e) {
    if (e.key === "Enter") {
      handleSaveNickname();
    }
  }
</script>

<div
  class="w-full max-w-md mx-auto bg-dark-card rounded-2xl p-6 sm:p-8 shadow-2xl transition-all"
>
  <!-- Header -->
  <div
    class="flex items-center space-x-3.5 mb-5 pb-4 border-b border-gray-700/40"
  >
    <div
      class="p-2.5 bg-gradient-to-br from-fire-500 to-fire-700 rounded-xl shadow-md shadow-fire-500/20 flex-shrink-0"
    >
      <Flame class="w-6 h-6 text-white-force animate-pulse" />
    </div>
    <div>
      <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">
        Set Display Nickname
      </h2>
      <p class="text-xs sm:text-sm text-gray-400">
        Enter your name to identify in peer rooms
      </p>
    </div>
  </div>

  <form on:submit|preventDefault={handleSaveNickname} class="space-y-4">
    <!-- Display Nickname Field -->
    <div>
      <label
        for="nickname-input"
        class="block text-xs font-semibold text-gray-400 mb-1.5">Nickname</label
      >
      <div class="relative">
        <div
          class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"
        >
          <User class="w-4 h-4" />
        </div>
        <input
          id="nickname-input"
          type="text"
          placeholder="Your name (e.g. absolute freak)..."
          bind:value={nickname}
          on:keydown={handleKeydown}
          class="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface rounded-xl text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-fire-500/30 transition-all placeholder:text-gray-400"
        />
      </div>
    </div>

    <!-- Custom Lucide Icon Styled Tour Toggle Button -->
    <button
      type="button"
      on:click={() => (wantTour = !wantTour)}
      class="w-full p-2.5 bg-dark-surface hover:bg-dark-surface-hover rounded-xl flex items-center space-x-2.5 text-left border-none cursor-pointer transition-colors"
    >
      <div class="w-5 h-5 rounded-md flex items-center justify-center transition-colors
        {wantTour ? 'bg-fire-500 text-white' : 'bg-gray-700/60 text-transparent'}"
      >
        <Check class="w-3.5 h-3.5" />
      </div>
      <span class="text-xs font-medium text-gray-300">
        Take a quick interactive app tour <span class="text-fire-400 font-semibold">(Recommended)</span>
      </span>
    </button>

    <!-- Save & Continue Button -->
    <button
      type="submit"
      disabled={!nickname.trim()}
      class="w-full mt-2 py-3 px-5 bg-gradient-to-r from-fire-600 to-fire-500 hover:from-fire-500 hover:to-fire-400 text-white-force font-semibold text-sm rounded-xl shadow-lg shadow-fire-600/30 flex items-center justify-center space-x-2 transition-all duration-150 ease-out cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100 group border-none"
    >
      <span>Save & Continue</span>
      <ArrowRight
        class="w-4 h-4 text-white-force group-hover:translate-x-1 transition-transform"
      />
    </button>
  </form>
</div>
