# VODplus AI Instructions

## Core Principle

This project is a video aggregation platform. The player is the core feature. Changes must be extremely cautious.

## Protected Features (DO NOT DELETE OR DOWNGRADE)

Before any optimization, refactoring, or performance improvement, you MUST read `PROTECTED_FEATURES.md` first.

The following features MUST NEVER be deleted, downgraded, or replaced with empty implementations:

### Player Core
- Episode management: currentEpIndex state, auto-play next, prev/next episode switching
- Episode list UI: virtualized windowed rendering, current episode highlight, progress indicator
- Video scale: 1x/1.5x/2x/3x/fit-height buttons, scale state persisted to sessionStorage
- HLS adaptive quality switching
- Playback speed control
- Progress bar drag and click-to-seek
- Mobile gesture controls: volume, brightness, seek
- Long-press speed boost, double-tap forward/backward
- Settings panel: quality, speed, scale, buffer strategy, skip intro

### Player Container (ClientPlayerWrapper)
- MUST manage currentEpIndex state
- MUST use full episodes array for episode switching (NEVER only episodes[0])
- MUST pass onEnded/onPrevEpisode/onNextEpisode to VideoPlayer

## Optimization Rules

1. **Diff before editing** - Before modifying any player file, run `git diff 07850eb..HEAD -- <file>` to check baseline
2. **Only add, never subtract** - Optimizations should ADD on top of existing features, not replace or remove them
3. **Preserve event propagation** - stopPropagation, preventDefault handlers must not be removed
4. **Preserve state persistence** - sessionStorage/videoScale persistence logic must not be removed
5. **No encoding corruption** - Chinese comments, titles, descriptions must stay UTF-8. NO garbled text.

## File Reference

| File | Description |
|---|---|
| `CLAUDE.md` | AI coding behavior guidelines |
| `PROTECTED_FEATURES.md` | Detailed protected feature manifest |
| `AGENTS.md` | This file - project-level AI instructions |
| `src/config/config.ts` | Global config, Chinese comments must not be garbled |
| `src/app/page.tsx` | Homepage, Chinese section titles must not be removed |
| `src/app/layout.tsx` | Root layout, description must stay Chinese |
| `src/app/movie/[sourceId]/[id]/ClientPlayerWrapper.tsx` | Play page core container |
| `src/components/VideoPlayer.tsx` | Video player component |
| `src/components/player/` | Player sub-components directory |
| `src/hooks/useVideoPlayer.ts` | Player core hook |
| `src/hooks/player/` | Player sub-hooks directory |
