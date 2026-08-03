<script>
  export let size = 32; // Default size in pixels
  export let className = "";
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="96 48 320 432"
  width={size}
  height={size}
  class={className}
>
  <defs>
    <!-- Dark Background Glow -->
    <radialGradient id="logoBgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF3366" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#12131A" stop-opacity="0"/>
    </radialGradient>

    <!-- Main Flame Gradient -->
    <linearGradient id="logoFlameGrad" x1="0%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="#E60045"/>
      <stop offset="45%" stop-color="#FF3366"/>
      <stop offset="85%" stop-color="#FF8800"/>
      <stop offset="100%" stop-color="#FFDD00"/>
    </linearGradient>

    <!-- Inner Core Glow Gradient -->
    <linearGradient id="logoInnerCoreGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#FF8800"/>
      <stop offset="70%" stop-color="#FFDD00"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>

    <!-- File Outline Glass Gradient -->
    <linearGradient id="logoFileGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF3366" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#FF8800" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.8"/>
    </linearGradient>

    <!-- Soft Glow Filter -->
    <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- File Container Shape with Folded Corner -->
  <g filter="url(#logoGlow)">
    <!-- Main File Body -->
    <path
      d="M 128 72 
         L 304 72 
         L 384 152 
         L 384 424 
         C 384 446.1 366.1 464 344 464 
         L 168 464 
         C 145.9 464 128 446.1 128 424 
         Z" 
      fill="transparent" 
      stroke="url(#logoFileGlass)" 
      stroke-width="16" 
      stroke-linejoin="round"
      stroke-linecap="round"
    />

    <!-- Folded Corner Ribbon -->
    <path
      d="M 304 72 
         L 304 140 
         C 304 146.6 309.4 152 316 152 
         L 384 152" 
      fill="none" 
      stroke="url(#logoFileGlass)" 
      stroke-width="16" 
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </g>

  <!-- Fire Flame Silhouette inside the File -->
  <g transform="translate(256, 300) scale(1.15)">
    <!-- Outer Main Flame -->
    <path
      d="M 0 -130
         C 25 -90 65 -60 65 0
         C 65 42 36 70 0 70
         C -36 70 -65 42 -65 0
         C -65 -50 -35 -85 -20 -105
         C -15 -112 -5 -90 5 -75
         C 10 -65 5 -110 0 -130 Z" 
      fill="url(#logoFlameGrad)"
    />

    <!-- Inner Hot Core Flame -->
    <path
      d="M 0 -75
         C 15 -50 35 -30 35 5
         C 35 28 20 42 0 42
         C -20 42 -35 28 -35 5
         C -35 -25 -18 -48 -10 -60
         C -8 -64 -2 -50 2 -40
         C 5 -35 2 -65 0 -75 Z" 
      fill="url(#logoInnerCoreGrad)"
    />

    <!-- Upward Transfer Arrow Core Cutout -->
    <path
      d="M -12 -5 
         L 0 -22 
         L 12 -5 
         M 0 -22 
         L 0 20" 
      fill="none" 
      stroke="#12131A" 
      stroke-width="7" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    />
  </g>
</svg>
