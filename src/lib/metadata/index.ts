import { MetadataProvider } from './interface';
import { TmdbMetadataProvider } from './tmdb';

const providers: Record<string, MetadataProvider> = {
    tmdb: new TmdbMetadataProvider(),
};

export const getMetadataProvider = (id: string): MetadataProvider => {
    return providers[id] || providers['tmdb'];
};

// Default for legacy/simple usage
export const metadata = providers['tmdb'];
