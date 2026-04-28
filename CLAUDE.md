# CLAUDE.md

VODPlus 是一个基于 Next.js 15 (App Router) 的视频聚合播放平台，部署在 Cloudflare Pages (Edge Runtime)。聚合多个第三方 VOD API 数据源，使用 hls.js 播放 HLS/MP4 流，TMDB 提供元数据。

## 技术栈

- Next.js 15.5 + React 19 + TypeScript 5
- Tailwind CSS 4（PostCSS 集成）
- hls.js 1.6（HLS 流播放）
- 部署：Cloudflare Pages (`@opennextjs/cloudflare`)
- 运行时：Edge Runtime（所有 API 路由和服务端组件）

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run lint         # ESLint 检查
npx tsc --noEmit     # TypeScript 类型检查
```

## 项目结构

```
src/
├── app/                        # Next.js App Router 页面
│   ├── page.tsx                # 首页（Suspense 流式渲染）
│   ├── layout.tsx              # 根布局（zh-CN, no-referrer）
│   ├── movie/[sourceId]/[id]/  # 播放/详情页
│   ├── search/                 # 全文搜索页
│   ├── latest/                 # 最新影片列表
│   └── api/vod/                # API 路由（search, latest, health）
├── components/
│   ├── VideoPlayer.tsx         # 播放器主容器（编排器）
│   ├── player/                 # 播放器子组件
│   │   ├── VideoControls.tsx   # 控制栏（移动端/桌面端布局）
│   │   ├── VideoProgressBar.tsx # 进度条（Pointer Events 拖拽）
│   │   ├── ControlButtons.tsx  # 设置/全屏/画中画按钮
│   │   ├── PlayerSettingsPanel.tsx # 分辨率/倍速/缓冲设置面板
│   │   └── EpisodeControls.tsx # 上一集/下一集导航
│   └── home/, latest/, search/ # 各页面专属组件
├── hooks/
│   ├── useVideoPlayer.ts       # 播放器编排器 hook（组合所有子 hook）
│   └── player/                 # 8 个播放器子 hook（见下方架构说明）
├── config/
│   └── config.ts               # 所有可调参数集中管理
├── lib/
│   ├── services/               # 数据获取层（vodService, fetcher, normalizer）
│   ├── resources.ts            # 片源站点定义
│   ├── vodParser.ts            # 解析播放地址格式
│   ├── metadata/               # TMDB 元数据
│   └── logger.ts, utils.ts, preferences.ts
└── types/                      # TypeScript 类型定义
```

## 关键架构

### 播放器编排器模式

`useVideoPlayer` 是唯一的顶层 hook，按依赖顺序组合 8 个子 hook，返回统一 API 对象：

1. `useHlsSource` — HLS 生命周期管理
2. `useVideoSettings` — 设置面板状态
3. `usePlaybackHealth` — 卡死检测与自动跳过
4. `useVideoEvents` — 视频元素事件 → progress/duration/buffered
5. `useVideoGestures` — 移动端触摸手势（音量/亮度/快进）
6. `useVideoSeek` — 进度条拖拽跳转（仅接收百分比值，由 VideoProgressBar 计算位置）
7. `useVideoControls` — 控制栏显隐、全屏切换、8 秒自动隐藏
8. `useVideoKeyboard` — 桌面端键盘快捷键

**数据向下流动**：编排器持有跨模块状态（volume, muted, rate, scale），通过 memoized API 传递给子组件。**事件向上冒泡**：子 hook 的回调接入编排器。

### 进度条拖拽系统

- `VideoProgressBar` 使用 Pointer Events 统一处理鼠标/触摸拖拽
- 组件内部维护拖拽 UI 状态（dragPercent, isDragging），是拖拽位置的唯一数据源
- 使用独立的 `trackRef`（绑定在视觉轨道 div 上）计算百分比，确保与 `left: X%` 视觉位置一致
- `useVideoSeek` 只接收百分比值 `(percent: number)` 执行视频跳转，不解析事件对象

### 数据获取流程

Resource API → fetcher（带缓存策略）→ normalizer（统一格式）→ vodService → 组件

### 影片匹配策略

TMDB 元数据 → 并发搜索所有片源 → "竞速取 N" → 选择最佳匹配

## 编码规范

- 所有可调常量放在 `src/config/config.ts`，禁止硬编码魔法数字
- 代码注释使用中文
- 所有 API 路由使用 `export const runtime = 'edge'`
- 剧集地址格式：`name$url#name2$url2`，多播放列表用 `$$$` 分隔，由 `parseVodPlayUrl()` 解析
- 修改播放器时，注意子 hook 的调用顺序有依赖关系，不要随意调整
- 进度条相关修改：位置计算基于 `trackRef`（内层轨道 div），不是外层容器的 `progressBarRef`
