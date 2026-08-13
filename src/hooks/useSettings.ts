import { useState, useEffect } from 'react';
import { getCookie, setCookie } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { ResourceSite } from '@/lib/resources';
import { readCustomSourcesFromDocument, saveCustomSourcesToCookies } from '@/lib/sourceConfig';

interface Settings {
    disabledSources: string[];
    movieSource: string;
    tvSource: string;
    customLocalUrl: string;
    // v0.9.31: 自定义资源站列表
    customSources: ResourceSite[];
}

export function useSettings(isOpen: boolean) {
    const [disabledSources, setDisabledSources] = useState<string[]>([]);
    const [movieSource, setMovieSource] = useState('tmdb');
    const [tvSource, setTvSource] = useState('tmdb');
    const [customLocalUrl, setCustomLocalUrl] = useState('');
    const [customSources, setCustomSources] = useState<ResourceSite[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            const savedDisabled = getCookie('VOD_DISABLED_SOURCES_V2');
            if (savedDisabled) {
                try {
                    const parsed = JSON.parse(savedDisabled);
                    if (Array.isArray(parsed)) setDisabledSources(parsed);
                } catch (e: unknown) {
                    logger.error('Settings', 'Failed to parse disabled sources', e);
                }
            }

            const parsedCustom = readCustomSourcesFromDocument();
            if (parsedCustom.length > 0) setCustomSources(parsedCustom);

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

    // v0.9.31: 添加自定义源 (id 冲突则拒绝)
    const addCustomSource = (source: ResourceSite): boolean => {
        if (customSources.some(s => s.id === source.id)) return false;
        setCustomSources(prev => [...prev, source]);
        return true;
    };

    // v0.9.x: 修改自定义源 (id 固定，更新可编辑字段)
    const updateCustomSource = (id: string, patch: Partial<ResourceSite>): boolean => {
        if (!customSources.some(s => s.id === id)) return false;
        setCustomSources(prev => prev.map(s => s.id === id ? { ...s, ...patch, id } : s));
        return true;
    };

    // v0.9.31: 删除自定义源 (同时从禁用列表移除, 防止残留)
    const removeCustomSource = (id: string) => {
        setCustomSources(prev => prev.filter(s => s.id !== id));
        setDisabledSources(prev => prev.filter(s => s !== id));
    };

    // v0.9.31: 导入时整体替换自定义源
    const importSources = (sources: ResourceSite[], disabled: string[]) => {
        setCustomSources(sources);
        setDisabledSources(disabled);
    };

    const saveSettings = () => {
        try {
            setCookie('VOD_DISABLED_SOURCES_V2', JSON.stringify(disabledSources));
            saveCustomSourcesToCookies(customSources);
            setCookie('VOD_MOVIE_SOURCE', movieSource);
            setCookie('VOD_TV_SOURCE', tvSource);
            setCookie('VOD_CUSTOM_LOCAL_URL', customLocalUrl);
            return true;
        } catch (e: unknown) {
            logger.error('Settings', 'Failed to save settings:', e);
            return false;
        }
    };

    return {
        mounted,
        settings: {
            disabledSources,
            movieSource,
            tvSource,
            customLocalUrl,
            customSources
        },
        setters: {
            setDisabledSources,
            setMovieSource,
            setTvSource,
            setCustomLocalUrl,
            toggleSource,
            addCustomSource,
            updateCustomSource,
            removeCustomSource,
            importSources,
            setCustomSources
        },
        saveSettings
    };
}
