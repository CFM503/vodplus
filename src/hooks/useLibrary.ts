
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Movie, ApiResponse } from '@/types';
import { logger } from '@/lib/logger';

interface LibraryState {
    list: Movie[];
    total: number;
    page: number;
    limit: number;
    isLoading: boolean;
}

export function useLibrary(
    initialData: ApiResponse | null,
    sourceId: string,
    mediaType: 'movie' | 'tv' | string
) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pageParam = parseInt(searchParams.get('page') || '1');
    const isSSR = true;

    const [state, setState] = useState<LibraryState>({
        list: initialData?.list || [],
        total: Number(initialData?.total) || 0,
        page: Number(initialData?.page) || pageParam,
        limit: Number(initialData?.limit) || 20,
        isLoading: !initialData,
    });

    // Handle sourceId, pageParam or mediaType changes
    useEffect(() => {
        if (initialData && Number(initialData.page) === pageParam) {
            setState({
                list: initialData.list || [],
                total: Number(initialData.total) || 0,
                page: Number(initialData.page) || pageParam,
                limit: Number(initialData.limit) || 20,
                isLoading: false,
            });
            return;
        }

        // Client-side fetch fallback when navigating without SSR pre-loaded data
        setState(prev => ({ ...prev, isLoading: true, list: [] }));
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/vod/latest?source=${sourceId}&page=${pageParam}&type=${mediaType}`);
                const data = await res.json();
                setState({
                    list: data.list || [],
                    total: Number(data.total) || 0,
                    page: Number(data.page) || pageParam,
                    limit: Number(data.limit) || 20,
                    isLoading: false,
                });
            } catch (error) {
                logger.error('Library', 'fetch error:', error);
                setState(prev => ({ ...prev, isLoading: false }));
            }
        };
        fetchData();
    }, [sourceId, pageParam, mediaType, initialData]);

    const goToPage = (newPage: number) => {
        if (newPage < 1) return;

        // Construct new URL
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', newPage.toString());
        const newUrl = `/latest?${params.toString()}`;

        router.push(newUrl, { scroll: true });
    };

    return {
        ...state,
        goToPage,
        isSSR
    };
}
