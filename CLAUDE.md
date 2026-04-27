# VODPlus — Video Aggregation & Streaming Platform

## Project Overview

VODPlus is a Next.js 15 (App Router) video aggregation platform deployed on Cloudflare Pages (Edge Runtime). It aggregates video sources from multiple third-party APIs, streams HLS/MP4 content via hls.js, and provides metadata enrichment through TMDB.

- **Stack:** Next.js 15.5, React 19, TypeScript 5, Tailwind CSS 4, hls.js 1.6
- **Deployment:** Cloudflare Pages (`@opennextjs/cloudflare`)
- **Runtime:** Edge (with ISR via `unstable_cache`)

## Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── page.tsx              # Home — Suspense-streamed movie/tv sections
│   ├── layout.tsx            # Root layout (zh-CN, system fonts, no-referrer)
│   ├── globals.css           # Tailwind v4 @import "tailwindcss"
│   ├── movie/[sourceId]/[id]/ # Player/detail page
│   ├── search/               # Full-text search
│   ├── latest/               # Latest movies listing
│   └── api/vod/              # API routes (search, latest, health)
├── components/
│   ├── VideoPlayer.tsx        # Main video player (orchestrator)
│   ├── player/
│   │   ├── VideoControls.tsx  # Controls overlay (mobile/desktop layouts)
│   │   ├── VideoProgressBar.tsx # Progress bar with drag-seek (Pointer Events)
│   │   ├── ControlButtons.tsx # Settings, fullscreen, PIP buttons
│   │   ├── PlayerSettingsPanel.tsx # Resolution, speed, buffer, scale settings
│   │   └── EpisodeControls.tsx # Prev/next episode navigation
│   ├── Header.tsx, Footer.tsx, MovieCard.tsx, ScrollToTop.tsx
│   └── home/, latest/, search/ # Page-specific components
├── hooks/
│   ├── useVideoPlayer.ts      # ORCHESTRATOR — composes all player sub-hooks
│   └── player/
│       ├── useHlsSource.ts    # HLS lifecycle: load, switch source, hot-reload
│       ├── useVideoEvents.ts  # Video element events: progress, buffering, state
│       ├── useVideoSeek.ts    # Progress bar drag-to-seek logic
│       ├── useVideoControls.ts # Control visibility, video click, fullscreen
│       ├── useVideoGestures.ts # Mobile touch gestures (volume, brightness, seek)
│       ├── useVideoKeyboard.ts # Desktop keyboard shortcuts
│       ├── useVideoSettings.ts # Settings panel state (resolution, rate, scale)
│       └── usePlaybackHealth.ts # Stall detection & auto-skip recovery
├── config/
│   └── config.ts             # ALL tunable constants in one place
├── lib/
│   ├── services/             # Data fetching layer
│   │   ├── vodService.ts     # Core: source fetching, matching, mixed categories
│   │   ├── fetcher.ts        # HTTP fetcher with caching strategy
│   │   ├── normalizer.ts     # API response normalization
│   │   └── errorHandler.ts   # Error handling wrappers
│   ├── resources.ts          # Resource site definitions (8 sources)
│   ├── vodParser.ts          # Parse VOD play URLs ($name$url#name$url)
│   ├── metadata/             # TMDB metadata provider
│   ├── player-utils.ts       # formatTime helper
│   ├── utils.ts              # cn() classname merger
│   ├── preferences.ts        # Cookie-based user preferences
│   ├── api.ts, tmdb.ts, logger.ts
├── types/
│   └── index.ts              # Movie, ApiResponse, Episode interfaces
```

## Architecture Patterns

### Player Architecture (CRITICAL)

The player uses an **orchestrator pattern** — `useVideoPlayer` is the single hook that composes ~8 sub-hooks and returns a unified API object. Sub-hooks are called in dependency order:

1. `useHlsSource` — HLS lifecycle
2. `useVideoSettings` — Settings state
3. `usePlaybackHealth` — Stall recovery
4. `useVideoEvents` — Video element events → progress/duration/buffered
5. `useVideoGestures` — Touch gestures
6. `useVideoSeek` — Seek/drag logic
7. `useVideoControls` — UI visibility, clicks
8. `useVideoKeyboard` — Keyboard shortcuts

**Data flows down** — the orchestrator owns cross-cutting state (volume, muted, rate, scale) and passes subsets to child components via memoized APIs. **Events flow up** — callbacks from sub-hooks wire back to the orchestrator.

### Progress Bar Drag System

Uses **Pointer Events** (not touch events) for unified mouse/touch drag handling:
- `VideoProgressBar` handles visual rendering with local `dragProgressLive` state
- `useVideoSeek` handles the actual seek logic with `dragProgressRef` (ref-based for latest value)
- Both must agree on drag state — ensure `isDraggingRef.current` is set **synchronously** in `handleSeekStart`

### HLS Hot-Reload Pattern

When buffer config changes at runtime:
1. Update `hls.config` properties
2. Call `hls.stopLoad()` then `hls.startLoad()` to enforce new limits
(From team memory: `hot-reload-buffer-config.md`)

### Cloudflare Pages Limitations

- Shallow clones in CF Pages builds (from team memory)
- Use `CF_PAGES_*` env vars instead of git commands
- All API routes and server components use `export const runtime = 'edge'`

## Key Conventions

- **All tunable constants** go in `src/config/config.ts` — never hardcode magic numbers
- **Comments in Chinese** — the codebase uses Chinese for code comments
- **API data flow**: Resource API → fetcher → normalizer → vodService → components
- **Movie matching**: TMDB metadata → search all sources in parallel → "race to N" → select best match
- **Episode parsing**: `parseVodPlayUrl()` handles `name$url#name2$url2` format with `$$$` multi-playlist separator
