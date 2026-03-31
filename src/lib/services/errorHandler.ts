import { logger } from '../logger';

/**
 * Unified error handling middleware for API services
 * Provides consistent error logging and fallback values
 */

interface ErrorHandlingOptions<T> {
    /** Context for error logging (e.g., "TMDB Trending Movies") */
    context: string;
    /** Fallback value to return on error */
    fallback: T;
    /** Whether to throw the error after logging (default: false) */
    shouldThrow?: boolean;
    /** Whether to suppress error logging (default: false) */
    silent?: boolean;
}

/**
 * Wraps an async function with unified error handling
 * 
 * @example
 * const data = await withErrorHandling(
 *   () => fetchFromAPI(),
 *   { context: 'API Fetch', fallback: [] }
 * );
 */
export async function withErrorHandling<T>(
    fn: () => Promise<T>,
    options: ErrorHandlingOptions<T>
): Promise<T> {
    const { context, fallback, shouldThrow = false, silent = false } = options;

    try {
        return await fn();
    } catch (error) {
        // Log error with context unless silent
        if (!silent) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(context, errorMessage);

            // Future: Add error reporting here
            // reportToSentry(error, context);
        }

        // Throw error if requested
        if (shouldThrow) {
            throw error;
        }

        // Return fallback value
        return fallback;
    }
}
