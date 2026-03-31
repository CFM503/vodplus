# 中优先级优化执行计划

## 阶段 1: Quick Wins (M-2, M-11, M-10, M-9)

### M-2: 删除重复赋值
**文件**: `src/hooks/useVideoPlayer.ts` (第 162-163 行)

```diff
             if (url.includes('.mp4') || url.includes('.webm')) {
-                video.src = url;
                 video.src = url;
                 setIsLoading(false);
```

### M-11: MovieListWrapper 类型修复
**文件**: `src/app/latest/page.tsx` (第 102 行)

```diff
+ interface MovieListWrapperProps {
+     sourceId: string;
+     pageNum: number;
+     mediaType: 'movie' | 'tv';
+     disabledSources: string[];
+     customLocalUrl: string;
+ }
+ 
- async function MovieListWrapper({ sourceId, pageNum, mediaType, disabledSources, customLocalUrl }: any) {
+ async function MovieListWrapper({ sourceId, pageNum, mediaType, disabledSources, customLocalUrl }: MovieListWrapperProps) {
```

### M-10: Episode 接口统一
**文件**: `src/types/index.ts` (新增)

```diff
 export interface ApiResponse {
     ...
 }
+ 
+ export interface Episode {
+     name: string;
+     url: string;
+ }
```

**文件**: `src/lib/vodParser.ts`

```diff
- interface Episode {
-     name: string;
-     url: string;
- }
+ import { Episode } from '@/types';
```

**文件**: `src/app/movie/[sourceId]/[id]/ClientPlayerWrapper.tsx`

```diff
- interface Episode {
-     name: string;
-     url: string;
- }
+ import { Episode } from '@/types';
```

### M-9: 消除 TMDB 常量重复
**文件**: `src/lib/metadata/tmdb.ts`

```diff
 import { SERVER_CONFIG } from '@/config/server';
- 
- const TMDB_API_KEY = SERVER_CONFIG.TMDB.API_KEY;
- const TMDB_BASE_URL = SERVER_CONFIG.TMDB.BASE_URL;
+ import { TMDB_API_KEY, TMDB_BASE_URL } from '@/lib/tmdb';
```

需要先在 `src/lib/tmdb.ts` 中导出：

```diff
- const TMDB_API_KEY = SERVER_CONFIG.TMDB.API_KEY;
- const TMDB_BASE_URL = SERVER_CONFIG.TMDB.BASE_URL;
+ export const TMDB_API_KEY = SERVER_CONFIG.TMDB.API_KEY;
+ export const TMDB_BASE_URL = SERVER_CONFIG.TMDB.BASE_URL;
```

---

## 阶段 2: 类型安全 (M-5)

### fetcher.ts 泛型改造
**文件**: `src/lib/services/fetcher.ts`

```diff
- export async function fetchRawFromSource(source: ResourceSite, params: string = '', noStore = false): Promise<any> {
+ export async function fetchRawFromSource(source: ResourceSite, params: string = '', noStore = false): Promise<unknown> {
```

### useVideoPlayer.ts Hls 类型
**文件**: `src/hooks/useVideoPlayer.ts`

```diff
+ import type Hls from 'hls.js';
- const hlsRef = useRef<any>(null);
+ const hlsRef = useRef<Hls | null>(null);
```

### Catch 块 unknown 类型 (全局)
所有 `catch (e: any)` 改为 `catch (e: unknown)`
所有 `catch (error: any)` 改为 `catch (error: unknown)`

影响文件:
- `src/lib/tmdb.ts`
- `src/lib/metadata/tmdb.ts`
- `src/hooks/useVideoPlayer.ts`
- `src/hooks/useSettings.ts`
- `src/hooks/useLibrary.ts`

---

## 阶段 3: 日志统一 (M-3)

### 创建 logger 模块
**新建文件**: `src/lib/logger.ts`

```typescript
export const logger = {
    info: (ctx: string, ...args: unknown[]) => console.info(`[${ctx}]`, ...args),
    warn: (ctx: string, ...args: unknown[]) => console.warn(`[${ctx}]`, ...args),
    error: (ctx: string, ...args: unknown[]) => console.error(`[${ctx}]`, ...args),
};
```

### 迁移文件 (29处)

| 文件 | 修改 |
|------|------|
| `tmdb.ts` (3处) | + `import { logger } from './logger'` |
| `metadata/tmdb.ts` (5处) | + `import { logger } from '../logger'` |
| `services/vodService.ts` (5处) | + `import { logger } from './logger'` |
| `services/fetcher.ts` (2处) | + `import { logger } from './logger'` |
| `services/errorHandler.ts` (1处) | + `import { logger } from './logger'` |
| `preferences.ts` (1处) | + `import { logger } from './logger'` |
| `useVideoPlayer.ts` (4处) | + `import { logger } from './logger'` |
| `useSettings.ts` (2处) | + `import { logger } from './logger'` |
| `useLibrary.ts` (1处) | + `import { logger } from './logger'` |
| `VideoProgressBar.tsx` (1处) | + `import { logger } from './logger'` |
| `latest/page.tsx` (1处) | + `import { logger } from './logger'` |
| `api/vod/search/route.ts` (1处) | + `import { logger } from './logger'` |
| `api/vod/latest/route.ts` (1处) | + `import { logger } from './logger'` |

---

## 阶段 4: Cloudflare Pages 迁移 (M-4)

### 修改 package.json
```diff
     "devDependencies": {
-        "@cloudflare/next-on-pages": "^1.13.7",
+        "@opennextjs/cloudflare": "^1.0.0",
```

### 修改 scripts
```diff
-    "pages:build": "npx @cloudflare/next-on-pages",
-    "preview": "npm run pages:build && wrangler pages dev .vercel/output/static",
+    "pages:build": "npx @opennextjs/cloudflare",
+    "preview": "npm run pages:build && wrangler dev",
```

---

## 阶段 5: 后续大工程 (M-1, M-8)

### M-1: useVideoPlayer 拆解 (924行)
- `useHlsPlayer` - HLS 初始化/level管理/错误恢复
- `useGestureControls` - 触摸/鼠标手势
- `useSeekControls` - 进度条拖拽/点击
- `usePlaybackState` - 播放/暂停/音量/倍速
- `useAutoHideControls` - 控件可见性

### M-8: 剧集列表窗口化渲染
- 引入 `@tanstack/react-virtual` 或手动实现
- 100+ 集剧集性能提升显著

---

## 执行状态

- [ ] M-2 删除重复赋值
- [ ] M-11 MovieListWrapper 类型
- [ ] M-10 Episode 接口统一
- [ ] M-9 TMDB 常量去重
- [ ] M-5 减少 any 类型
- [ ] M-3 日志统一
- [ ] M-4 Cloudflare 迁移
- [ ] M-1 useVideoPlayer 拆分
- [ ] M-8 剧集窗口化渲染
