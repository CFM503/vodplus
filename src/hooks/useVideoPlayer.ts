import { useState, useRef, useEffect, useCallback } from 'react';
import { CONFIG } from '@/config/config';

interface VideoPlayerProps {
    url: string;
    onEnded?: () => void;
    autoplay?: boolean;
    nextEpisodeUrl?: string; // Opt-in: URL of the next episode for preloading
}

export function useVideoPlayer({ url, onEnded, autoplay = false, nextEpisodeUrl }: VideoPlayerProps) {
    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const progressRectRef = useRef<DOMRect | null>(null);
    const hlsRef = useRef<any>(null);
    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTapRef = useRef(0);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSeekEndTimeRef = useRef(0); // For click suppression
    const hasSkippedIntroRef = useRef(false);
    const hasPrefetchedNextRef = useRef(false);

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [videoScale, setVideoScale] = useState(1);
    const [isLocked, setIsLocked] = useState(false);
    const [isWebFullscreen, setIsWebFullscreen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragProgress, setDragProgress] = useState(0);
    const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
    const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState<number>(-1);
    const [activeLevelIdx, setActiveLevelIdx] = useState<number>(-1);
    const [buffered, setBuffered] = useState(0);
    const [maxBufferLength, setMaxBufferLength] = useState(CONFIG.DEFAULT_BUFFER_LENGTH);
    const [brightness, setBrightness] = useState(100);
    const [isSpeedHolding, setIsSpeedHolding] = useState(false);
    const [gestureHUD, setGestureHUD] = useState<{ icon: 'volume' | 'brightness' | 'seek', value: string, visible: boolean }>({
        icon: 'seek',
        value: '',
        visible: false
    });
    const [skipIntroTime, setSkipIntroTime] = useState(0);

    const touchStartRef = useRef<{ x: number, y: number, time: number, vol: number, brightness: number, currentTime: number } | null>(null);
    const gestureTypeRef = useRef<'none' | 'vertical-left' | 'vertical-right' | 'horizontal'>('none');
    const dragProgressRef = useRef(0); // Ref for latest drag position to avoid closure issues
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

    const isEmbed = url ? (!url.includes('.m3u8') && !url.includes('.mp4') && !url.includes('.webm') && url.startsWith('http')) : false;

    // Methods
    const showToast = useCallback((message: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, visible: true });
        toastTimerRef.current = setTimeout(() => {
            setToast({ message: '', visible: false });
        }, CONFIG.TOAST_DISPLAY_TIME);
    }, []);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('Play interrupted', error);
                    }
                });
            }
            setIsPlaying(true);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, []);

    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(!isMuted);
    }, [isMuted]);

    const handleVolumeChange = useCallback((newVolume: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.volume = newVolume;
        setVolume(newVolume);

        if (newVolume > 0 && video.muted) {
            video.muted = false;
        }

        setIsMuted(newVolume === 0);
    }, []);

    const showGestureHUD = useCallback((icon: 'volume' | 'brightness' | 'seek', value: string) => {
        setGestureHUD({ icon, value, visible: true });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }, []);

    const hideGestureHUD = useCallback(() => {
        setGestureHUD(prev => ({ ...prev, visible: false }));
    }, []);

    const handleSeekRelative = useCallback((seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
        setIsHovering(true);
    }, []);

    const handleSkipIntroChange = (seconds: number) => {
        const next = Math.max(0, seconds);
        setSkipIntroTime(next);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('VOD_SESSION_SKIP_INTRO', next.toString());
        }
    };

    // Initialization Effect (HLS)
    useEffect(() => {
        // Reset playback state for new URL
        setIsLoading(true);
        setIsBuffering(false);
        setProgress(0);
        setLevels([]);
        setCurrentLevel(-1);
        setActiveLevelIdx(-1);
        hasSkippedIntroRef.current = false;

        // Load skip intro time from session storage
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('VOD_SESSION_SKIP_INTRO');
            if (saved) setSkipIntroTime(parseInt(saved, 10));
        }

        const video = videoRef.current;
        if (!video || isEmbed) return;

        const initPlayer = async () => {
            if (!url) return;
            if (url.includes('.mp4') || url.includes('.webm')) {
                video.src = url;
                video.src = url;
                setIsLoading(false);
                // Autoplay handled by useEffect
                return;
            }

            try {
                const { default: Hls } = await import('hls.js');

                if (Hls.isSupported()) {
                    if (hlsRef.current) hlsRef.current.destroy();

                    const hls = new Hls({
                        capLevelToPlayerSize: true,
                        autoStartLoad: true,
                        startLevel: -1,   // -1 = 自动根据带宽选择起播画质 (推荐)
                        enableWorker: true,
                        maxBufferLength: maxBufferLength,
                        maxMaxBufferLength: maxBufferLength * 2,
                        backBufferLength: 90,
                        lowLatencyMode: false,
                        manifestLoadingTimeOut: CONFIG.HLS_TIMEOUT,
                        manifestLoadingMaxRetry: 4,
                        levelLoadingTimeOut: CONFIG.HLS_TIMEOUT,
                        levelLoadingMaxRetry: 4,
                        fragLoadingTimeOut: 20000,
                        fragLoadingMaxRetry: 6,
                        xhrSetup: function (xhr, url) {
                            xhr.withCredentials = false;
                        },
                    });
                    hlsRef.current = hls;

                    hls.loadSource(url.trim());
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        const availableLevels = hls.levels.map((l: any, idx: number) => ({
                            height: l.height,
                            index: idx
                        })).sort((a: any, b: any) => b.height - a.height);
                        setLevels(availableLevels);
                        setIsLoading(false);
                    });

                    hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
                        setActiveLevelIdx(data.level);
                    });

                    hls.attachMedia(video);

                    hls.on(Hls.Events.ERROR, (event: any, data: any) => {
                        if (!data.fatal) return;
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                hls.destroy();
                                break;
                        }
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                    video.addEventListener('loadedmetadata', () => {
                        setIsLoading(false);
                        // Autoplay handled by useEffect
                    }, { once: true });
                }
            } catch (error) {
                console.error('Failed to load Hls.js', error);
                if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                    video.addEventListener('loadedmetadata', () => {
                        setIsLoading(false);
                        // Autoplay handled by useEffect
                    }, { once: true });
                }
            }
        };

        // Keep HUD visible while switching/loading
        setIsHovering(true);
        initPlayer();

        return () => {
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [url, isEmbed]);

    // Reset prefetch flag and skip flag when url changes
    useEffect(() => {
        hasPrefetchedNextRef.current = false;
        hasSkippedIntroRef.current = false;
    }, [url]);

    // Update HLS buffer config dynamically without restarting player
    useEffect(() => {
        if (hlsRef.current && !isEmbed) {
            const currentTime = videoRef.current?.currentTime || 0;
            hlsRef.current.config.maxBufferLength = maxBufferLength;
            hlsRef.current.config.maxMaxBufferLength = maxBufferLength * 2;
        }
    }, [maxBufferLength]);

    // Visibility handling
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && hlsRef.current) {
                hlsRef.current.startLoad();
                if (isBuffering && videoRef.current && !videoRef.current.paused) {
                    hlsRef.current.recoverMediaError();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isBuffering, isEmbed]);

    // Autoplay with Muted Fallback
    useEffect(() => {
        if (autoplay && videoRef.current && !isLoading) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    if (error.name === 'AbortError') return; // Ignore intentional aborts

                    // Squelch the error, it's expected on some browsers without interaction
                    console.warn('[Autoplay] Unmuted autoplay failed, switching to muted.', error.message);

                    if (videoRef.current) {
                        videoRef.current.muted = true;
                        setIsMuted(true);
                        const mutedPromise = videoRef.current.play();
                        if (mutedPromise !== undefined) {
                            mutedPromise.catch(e => {
                                if (e.name !== 'AbortError') console.warn('[Autoplay] Muted autoplay also failed.', e);
                            });
                        }
                    }
                });
            }
        }
    }, [autoplay, isLoading]);

    // Skip Intro Logic
    useEffect(() => {
        const video = videoRef.current;
        if (!video || isLoading || hasSkippedIntroRef.current || skipIntroTime <= 0) return;

        const doSkip = () => {
            if (hasSkippedIntroRef.current) return;
            hasSkippedIntroRef.current = true;
            video.currentTime = skipIntroTime;
            showToast(`已为您跳过片头 ${skipIntroTime}s`);
        };

        if (video.readyState >= 1) {
            doSkip();
        } else {
            const onLoadedMetadata = () => {
                doSkip();
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
            };
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            return () => video.removeEventListener('loadedmetadata', onLoadedMetadata);
        }
    }, [isLoading, skipIntroTime, showToast]);

    // Progress Bar Rect Cache
    useEffect(() => {
        const updateRect = () => {
            if (progressBarRef.current) {
                progressRectRef.current = progressBarRef.current.getBoundingClientRect();
            }
        };
        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('fullscreenchange', updateRect);
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('fullscreenchange', updateRect);
        };
    }, []);

    // Video Event Listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateBuffered = () => {
            if (video.duration) {
                let currentBufferedEnd = 0;
                for (let i = 0; i < video.buffered.length; i++) {
                    if (video.buffered.start(i) <= video.currentTime + 0.5 && video.buffered.end(i) >= video.currentTime) {
                        currentBufferedEnd = video.buffered.end(i);
                        break;
                    }
                }
                setBuffered((currentBufferedEnd / video.duration) * 100);
            }
        };

        const updateProgress = () => {
            if (video.duration) {
                const currentProgressPercent = (video.currentTime / video.duration) * 100;
                setProgress(currentProgressPercent);
                updateBuffered();

                // Intro skip logic
                if (skipIntroTime > 0 && !hasSkippedIntroRef.current && video.currentTime > 0) {
                    if (video.currentTime < skipIntroTime) {
                        video.currentTime = skipIntroTime;
                        hasSkippedIntroRef.current = true;
                        showToast(`自动跳过片头 ${skipIntroTime}s`);
                    }
                }

                // Next Episode implicit preload logic (at 80% progress)
                if (nextEpisodeUrl && !hasPrefetchedNextRef.current && currentProgressPercent > 80) {
                    hasPrefetchedNextRef.current = true;
                    // Pre fetch the next episode manifest silently in background
                    fetch(nextEpisodeUrl, { mode: 'cors' }).catch(() => { /* ignore */ });
                }
            }
        };

        const updateDuration = () => setDuration(video.duration);
        const handleWaiting = () => setIsBuffering(true);
        const handlePlaying = () => {
            setIsBuffering(false);
            setIsPlaying(true);
        };
        const handlePause = () => setIsPlaying(false);
        const handleSeeking = () => setIsBuffering(true);
        const handleSeeked = () => {
            setIsBuffering(false);
            if (video && !video.paused) setIsPlaying(true);
        };
        const handleEnded = () => {
            setIsPlaying(false);
            if (onEnded) onEnded();
        };

        video.addEventListener('timeupdate', updateProgress);
        video.addEventListener('progress', updateBuffered);
        video.addEventListener('loadedmetadata', updateDuration);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('pause', handlePause);
        video.addEventListener('play', handlePlaying);
        video.addEventListener('seeking', handleSeeking);
        video.addEventListener('seeked', handleSeeked);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', updateProgress);
            video.removeEventListener('progress', updateBuffered);
            video.removeEventListener('loadedmetadata', updateDuration);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('play', handlePlaying);
            video.removeEventListener('seeking', handleSeeking);
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('ended', handleEnded);
        };
    }, [onEnded]);

    // Playback rate, Volume, and Mute sync and restore after loading
    useEffect(() => {
        if (videoRef.current && !isLoading) {
            videoRef.current.playbackRate = playbackRate;
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
        }
    }, [playbackRate, volume, isMuted, isLoading]);

    // Seek Logic
    const calculatePosition = useCallback((clientX: number, rect: DOMRect) => {
        let pos = (clientX - rect.left) / rect.width;
        pos = Math.max(0, Math.min(1, pos));
        return pos;
    }, []);

    const handleSeekStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        // [MODIFIED] Removed isLocked check to allow seeking even when orientation is locked
        // if (isLocked) return; 

        // On mobile, only allow seeking if the controls are already visible
        // This prevents accidental seeks when the user just wants to show the HUD
        const isTouch = 'touches' in e;
        if (isTouch && !isHovering) return;

        // Use fresh rect to prevent stale coordinate space
        if (!progressBarRef.current || !videoRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        progressRectRef.current = rect;

        if (rect.width === 0) return;

        const clientX = 'touches' in e
            ? (e as React.TouchEvent).touches[0].clientX
            : (e as React.MouseEvent).clientX;

        const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

        // Critical: Set dragging state last to ensure dragProgress is updated in the same frame
        setDragProgress(percent);
        dragProgressRef.current = percent;
        setIsDragging(true);

        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
    }, [isLocked, isHovering]);

    const handleSeekMove = useCallback((e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => {
        if (!isDragging || !progressRectRef.current) return;
        const rect = progressRectRef.current;
        const clientX = 'touches' in e
            ? (e as TouchEvent).touches[0].clientX
            : ('clientX' in e ? (e as MouseEvent).clientX : 0);

        if (clientX === 0) return;
        const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        setDragProgress(percent);
        dragProgressRef.current = percent;
    }, [isDragging]);

    const handleSeekEnd = useCallback(() => {
        if (isDragging) {
            const video = videoRef.current;
            if (video && video.duration) {
                const targetTime = (dragProgressRef.current / 100) * video.duration;
                if (Number.isFinite(targetTime)) {
                    video.currentTime = targetTime;
                    setProgress(dragProgressRef.current);
                }

                if (hlsRef.current && video.paused && !video.ended) {
                    seekTimeoutRef.current = setTimeout(() => {
                        if (hlsRef.current && video.paused) hlsRef.current.startLoad();
                    }, 100);
                }
            }
            setIsDragging(false);
            setDragProgress(0); // Reset for next time
            dragProgressRef.current = 0;
            progressRectRef.current = null;
            lastSeekEndTimeRef.current = Date.now(); // Mark end time
        }
    }, [isDragging]);

    // Global listeners for desktop dragging
    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e: MouseEvent) => handleSeekMove(e);
        const onMouseUp = () => handleSeekEnd();

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, handleSeekMove, handleSeekEnd]);

    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {

        // On mobile, if controls are not visible, a tap should just show them, not seek.
        const isTouch = 'touches' in e; // This is a MouseEvent, so 'touches' will be undefined.
        // However, this function might be called by a touch event handler
        // that simulates a click. For safety, we'll check if it's a touch-like interaction.
        // A more robust check for touch events would be needed if this function is directly used for touch.
        // For now, assuming this is primarily for desktop mouse clicks.
        // If it's a mobile tap, handleVideoClick should take precedence.
        if (isTouch && !isHovering) {
            e.stopPropagation();
            setIsHovering(true);
            return;
        }

        e.stopPropagation();

        // If we just finished dragging, ignore the click event that follows mouseUp
        if (progressRectRef.current === null) {
            // This is a clue that we just ended a drag (handled in handleSeekEnd)
            // But we can check a ref instead for better reliability
        }

        const video = videoRef.current;
        if (!video || isDragging) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const pos = calculatePosition(e.clientX, rect);
        if (video.duration) {
            const targetTime = pos * video.duration;
            if (Number.isFinite(targetTime)) {
                video.currentTime = targetTime;
                setProgress(pos * 100);
            }
        }
    }, [isDragging, calculatePosition, isHovering]);



    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) container.requestFullscreen();
        else document.exitFullscreen();
    }, []);

    const toggleWebFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!isWebFullscreen) {
            container.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:999999;background:#000;border-radius:0;';
            setIsWebFullscreen(true);
        } else {
            container.style.cssText = '';
            setIsWebFullscreen(false);
        }
    }, [isWebFullscreen]);

    // Helpers
    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleResolutionChange = (idx: number) => {
        if (!hlsRef.current) return;
        hlsRef.current.currentLevel = idx;
        setCurrentLevel(idx);
        const label = idx === -1 ? '自动' : `${hlsRef.current.levels[idx]?.height}p`;
        showToast(`清晰度已切换至：${label}`);
        setShowSettings(false);
    };

    const handleRateChange = (rate: number) => {
        setPlaybackRate(rate);
        showToast(`播放速度已切换至 ${rate}x`);
        setShowSettings(false);
    };

    const handleSpeedHoldStart = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = CONFIG.LONG_PRESS_SPEED;
        setIsSpeedHolding(true);
        // We use the GestureHUD to show the speed status, but manually
        setGestureHUD({
            icon: 'seek',
            value: `${CONFIG.LONG_PRESS_SPEED}x`,
            visible: true
        });
    }, []);

    const handleSpeedHoldEnd = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = playbackRate; // Restore state rate
        setIsSpeedHolding(false);
        setGestureHUD(prev => ({ ...prev, visible: false }));
    }, [playbackRate]);

    const handleScaleChange = (scale: number) => {
        setVideoScale(scale);
        showToast(`画面比例已缩放至 ${scale}x`);
        setShowSettings(false);
    };

    const handleBufferChange = (buf: number) => {
        setMaxBufferLength(buf);
        const label = buf === 10 ? '极速' : buf === 30 ? '平衡' : buf === 60 ? '流畅' : buf === 120 ? '抗断网' : '超级流畅';
        showToast(`缓存策略已更新：${label}模式 (${buf}s)`);
        setShowSettings(false);
    };

    const handleUnlock = useCallback(() => {
        setIsLocked(false);
        if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
        showToast("已恢复自动旋转");
    }, []);

    const handleLock = useCallback(() => {
        setIsLocked(true);
        // "原地定格" 锁定当前方向 (Smart Orientation Lock)
        const orientation = screen.orientation as any;
        if (typeof screen !== 'undefined' && orientation && orientation.lock) {
            const currentType = orientation.type;
            orientation.lock(currentType).catch((err: any) => {
                console.error("方向锁定失败:", err);
            });
        }
        showToast("已开启旋转锁定");
    }, []);

    // Mouse Move Ghost Check (Mobile Fix)
    const handleMouseMove = (e: React.MouseEvent) => {
        const currentX = e.clientX;
        const currentY = e.clientY;
        const deltaX = Math.abs(currentX - lastMousePosRef.current.x);
        const deltaY = Math.abs(currentY - lastMousePosRef.current.y);
        if (deltaX > 0 || deltaY > 0) {
            setIsHovering(true);
            lastMousePosRef.current = { x: currentX, y: currentY };
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isEmbed) return;
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
            vol: volume,
            brightness: brightness,
            currentTime: videoRef.current?.currentTime || 0
        };
        gestureTypeRef.current = 'none';

        // Long Press Speed Logic (Right 25% Zone)
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const isRightZone = touch.clientX > rect.left + rect.width * 0.75;

            if (isRightZone) {
                longPressTimerRef.current = setTimeout(() => {
                    handleSpeedHoldStart();
                }, 500); // 500ms hold to activate
            }
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isEmbed || !touchStartRef.current || !containerRef.current) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const containerRect = containerRef.current.getBoundingClientRect();

        // Vertical Swipe (Volume/Brightness) - Threshold 30px
        if (gestureTypeRef.current === 'none' && Math.abs(deltaY) > CONFIG.GESTURE_VERTICAL_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX) * CONFIG.GESTURE_ASPECT_RATIO_THRESHOLD) {
            // Cancel long press if swipe detected
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            // If already holding speed, don't start volume gesture? 
            // Better behavior: If speed holding active, block other gestures.
            if (isSpeedHolding) return;

            const isLeft = touchStartRef.current.x < containerRect.left + containerRect.width * 0.5;
            gestureTypeRef.current = isLeft ? 'vertical-left' : 'vertical-right';
        }

        // Execute gesture
        if (gestureTypeRef.current === 'vertical-left') {
            const brightnessDelta = -(deltaY / containerRect.height) * 100;
            const newBrightness = Math.max(0, Math.min(200, touchStartRef.current.brightness + brightnessDelta));
            setBrightness(newBrightness);
            showGestureHUD('brightness', `${Math.round(newBrightness)}%`);
        } else if (gestureTypeRef.current === 'vertical-right') {
            const volumeDelta = -(deltaY / containerRect.height);
            const newVolume = Math.max(0, Math.min(1, touchStartRef.current.vol + volumeDelta));
            handleVolumeChange(newVolume);
            showGestureHUD('volume', `${Math.round(newVolume * 100)}%`);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        // Clear long press timer
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        // If holding speed, deactivate and stop everything else
        if (isSpeedHolding) {
            handleSpeedHoldEnd();
            touchStartRef.current = null;
            gestureTypeRef.current = 'none'; // Reset logic
            return;
        }

        if (!touchStartRef.current) return;

        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
        const touchDuration = Date.now() - touchStartRef.current.time;

        // Handle Tap (if short duration and no significant drag)
        if (gestureTypeRef.current === 'none' && touchDuration < CONFIG.TAP_MAX_DURATION && Math.abs(deltaX) < CONFIG.TAP_MAX_MOVEMENT) {
            // Prevent browser from calling mouse events
            if (e.cancelable) e.preventDefault();
            handleVideoClick(e);
        }

        // Cleanup
        hideGestureHUD();
        touchStartRef.current = null;
        gestureTypeRef.current = 'none';
        setIsHovering(true); // Keep controls visible after swipe
    };

    // Handle Video Click (Mainly for mouse, or called by handleTouchEnd for tap)
    const handleVideoClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const now = Date.now();
        const isTouch = 'touches' in e || 'changedTouches' in e;

        // Ignore clicks immediately following a seek
        if (now - lastSeekEndTimeRef.current < CONFIG.SEEK_CLICK_SUPPRESSION_DELAY) return;

        const timeSinceLastTap = now - lastTapRef.current;
        const isDoubleTap = timeSinceLastTap < CONFIG.DOUBLE_TAP_DELAY;

        if (isTouch) {
            // Mobile Specific Logic
            if (isDoubleTap) {
                // Double tap detected
                const container = containerRef.current;
                if (!container) return;

                const rect = container.getBoundingClientRect();
                const x = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as any).clientX;
                const relativeX = x - rect.left;

                if (relativeX < rect.width * CONFIG.DOUBLE_TAP_SKIP_ZONE_PERCENT) {
                    // Left zone -> Rewind
                    handleSeekRelative(-CONFIG.SKIP_SECONDS);
                    showGestureHUD('seek', `-${CONFIG.SKIP_SECONDS}s`);
                } else if (relativeX > rect.width * (1 - CONFIG.DOUBLE_TAP_SKIP_ZONE_PERCENT)) {
                    // Right zone -> Forward
                    handleSeekRelative(CONFIG.SKIP_SECONDS);
                    showGestureHUD('seek', `+${CONFIG.SKIP_SECONDS}s`);
                } else {
                    // Middle zone -> Toggle Play/Pause
                    togglePlay();
                }
            } else {
                // Single Tap on Mobile: JUST toggle HUD visibility (Standard YouTube behavior)
                // This prevents the accidental play/pause or fullscreen when just wanting to see the UI
                setIsHovering(prev => !prev);
            }
        } else {
            // Desktop Specific Logic (Standard)
            if (isDoubleTap) {
                toggleFullscreen();
            } else {
                togglePlay();
            }
        }

        lastTapRef.current = now;
    }, [isLocked, togglePlay, toggleFullscreen, setIsHovering, showToast]);

    // Auto-hide controls
    useEffect(() => {
        let timeout: NodeJS.Timeout;

        // Check if device is touch-primary (mobile/tablet) where hover isn't available
        // on these devices, we ALWAYS want auto-hide because there's no "mouse leave" to hide controls
        const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

        // Auto-hide if:
        // 1. Config is TRUE (User wants auto-hide everywhere)
        // 2. OR it's a touch device (Mobile experience requires auto-hide)
        const shouldAutoHide = CONFIG.AUTO_HIDE_CONTROLS || isTouchDevice;

        if (shouldAutoHide && isPlaying && isHovering && !isDragging && !showSettings) {
            timeout = setTimeout(() => setIsHovering(false), CONFIG.CONTROLS_AUTO_HIDE_TIME);
        }
        return () => clearTimeout(timeout);
    }, [isPlaying, isHovering, isDragging, showSettings]);

    // Auto-close settings when controls hide
    useEffect(() => {
        if (!isHovering) setShowSettings(false);
    }, [isHovering]);




    return {
        // Refs
        videoRef,
        containerRef,
        progressBarRef,
        hlsRef,

        // State
        isPlaying,
        isMuted,
        volume,
        progress,
        duration,
        buffered,
        isHovering,
        isLoading,
        isBuffering,
        showSettings,
        playbackRate,
        videoScale,
        isLocked,
        isWebFullscreen,
        isDragging,
        dragProgress,
        brightness,
        gestureHUD,
        toast,
        levels,
        skipIntroTime,
        handleSkipIntroChange,
        currentLevel,
        activeLevelIdx,
        maxBufferLength,
        isEmbed,

        // Setters
        setIsHovering,
        setShowSettings,

        // Handlers
        togglePlay,
        toggleMute,
        handleVolumeChange,
        handleSeekStart,
        handleSeekMove,
        handleSeekEnd,
        handleProgressClick,
        toggleFullscreen,
        toggleWebFullscreen,
        handleResolutionChange,
        handleRateChange,
        handleSpeedHoldStart,
        handleSpeedHoldEnd,
        isSpeedHolding,
        handleScaleChange,
        handleBufferChange,
        handleLock,
        handleUnlock,
        handleMouseMove,
        handleVideoClick,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        formatTime,
    };
}
