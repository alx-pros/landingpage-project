# DeepWave — The Future of Deep Focus

A majestic 3D ocean landing page built with cutting-edge web technologies. DeepWave showcases an immersive interactive scene with dynamic water simulation, realistic sky rendering, animated marine life, and a beautiful waitlist experience.

## 🌊 The 3D Ocean Scene

### Overview

The scene is built on **React Three Fiber** (R3F) and **Three.js**, featuring a fully dynamic 3D environment that evolves throughout the day—from dawn to dusk to night. The scene is rendered as a fixed-position canvas overlay with a camera positioned 90 units forward and 22 units above the water surface, providing a serene, immersive perspective.

### Core Components

#### **Sky System** (`OceanScene.tsx`, `sceneConfig.ts`)

- **Parametric Sky Rendering**: Uses Three.js's Sky shader with dynamically adjusted Rayleigh scattering, turbidity, and Mie coefficients
- **Time-Based Transitions**: The scene transitions smoothly between day, twilight, and night cycles using interpolated parameters
- **Sun & Moon Positioning**: Realistic celestial positioning with spherical coordinate calculations
- **Constellations**: Six hand-crafted star constellations with line connections, visible during twilight and night
- **Dynamic Lighting**: Ambient light intensity adjusts based on time of day (0.14 day → 0.04 night)
- **Color Grading**: Smooth color transitions:
  - Day: Bright cyan skies (#f7fbff)
  - Twilight: Warm orange (#ffa264)
  - Night: Deep indigo (#6d86c2)

#### **Water Simulation** (`Ocean.tsx`)

- **Shader-Based Waves**: Uses Three.js Water object with Gerstner wave implementation
- **Real-Time Reflections**: Water reflects sun/moon with dynamic intensity based on time and angle
- **Distortion Mapping**: Applies normals texture for realistic wave details (512×512 resolution)
- **Adaptive Parameters**:
  - Distortion scale: 1.35 (day) → 2.5 (night)
  - Alpha blending: 0.76 (day) → 0.88 (night)
  - Time scaling: 0.12 global wave speed

#### **Encounters & Dolphin AI** (`SceneEncounters.tsx`)

The scene features intelligent animated dolphins with sophisticated behavioral systems:

- **Skeletal Animation System**: Uses glTF models with Three.js SkeletonUtils for animation blending
- **6 Animation States**:
  - Classic Leap (1.72s)
  - Arcing Leap (1.95s)
  - Side Flip (1.5s)
  - Front Flip (1.82s)
  - Back Flip (1.9s)
  - Twist Flip (1.86s)

- **Motion Behaviors**:
  - **Cruise Phase**: Smooth swimming in orbital patterns, depth ranges 12-200 units
  - **Surface Approach**: Ascending toward water surface for jumping
  - **Airborne Phase**: Synchronized jumping with physics-based trajectories
  - **Dive Recovery**: Smooth descent back to cruising depth

- **Pod Behavior**: Dolphins exhibit social grouping:
  - Pod formations trigger at 85% probability when in proximity
  - Members coordinate jumps with leader announcement system
  - Social distance maintained at ~1500 units
  - Cooldown period prevents immediate re-grouping

- **Seeded Randomization**: Each dolphin gets deterministic random behaviors using custom seeded PRNG for consistency

#### **Post-Processing** (`OceanCavas.tsx`)

- **Bloom Effect**: Enhances sun/moon glow and water reflections
  - Day strength: 5
  - Twilight strength: 0.34
  - Night strength: 0.08
- **Tone Mapping**: ACES Filmic tone mapping for cinematic color grading (exposure: 0.1)
- **Progressive Loading**: Smooth fade-in of scene with progress tracking

### Scene Configuration Details

The scene behavior is controlled through `sceneConfig.ts`, which defines parameters across 8 categories:

1. **Sky**: Rayleigh scattering, turbidity, Mie coefficients for each time period
2. **Colors**: Precise hex values for lights, water, and atmospheric colors
3. **Exposure**: Tone mapping adjustments for brightness balance
4. **Light**: Directional and ambient light intensities
5. **Water**: Distortion, size, opacity, animation speed
6. **Bloom**: Strength, radius, threshold for post-processing
7. **Clouds**: Coverage, density, movement speed (currently minimal)
8. **Sun**: Core scale, halo effect, reflection intensity

### Time System (`timeUtils.ts`, `sceneParams.ts`)

- **Real-Time or Overridable**: Scene time defaults to browser's current time but supports manual override
- **Scene Date Calculation**: Computes sun/moon elevation and azimuth for any given moment
- **Smooth Transitions**: Uses sine-based easing between day/twilight/night states
- **Location-Based**: Scene params support geographic location input (default: equator modeling)

## 🎨 Landing Page Design

### Visual Identity

The landing page embraces a **luxury, deep-focus aesthetic** with:

- **Color Palette**:
  - Primary: Ink Dark (#03070f) — full-screen canvas background
  - Accent: Glow Teal (#0BC6B4) — UI highlights, progress indicators
  - Secondary: Gold (#e8c97a) — premium accents
  - Text: White with strategic shadows for depth

- **Typography**:
  - Display Font: Libre Baskerville (serif, 400/700 weights) — headlines, logo
  - Body Font: Cormorant Garamond (serif, 300/400/600 weights) — text, interactive elements
  - Monospace: System font for technical elements

### Layout & Components

#### **Main Canvas** (`OceanCavas.tsx`)

- Fixed fullscreen overlay (z-index: 0)
- Progressive rendering with loading overlay
- Wave-based progress indicator during load
- Responsive DPR (device pixel ratio) scaling for performance

#### **UI Overlays**

- **Logo** (`public/Logo.tsx`): Positioned top-left, elegant serif mark
- **Music Toggle** (`MusicToggle.tsx`): Top-right control for ambient audio
- **Scene Time Panel** (`SceneTimePanel.tsx`): Displays current scene time with adjustable hour slider
- **Waitlist Form** (`WaitingListPage.tsx`): Central CTA with particle animation on text input

#### **Animations & Interactions**

- **Fade Up**: Content slides up with 0.9s ease
- **Fade Down**: Alternative entrance from top with 1s ease
- **Rise In**: Prominent elements with cubic-bezier easing (1.2s)
- **Pulse Dot**: Pulsing indicators at 2.5s interval
- **Text Particle Dispersion**: Email input text breaks into particles and fades on submission

### Form Experience

The waitlist form includes:

- **Animated Placeholder**: Cycles through multiple CTA phrases every 3 seconds
- **Particle Canvas**: HTML5 canvas draws email text and animates dispersal
- **Custom Blur Effect**: Text characters dissolve with random motion and fade
- **Validation**: Email regex pattern verification
- **Submitted State**: Success feedback with cleared input

### CSS Utilities

Custom Tailwind layer utilities provide:

- `.ocean-veil`: Layered gradient for atmospheric depth
- `.text-ocean`: Multi-layer text-shadow for legibility on canvas
- `.glow-dot`: Box-shadow effect for teal accent glow
- `.input-focus-ring`: Custom focus state with teal border and subtle glow

## 🛠️ Technical Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js | 16.2.1 |
| **Rendering** | React + React Three Fiber | 19.2.4 + 9.5.0 |
| **3D Engine** | Three.js | 0.183.2 |
| **3D Assets** | Drei (helpers) | 10.7.7 |
| **Animation** | Framer Motion | 12.38.0 |
| **Styling** | Tailwind CSS | 4.2.2 |
| **Post-Processing** | @react-three/postprocessing | 3.0.4 |
| **TypeScript** | TypeScript | 5.x |

### Performance Optimizations

- **Dynamic Imports**: Canvas component uses `dynamic()` with SSR disabled
- **Lazy Loading**: Models preload asynchronously with Drei's Preload
- **DPR Clamping**: Renders at max 1.5 DPR to maintain 60fps on high-density displays
- **Efficient Re-Renders**: useFrame hooks update only when necessary
- **Shader Optimization**: Water and sky use optimized Three.js built-in shaders

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm build
npm start
```

Visit `http://localhost:3000` to experience DeepWave.

## 📁 Project Structure

```
app/
├── globals.css          # Theme colors, animations, utilities
├── layout.tsx           # Metadata, fonts, viewport config
└── page.tsx             # Home page entry point

components/
├── WaitingListPage.tsx  # Main UI component
├── OceanCavas.tsx       # Canvas setup & loading overlay
├── MusicToggle.tsx      # Audio control
├── SceneTimePanel.tsx   # Time display/override
├── musicConfig.ts       # Audio configuration
└── scene/
    ├── OceanScene.tsx   # Main 3D scene orchestration
    ├── Ocean.tsx        # Water shader implementation
    ├── SceneEncounters.tsx # Dolphin AI system
    ├── sceneParams.ts   # Global scene parameters
    ├── sceneConfig.ts   # Time-based config values
    └── timeUtils.ts     # Sun/moon calculations
```

## 🎯 Key Features

✨ **Real-Time 3D Rendering** — Immersive ocean environment with physical accuracy
🌅 **Dynamic Time System** — Day/night cycles with smooth transitions
🐬 **Intelligent Dolphins** — Behavioral AI with pod dynamics and social grouping
💎 **Luxury Design** — Premium typography, color, and animation language
📱 **Responsive** — Works on desktop and mobile with adaptive performance
⚡ **Optimized** — Lazy loading, shader optimization, and efficient rendering

## 🔮 Future Enhancements

- Cloud particle system expansion
- Interactive island/volcano models
- Cliffside environmental details
- Audio reactive dolphin behavior
- WebGL shader variations for mobile fallback

---

**DeepWave** — Where focus meets beauty. 🌊
