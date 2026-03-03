import { Movie } from '@/types';

export interface MetadataProvider {
    id: string;
    getName(): string;
    getTrending(type: 'movie' | 'tv'): Promise<Movie[]>;
    getPopular(type: 'movie' | 'tv'): Promise<Movie[]>;
    getDiscover(type: 'movie' | 'tv', page: number): Promise<Movie[]>;
    getDetail(id: string): Promise<any>;
}
