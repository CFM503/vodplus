import { useEffect, useRef, useState } from 'react';

// 创建浏览器本地缓存 (使用原生 Map 实现)
class LocalCache {
  private store = new Map<string, { value: any; expires: number }>();

  put(key: string, value: any, ttl?: number) {
    const expires = ttl ? Date.now() + ttl * 1000 : -1;
    this.store.set(key, { value, expires });
  }

  get<T = any>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expires !== -1 && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }

    return item.value as T;
  }

  del(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const localCache = new LocalCache();

// 服务端缓存配置
const CACHE_CONFIG = {
  // API 响应缓存时间 (秒)
  API_CACHE_TTL: 300, // 5分钟
  // 视频元数据缓存时间 (秒)
  VIDEO_METADATA_TTL: 1800, // 30分钟
  // TMDB 数据缓存时间 (秒)
  TMDB_CACHE_TTL: 7200, // 2小时
  // HLS 清单缓存时间 (秒)
  HLS_PLAYLIST_TTL: 3600, // 1小时
};

// 智能预取策略
class SmartPrefetcher {
  private prefetchQueue: string[] = [];
  private isPrefetching = false;
  private maxConcurrent = 3;

  // 添加预取任务
  addPrefetch(url: string, priority: 'high' | 'medium' | 'low' = 'medium') {
    this.prefetchQueue.push(url);
    this.processQueue();
  }

  // 处理预取队列
  private async processQueue() {
    if (this.isPrefetching || this.prefetchQueue.length === 0) return;

    this.isPrefetching = true;

    const activePromises: Promise<any>[] = [];

    while (this.prefetchQueue.length > 0 && activePromises.length < this.maxConcurrent) {
      const url = this.prefetchQueue.shift()!;
      const promise = this.prefetchResource(url);
      activePromises.push(promise);
    }

    await Promise.allSettled(activePromises);
    this.isPrefetching = false;
  }

  // 预取单个资源
  private async prefetchResource(url: string) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-cache',
        mode: 'no-cors',
      });

      // 如果 HEAD 请求失败，尝试 GET 请求获取元数据
      if (!response.ok) {
        const metadataResponse = await fetch(url, {
          method: 'GET',
          cache: 'no-cache',
          mode: 'no-cors',
          headers: {
            'Range': 'bytes=0-1023', // 只获取前1KB
          },
        });

        if (metadataResponse.ok) {
          // 缓存元数据
          const metadata = {
            headers: Object.fromEntries(metadataResponse.headers.entries()),
            size: parseInt(metadataResponse.headers.get('content-length') || '0'),
            lastModified: metadataResponse.headers.get('last-modified'),
            etag: metadataResponse.headers.get('etag'),
          };

          localCache.put(url, metadata, CACHE_CONFIG.VIDEO_METADATA_TTL);
        }
      } else {
        // 缓存成功响应的元数据
        const metadata = {
          headers: Object.fromEntries(response.headers.entries()),
          status: response.status,
        };

        localCache.put(url, metadata, CACHE_CONFIG.VIDEO_METADATA_TTL);
      }
    } catch (error) {
      console.warn('预取失败:', url, error);
    }
  }

  // 预取相邻剧集
  prefetchAdjacentEpisodes(currentUrl: string, nextUrl?: string, prevUrl?: string) {
    const urls = [];
    if (nextUrl) urls.push(nextUrl);
    if (prevUrl) urls.push(prevUrl);

    urls.forEach(url => this.addPrefetch(url, 'high'));
  }

  // 预取相似内容
  prefetchSimilarContent(category: string, currentId: string) {
    // 这里可以实现基于相似度的预取逻辑
    // 例如：预取同一类型的其他视频
    console.log('预取相似内容:', category, currentId);
  }
}



// 缓存管理器
class CacheManager {
  private cache: LocalCache;

  constructor() {
    this.cache = localCache;
  }

  // 存储缓存
  set(key: string, value: any, ttl?: number) {
    this.cache.put(key, value, ttl);
  }

  // 获取缓存
  get<T = any>(key: string): T | null {
    return this.cache.get(key);
  }

  // 删除缓存
  delete(key: string) {
    this.cache.del(key);
  }

  // 清除所有缓存
  clear() {
    this.cache.clear();
  }

  // 智能缓存策略
  smartCache<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    // 先尝试获取缓存
    const cached = this.get<T>(key);
    if (cached) {
      return Promise.resolve(cached);
    }

    // 缓存未命中，执行 fetch 函数
    return fetchFn().then(result => {
      // 缓存结果
      this.set(key, result, ttl);
      return result;
    });
  }

  // API 响应缓存
  cacheApiResponse<T>(url: string, data: T): void {
    this.set(url, data, CACHE_CONFIG.API_CACHE_TTL);
  }

  // 获取 API 响应缓存
  getApiResponse<T>(url: string): T | null {
    return this.get<T>(url);
  }

  // 清理过期缓存
  cleanup() {
    // 这里可以实现更复杂的清理逻辑
  }
}


// React Hook: 使用缓存
export function useSmartCache<T>(key: string, fetchFn: () => Promise<T>, ttl?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const cache = new CacheManager();
        const result = await cache.smartCache(key, fetchFn, ttl);
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [key, fetchFn, ttl]);

  return {
    data, loading, error, refetch: () => {
      const load = async () => {
        setLoading(true);
        setError(null);
        try {
          const cache = new CacheManager();
          const result = await cache.smartCache(key, fetchFn, ttl);
          setData(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : '加载失败');
        } finally {
          setLoading(false);
        }
      };
      load();
    }
  };
}

// 预加载优化 Hook
export function usePrefetch() {
  const prefetchRef = useRef(new SmartPrefetcher());

  const prefetchVideo = (url: string) => {
    prefetchRef.current.addPrefetch(url, 'high');
  };

  const prefetchAdjacent = (currentUrl: string, nextUrl?: string, prevUrl?: string) => {
    prefetchRef.current.prefetchAdjacentEpisodes(currentUrl, nextUrl, prevUrl);
  };

  const prefetchSimilar = (category: string, currentId: string) => {
    prefetchRef.current.prefetchSimilarContent(category, currentId);
  };

  return { prefetchVideo, prefetchAdjacent, prefetchSimilar };
}

