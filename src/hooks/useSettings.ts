import { useState, useEffect } from 'react';
import { getCookie, setCookie } from '@/lib/utils';

interface Settings {
    disabledSources: string[];
    movieSource: string;
    tvSource: string;
    customLocalUrl: string;
}

export function useSettings(isOpen: boolean) {
    const [disabledSources, setDisabledSources] = useState<string[]>([]);
    const [movieSource, setMovieSource] = useState('tmdb');
    const [tvSource, setTvSource] = useState('tmdb');
    const [customLocalUrl, setCustomLocalUrl] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            const savedDisabled = getCookie('VOD_DISABLED_SOURCES_V2');
            if (savedDisabled) {
                try {
                    const parsed = JSON.parse(savedDisabled);
                    if (Array.isArray(parsed)) setDisabledSources(parsed);
                } catch (e) {
                    console.error('Failed to parse disabled sources', e);
                }
            }

            const savedMovie = getCookie('VOD_MOVIE_SOURCE');
            const savedTv = getCookie('VOD_TV_SOURCE');
            const savedCustomUrl = getCookie('VOD_CUSTOM_LOCAL_URL');

            if (savedMovie) setMovieSource(savedMovie);
            if (savedTv) setTvSource(savedTv);
            if (savedCustomUrl) setCustomLocalUrl(savedCustomUrl);
        }
    }, [isOpen]);

    const toggleSource = (id: string) => {
        const next = disabledSources.includes(id)
            ? disabledSources.filter(s => s !== id)
            : [...disabledSources, id];

        setDisabledSources(next);
    };

    const saveSettings = () => {
        try {
            setCookie('VOD_DISABLED_SOURCES_V2', JSON.stringify(disabledSources));
            setCookie('VOD_MOVIE_SOURCE', movieSource);
            setCookie('VOD_TV_SOURCE', tvSource);
            setCookie('VOD_CUSTOM_LOCAL_URL', customLocalUrl);
            return true;
        } catch (e) {
            console.error('Failed to save settings:', e);
            return false;
        }
    };

    return {
        mounted,
        settings: {
            disabledSources,
            movieSource,
            tvSource,
            customLocalUrl
        },
        setters: {
            setDisabledSources,
            setMovieSource,
            setTvSource,
            setCustomLocalUrl,
            toggleSource
        },
        saveSettings
    };
}
