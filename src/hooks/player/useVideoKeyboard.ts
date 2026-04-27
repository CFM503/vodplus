import { useEffect, useRef } from 'react';

interface UseVideoKeyboardProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    togglePlay: () => void;
    handleSeekRelative: (seconds: number) => void;
    handleVolumeChange: (newVolume: number) => void;
    toggleFullscreen: () => void;
    toggleMute: () => void;
    volume: number;
}

export function useVideoKeyboard({
    videoRef, togglePlay, handleSeekRelative, handleVolumeChange, toggleFullscreen, toggleMute, volume,
}: UseVideoKeyboardProps) {
    // Store callbacks in ref to avoid re-registering the keyboard listener
    const callbacksRef = useRef({
        togglePlay, handleSeekRelative, handleVolumeChange, toggleFullscreen, toggleMute, volume,
    });

    useEffect(() => {
        callbacksRef.current = { togglePlay, handleSeekRelative, handleVolumeChange, toggleFullscreen, toggleMute, volume };
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const video = videoRef.current;
            if (!video) return;

            const cb = callbacksRef.current;
            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    cb.togglePlay();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    cb.handleSeekRelative(-5);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    cb.handleSeekRelative(5);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    cb.handleVolumeChange(Math.min(1, cb.volume + 0.1));
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    cb.handleVolumeChange(Math.max(0, cb.volume - 0.1));
                    break;
                case 'f':
                    e.preventDefault();
                    cb.toggleFullscreen();
                    break;
                case 'p':
                    e.preventDefault();
                    if (document.pictureInPictureElement) {
                        document.exitPictureInPicture();
                    } else if (document.pictureInPictureEnabled && video) {
                        video.requestPictureInPicture().catch(() => {});
                    }
                    break;
                case 'm':
                    e.preventDefault();
                    cb.toggleMute();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
}
