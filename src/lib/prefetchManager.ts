// Prefetch manager for predictive preloading
import { useEffect } from 'react';

class PrefetchManager {
  private static instance: PrefetchManager;
  private prefetchedUrls = new Set<string>();
  private prefetchQueue: Array<{ url: string; priority: 'low' | 'high' }> = [];
  private isProcessing = false;

  private constructor() {}

  static getInstance(): PrefetchManager {
    if (!PrefetchManager.instance) {
      PrefetchManager.instance = new PrefetchManager();
    }
    return PrefetchManager.instance;
  }

  prefetch(url: string, priority: 'low' | 'high' = 'low'): void {
    if (this.prefetchedUrls.has(url)) return;
    
    this.prefetchedUrls.add(url);
    this.prefetchQueue.push({ url, priority });
    
    if (priority === 'high') {
      // Process high priority immediately
      this.processQueue();
    } else if (!this.isProcessing) {
      // Process low priority in next tick
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.prefetchQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.prefetchQueue.length > 0) {
      const { url } = this.prefetchQueue.shift()!;
      try {
        // Use no-cors to avoid CORS issues, just warm the cache
        fetch(url, { 
          priority: 'low', 
          mode: 'no-cors',
          cache: 'force-cache'
        }).catch(() => {});
      } catch (e) {
        // Ignore errors in prefetch
      }
      
      // Small delay between prefetches to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    this.isProcessing = false;
  }

  clear(): void {
    this.prefetchedUrls.clear();
    this.prefetchQueue = [];
  }
}

export const prefetchManager = PrefetchManager.getInstance();

// Hook for automatic prefetch on hover
export function usePrefetchOnHover(url?: string, enabled = true) {
  useEffect(() => {
    if (!url || !enabled) return;
    
    const handleMouseEnter = () => {
      prefetchManager.prefetch(url, 'low');
    };
    
    // In a real implementation, you would attach this to a DOM element
    // For now, we export the manager for manual use
    
    return () => {
      // Cleanup if needed
    };
  }, [url, enabled]);
}
