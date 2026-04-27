import type { RefObject } from 'react';
import type Hls from 'hls.js';

// ===========================
// Shared refs used across hooks
// ===========================
export interface PlayerRefs {
    videoRef: RefObject<HTMLVideoElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    progressBarRef: RefObject<HTMLDivElement | null>;
}

// ===========================
// Domain types
// ===========================
export interface VideoLevel {
    height: number;
    index: number;
}

export interface GestureHUDData {
    icon: 'volume' | 'brightness' | 'seek';
    value: string;
    visible: boolean;
}

export interface ToastData {
    message: string;
    visible: boolean;
}

// ===========================
// State subsets for memoized prop passing
// ===========================
export interface VideoPlaybackState {
    isPlaying: boolean;
    isLoading: boolean;
    isBuffering: boolean;
    progress: number;
    duration: number;
    buffered: number;
    isMuted: boolean;
    volume: number;
}

export interface VideoUIState {
    isHovering: boolean;
    showSettings: boolean;
    isDragging: boolean;
    dragProgress: number;
    isLocked: boolean;
    isWebFullscreen: boolean;
    isEmbed: boolean;
}

export interface VideoVisualState {
    brightness: number;
    videoScale: number;
    playbackRate: number;
    gestureHUD: GestureHUDData;
    toast: ToastData;
}

export interface VideoSettingsState {
    levels: VideoLevel[];
    currentLevel: number;
    activeLevelIdx: number;
    maxBufferLength: number;
}

// ===========================
// Sub-hook input/output types
// ===========================
export interface UseHlsSourceInput {
    url: string;
    videoRef: RefObject<HTMLVideoElement | null>;
    isEmbed: boolean;
    maxBufferLength: number;
}

export interface UseHlsSourceOutput {
    hlsRef: { current: InstanceType<typeof Hls> | null };
    isLoading: boolean;
    levels: VideoLevel[];
    currentLevel: number;
    activeLevelIdx: number;
    isEmbed: boolean;
    maxBufferLength: number;
    skipIntroTimeRef: { current: number };
}

export interface UseVideoEventsInput {
    videoRef: RefObject<HTMLVideoElement | null>;
    onEnded?: () => void;
    autoplay: boolean;
    nextEpisodeUrl?: string;
    playbackRate: number;
    volume: number;
    isMuted: boolean;
    isLoading: boolean;
}

export interface UseVideoEventsOutput {
    isPlaying: boolean;
    isBuffering: boolean;
    progress: number;
    duration: number;
    buffered: number;
    setIsPlaying: (v: boolean) => void;
}

export interface UseVideoSeekInput {
    videoRef: RefObject<HTMLVideoElement | null>;
    progressBarRef: RefObject<HTMLDivElement | null>;
    hlsRef: { current: InstanceType<typeof Hls> | null };
    isHovering: boolean;
}

export interface UseVideoSeekOutput {
    isDragging: boolean;
    dragProgress: number;
    progressBarRef: RefObject<HTMLDivElement | null>;
    lastSeekEndTimeRef: { current: number };
    handleSeekStart: (e: React.TouchEvent | React.MouseEvent) => void;
    handleSeekMove: (e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => void;
    handleSeekEnd: () => void;
    handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export interface UseVideoGesturesInput {
    videoRef: RefObject<HTMLVideoElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    volume: number;
    playbackRate: number;
    isEmbed: boolean;
    isSpeedHolding: boolean;
}

export interface UseVideoGesturesOutput {
    brightness: number;
    setBrightness: (v: number) => void;
    gestureHUD: GestureHUDData;
    isSpeedHolding: boolean;
    handleMouseMove: (e: React.MouseEvent) => void;
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    handleTouchEnd: (e: React.TouchEvent) => void;
    handleSpeedHoldStart: () => void;
    handleSpeedHoldEnd: () => void;
}

export interface UseVideoKeyboardInput {
    togglePlay: () => void;
    handleSeekRelative: (seconds: number) => void;
    handleVolumeChange: (newVolume: number) => void;
    toggleFullscreen: () => void;
    toggleMute: () => void;
    volume: number;
}

export interface UseVideoSettingsInput {
    hlsRef: { current: InstanceType<typeof Hls> | null };
    isEmbed: boolean;
}

export interface UseVideoSettingsOutput {
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
    playbackRate: number;
    setPlaybackRate: (v: number) => void;
    videoScale: number;
    setVideoScale: (v: number) => void;
    isLocked: boolean;
    toast: ToastData;
    skipIntroTimeRef: { current: number };
    handleResolutionChange: (idx: number) => void;
    handleRateChange: (rate: number) => void;
    handleScaleChange: (scale: number) => void;
    handleBufferChange: (buf: number) => void;
    handleLock: () => void;
    handleUnlock: () => void;
    handleSkipIntroChange: (seconds: number) => void;
    showToast: (message: string) => void;
}

export interface UseVideoControlsInput {
    containerRef: RefObject<HTMLDivElement | null>;
    videoRef: RefObject<HTMLVideoElement | null>;
    isPlaying: boolean;
    isHovering: boolean;
    isDragging: boolean;
    showSettings: boolean;
    togglePlay: () => void;
    handleSeekRelative: (seconds: number) => void;
    showGestureHUD: (icon: 'volume' | 'brightness' | 'seek', value: string) => void;
    setShowSettings: (v: boolean) => void;
    lastSeekEndTimeRef: { current: number };
}

export interface UseVideoControlsOutput {
    isHovering: boolean;
    setIsHovering: (v: boolean) => void;
    isWebFullscreen: boolean;
    handleVideoClick: (e: React.MouseEvent | React.TouchEvent) => void;
    toggleFullscreen: () => void;
    toggleWebFullscreen: () => void;
}

// ===========================
// Narrow prop types for child components
// ===========================
export interface ControlsApi {
    isPlaying: boolean;
    togglePlay: () => void;
    toggleMute: () => void;
    isMuted: boolean;
    volume: number;
    handleVolumeChange: (newVolume: number) => void;
    duration: number;
    videoRef: RefObject<HTMLVideoElement | null>;
    isLocked: boolean;
    handleLock: () => void;
    handleUnlock: () => void;
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
}

export interface ProgressApi {
    progress: number;
    duration: number;
    buffered: number;
    isDragging: boolean;
    dragProgress: number;
    progressBarRef: RefObject<HTMLDivElement | null>;
    handleSeekStart: (e: React.TouchEvent | React.MouseEvent) => void;
    handleSeekMove: (e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => void;
    handleSeekEnd: () => void;
    handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export interface SettingsPanelApi {
    currentLevel: number;
    levels: VideoLevel[];
    activeLevelIdx: number;
    playbackRate: number;
    handleRateChange: (rate: number) => void;
    videoScale: number;
    handleScaleChange: (scale: number) => void;
    maxBufferLength: number;
    handleBufferChange: (buf: number) => void;
    handleResolutionChange: (idx: number) => void;
    skipIntroTimeRef: { current: number };
    handleSkipIntroChange: (seconds: number) => void;
}

export interface ControlButtonsApi {
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
    toggleFullscreen: () => void;
    toggleWebFullscreen: () => void;
    isWebFullscreen: boolean;
}

// ===========================
// Full player API (returned by useVideoPlayer orchestrator)
// ===========================
export interface PlayerAPI {
    // Refs
    videoRef: RefObject<HTMLVideoElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    progressBarRef: RefObject<HTMLDivElement | null>;
    hlsRef: { current: InstanceType<typeof Hls> | null };

    // State
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    progress: number;
    duration: number;
    buffered: number;
    isHovering: boolean;
    isLoading: boolean;
    isBuffering: boolean;
    showSettings: boolean;
    playbackRate: number;
    videoScale: number;
    isLocked: boolean;
    isWebFullscreen: boolean;
    isDragging: boolean;
    dragProgress: number;
    brightness: number;
    gestureHUD: GestureHUDData;
    toast: ToastData;
    levels: VideoLevel[];
    skipIntroTime: { current: number };
    handleSkipIntroChange: (seconds: number) => void;
    currentLevel: number;
    activeLevelIdx: number;
    maxBufferLength: number;
    isEmbed: boolean;

    // Setters
    setIsHovering: (v: boolean) => void;
    setShowSettings: (v: boolean) => void;

    // Handlers
    togglePlay: () => void;
    toggleMute: () => void;
    handleVolumeChange: (newVolume: number) => void;
    handleSeekStart: (e: React.TouchEvent | React.MouseEvent) => void;
    handleSeekMove: (e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => void;
    handleSeekEnd: () => void;
    handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    toggleFullscreen: () => void;
    toggleWebFullscreen: () => void;
    handleResolutionChange: (idx: number) => void;
    handleRateChange: (rate: number) => void;
    handleSpeedHoldStart: () => void;
    handleSpeedHoldEnd: () => void;
    isSpeedHolding: boolean;
    handleScaleChange: (scale: number) => void;
    handleBufferChange: (buf: number) => void;
    handleLock: () => void;
    handleUnlock: () => void;
    handleMouseMove: (e: React.MouseEvent) => void;
    handleVideoClick: (e: React.MouseEvent | React.TouchEvent) => void;
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    handleTouchEnd: (e: React.TouchEvent) => void;
    formatTime: (seconds: number) => string;
}
