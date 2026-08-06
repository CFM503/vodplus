import { CONFIG } from '@/config/config';

/**
 * Pure utility function to check if an item's title matches the target title.
 * Used for cross-source candidate line matching without importing server/SSR services.
 */
export function isNameMatch(itemVodName: string, targetName: string): boolean {
    if (!itemVodName || !targetName) return false;
    const nameA = itemVodName.trim();
    const nameB = targetName.trim();

    if (nameA === nameB) return true;
    if (nameA.includes(nameB) || nameB.includes(nameA)) return true;

    if (CONFIG.MATCH_CLEAN_TITLE) {
        const clean = (str: string) => str.replace(/[\(（\[【].*?[\)）\]】]/g, '').trim();
        const cleanA = clean(nameA);
        const cleanB = clean(nameB);
        if (cleanA && cleanB && (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA))) {
            return true;
        }
    }

    return false;
}
