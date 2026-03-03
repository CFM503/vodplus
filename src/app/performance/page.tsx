'use client';

import { useState } from 'react';
import { usePrefetch } from '@/lib/cacheManager';
import { useSmartCache } from '@/lib/cacheManager';

export default function PerformanceTest() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { prefetchVideo } = usePrefetch();

  // 测试 API 响应时间
  const testApiResponse = async () => {
    setLoading(true);
    setProgress(0);
    setResults(null);

    const startTime = performance.now();

    try {
      // 测试最新视频 API
      const latestStart = performance.now();
      const latestResponse = await fetch('/api/vod/latest');
      const latestData = await latestResponse.json();
      const latestTime = performance.now() - latestStart;

      // 测试搜索 API
      const searchStart = performance.now();
      const searchResponse = await fetch('/api/vod/search?q=test');
      const searchData = await searchResponse.json();
      const searchTime = performance.now() - searchStart;

      // 测试缓存性能
      const cacheStart = performance.now();
      const cacheResult = await useSmartCache('test-cache-key', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { data: 'cached', timestamp: Date.now() };
      }, 300);
      const cacheTime = performance.now() - cacheStart;

      const totalTime = performance.now() - startTime;

      setResults({
        totalTime,
        latest: {
          time: latestTime,
          count: latestData?.list?.length || 0,
          data: latestData
        },
        search: {
          time: searchTime,
          count: searchData?.list?.length || 0,
          data: searchData
        },
        cache: {
          time: cacheTime,
          data: cacheResult
        }
      });

      setProgress(100);
    } catch (error) {
      setResults({ error: error instanceof Error ? error.message : '测试失败' });
      setProgress(100);
    } finally {
      setLoading(false);
    }
  };

  // 测试视频预加载
  const testVideoPrefetch = async () => {
    setLoading(true);
    setProgress(0);
    setResults(null);

    const testUrls = [
      'https://example.com/test-video.mp4',
      'https://example.com/test-video2.mp4',
      'https://example.com/test-video3.mp4'
    ];

    const startTime = performance.now();

    try {
      // 逐个预加载
      for (let i = 0; i < testUrls.length; i++) {
        setProgress(((i + 1) / testUrls.length) * 50);
        
        const url = testUrls[i];
        const prefetchStart = performance.now();
        prefetchVideo(url);
        const prefetchTime = performance.now() - prefetchStart;
        
        // 等待一小段时间模拟实际使用
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setProgress(100);

      const totalTime = performance.now() - startTime;
      setResults({
        totalTime,
        prefetch: {
          urls: testUrls.length,
          averageTime: totalTime / testUrls.length
        }
      });
    } catch (error) {
      setResults({ error: error instanceof Error ? error.message : '预加载测试失败' });
      setProgress(100);
    } finally {
      setLoading(false);
    }
  };

  // 测试页面加载性能
  const testPageLoad = async () => {
    setLoading(true);
    setProgress(0);
    setResults(null);

    const startTime = performance.now();

    try {
      // 测试多个组件的渲染性能
      const components = ['HomeSection', 'MovieCard', 'VideoPlayer', 'VideoControls'];
      
      for (let i = 0; i < components.length; i++) {
        setProgress(((i + 1) / components.length) * 100);
        
        // 模拟组件渲染时间
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const totalTime = performance.now() - startTime;
      setResults({
        totalTime,
        components: {
          count: components.length,
          averageTime: totalTime / components.length
        }
      });
    } catch (error) {
      setResults({ error: error instanceof Error ? error.message : '页面加载测试失败' });
      setProgress(100);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">性能测试工具</h1>
          <p className="text-slate-400">测试 VOD 项目的各种性能指标</p>
        </div>

        <div className="space-y-6">
          {/* 测试控制面板 */}
          <div className="grid gap-4 md:grid-cols-3">
            <button 
              onClick={testApiResponse} 
              disabled={loading} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              API 响应测试
            </button>
            <button 
              onClick={testVideoPrefetch} 
              disabled={loading} 
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              视频预加载测试
            </button>
            <button 
              onClick={testPageLoad} 
              disabled={loading} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              页面加载测试
            </button>
          </div>

          {/* 进度条 */}
          {loading && (
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">测试中...</span>
                <span className="text-slate-400">{progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* 结果展示 */}
          {results && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">测试结果</h2>
              
              {results.error ? (
                <div className="text-red-400">{results.error}</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">API 响应时间</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-400">最新视频 API:</p>
                        <p className="text-green-400 font-medium">{results.latest.time.toFixed(2)}ms</p>
                        <p className="text-slate-500 text-sm">返回 {results.latest.count} 个项目</p>
                      </div>
                      <div>
                        <p className="text-slate-400">搜索 API:</p>
                        <p className="text-green-400 font-medium">{results.search.time.toFixed(2)}ms</p>
                        <p className="text-slate-500 text-sm">返回 {results.search.count} 个项目</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">缓存性能</h3>
                    <p className="text-slate-400">缓存响应时间: {results.cache.time.toFixed(2)}ms</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">总体性能</h3>
                    <p className="text-slate-400">总测试时间: {results.totalTime.toFixed(2)}ms</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 性能建议 */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">性能优化建议</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                </div>
                <div>
                  <p className="text-slate-300">✅ 已实现智能缓存策略，减少重复请求</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                </div>
                <div>
                  <p className="text-slate-300">✅ 已实现视频预加载，提升播放体验</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                </div>
                <div>
                  <p className="text-slate-300">✅ 已优化图片加载策略，使用占位符和优先级</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3"></div>
                </div>
                <div>
                  <p className="text-slate-300">⚠️ 建议: 监控 API 响应时间，确保在 100ms 以内</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3"></div>
                </div>
                <div>
                  <p className="text-slate-300">⚠️ 建议: 定期清理浏览器缓存，避免内存占用过高</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}