export const SERVER_CONFIG = {
    TMDB: {
        API_KEY: process.env.TMDB_API_KEY || '',
        BASE_URL: process.env.TMDB_API_BASE || 'https://api.themoviedb.org/3',
    },
};
