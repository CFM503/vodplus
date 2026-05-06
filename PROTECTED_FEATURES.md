# Protected Features Manifest

This document lists ALL features that must be preserved during any code optimization or refactoring.
Reference commit: `07850eb` (v0.5.0) - the last stable version with all features intact.

## CRITICAL: ClientPlayerWrapper (src/app/movie/[sourceId]/[id]/ClientPlayerWrapper.tsx)

### State Management (NEVER REMOVE)
- `currentEpIndex` state - tracks which episode is playing
- `handleEpisodeEnd` - auto-plays next episode when current ends
- `handlePrevEpisode` / `handleNextEpisode` - switch episodes
- `handleJumpToEpisode` - jump to specific episode with scrollIntoView

### Episode List UI (NEVER REMOVE)
- Grid layout: `grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8`
- Virtualized windowed rendering: `EPISODE_WINDOW = 40`
- Current episode highlight: `bg-indigo-600 border-indigo-500`
- "Now playing" indicator text
- Progress bar showing position in total episodes
- Hover/touch preload next episode m3u8
- Episode count display: "X episodes total"

### VideoPlayer Integration (NEVER CHANGE)
- Must pass `url={currentEp.url}` (NOT `episodes[0].url`)
- Must pass `title={currentEp.name}`
- Must pass `onEnded={handleEpisodeEnd}`
- Must pass `autoplay={true}`
- Must pass `onPrevEpisode`, `onNextEpisode`, `hasPrevEpisode`, `hasNextEpisode`
- Must pass `nextEpisodeUrl` for preload

## CRITICAL: Video Settings (src/hooks/player/useVideoSettings.ts)

### handleScaleChange (NEVER ADD setShowSettings here)
- MUST call `setVideoScale(scale)`
- MUST call `showToast(...)`
- MUST NOT call `setShowSettings(false)` - this causes scale to reset

### handleScaleChange dependency array
- MUST be `[setVideoScale, showToast]`

## CRITICAL: VideoPlayer Controls Visibility (src/components/VideoPlayer.tsx)

### Controls wrapper opacity logic (line ~201)
- MUST include `showSettings` in the condition:
  `isHovering || !isPlaying || showSettings ? "opacity-100" : "opacity-0 pointer-events-none"`
- Without `showSettings`, the settings panel becomes unreachable when mouse leaves the player

## CRITICAL: PlayerSettingsPanel (src/components/player/PlayerSettingsPanel.tsx)

### Root div MUST have stopPropagation
- `onClick={(e) => e.stopPropagation()}` on the root div
- Without this, clicking any settings button triggers play/pause on the video behind it

## CRITICAL: videoScale Persistence (src/hooks/useVideoPlayer.ts)

### State initialization MUST read from sessionStorage
```typescript
const [videoScale, setVideoScale] = useState(() => {
    if (typeof window !== "undefined") {
        const saved = sessionStorage.getItem("VOD_VIDEO_SCALE");
        if (saved) return parseFloat(saved);
    }
    return 1;
});
```

### useEffect MUST persist to sessionStorage
```typescript
useEffect(() => {
    if (typeof window !== "undefined") {
        sessionStorage.setItem("VOD_VIDEO_SCALE", videoScale.toString());
    }
}, [videoScale]);
```

Without these, Hydration errors from browser extensions will reset videoScale to 1.

## CRITICAL: Chinese Content (DO NOT REPLACE WITH ENGLISH)

### src/app/layout.tsx
- `description: "vod - 极速影院"` (NOT English)

### src/app/page.tsx
- Section titles: `今日趋势 (电影)`, `最新入库 (动作片)`, `今日趋势 (电视剧)`, `最新入库 (国产剧)`
- Metadata title: `"VOD 视频聚合播放平台"`

### src/config/config.ts
- All section headers and comments in Chinese
- Must not contain garbled text (锾斤拷 etc.)

## Verification Checklist

Before committing any player-related change, verify:
- [ ] Episode list still shows and is clickable
- [ ] Auto-play next episode works
- [ ] Video scale buttons work (1x, 1.5x, 2x, 3x, fit-height)
- [ ] Scale persists after page refresh
- [ ] Settings panel does not trigger play/pause when clicked
- [ ] No Hydration errors in console
- [ ] Chinese text is not garbled
