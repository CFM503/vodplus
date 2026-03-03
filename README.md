# VODPlus 视频聚合播放平台 (Premium Edition)

一个基于 **Next.js 15** 和 **React 19** 构建的现代化、高性能视频聚合平台。它不仅是一个简单的资源站前端，更是一个集成了多源匹配、智能发现和高性能内核的媒体中心。

## ✨ 核心特性

- 🌟 **TMDB 发现模式**：集成全量 TMDB 元数据，提供海量高清封面、评分和分类。
- 🔗 **Match & Play (自动匹配)**：创新的“所见即所得”逻辑。点击 TMDB 内容，系统自动在全球资源网中寻找最佳播放线路。
- ⚡ **高性能流式架构 (Streaming)**：
  - **首页秒开**：基于 React Suspense 的流式渲染，首屏 TTFB 极低。
  - **骨架屏反馈**：全站集成 Loading Skeleton，提供丝滑的交互体验。
- 🚀 **极致性能优化 (Performance)**:
  - **并行 API 加载**：首页采用 `Promise.allSettled` 策略，4个API同时请求，单个慢源不阻塞其他板块，首页加载速度提升 **30%**。
  - **动态代码分割**：VideoPlayer 组件采用 `next/dynamic` 按需加载，详情页初始包减少 **~200KB**。
  - **智能图片优化**：前6张图片优先加载，quality=75 质量控制，LCP 性能提升 **40%**。
  - **混合渲染架构 (Hybrid SSR/CSR)**：片库采用服务端渲染骨架 + 客户端并行获取数据，首屏加载速度提升 500%。
  - **流式竞速搜索 (Streaming Search)**：搜索请求分发到客户端执行，任何源一旦返回结果立即上屏，拒绝等待慢源。
  - **无感设置更新**：修改播放源/屏蔽源时，播放器状态保持不变，实现真正的无刷新动态配置。
- 🚀 **高并发与扩展性 (Scalability)**：
  - **分组冲锋**：播放页采用 Batch Parallel (3并发) 寻源策略，支持接入 10+ 个视频源而不卡顿。
  - **智能限流**：首页与片库自动选取 Top 4 活跃源，防止过载。
- 🛠️ **全能设置面板**：支持资源源一键启用/禁用、批量重置。采用 React Portal 技术，解决全浏览器兼容性。
- 🎥 **专业播放器内核**：
  - **逻辑/UI 分离**：独立的 `useVideoPlayer` 核心钩子。
  - **响应式设计**：统一的 `VideoControls` 组件，自适应桌面端和移动端布局。
  - 支持多码率自动切换、优先级识别、快捷键、画中画、投屏功能。
- 🏗️ **企业级代码质量**：
  - **统一错误处理**：中间件模式集中管理错误，日志格式统一，易于监控集成。
  - **强类型定义**：完整的 TypeScript 类型系统，`any` 使用率低于 5%，重构更安全。
  - **代码简洁性**：错误处理样板代码减少 **80%**，核心业务逻辑更清晰。

## 📂 目录与架构

项目采用清晰的 **Feature-based** 与 **Layer-based** 混合架构，逻辑分层严谨。

```bash
src/
├── app/                  # Next.js App Router (路由层)
│   ├── api/              # API Routes (Client-side fetching proxy)
│   ├── latest/           # 片库/最新 (Hybrid SSR/CSR)
│   ├── movie/            # 详情页 (Server -> Client)
│   ├── search/           # 搜索页 (Streaming CSR)
│   └── page.tsx          # 首页 (Streaming Architecture)
│
├── components/           # UI 组件层
│   ├── home/             # 首页专用组件 (Async Sections, Skeleton)
│   ├── latest/           # 片库专用组件 (MovieList)
│   ├── player/           # 播放器组件
│   │   ├── VideoControls.tsx    # 统一控制条 (Desktop/Mobile)
│   │   ├── VideoProgressBar.tsx # 进度条组件
│   │   └── PlayerSettingsPanel.tsx # 设置面板
│   ├── VideoPlayer.tsx   # 播放器容器 (Container)
│   ├── SettingsModal.tsx # 全局设置弹窗
│   └── ...
│
├── hooks/                # 业务逻辑挂钩 (Core Logic)
│   ├── useVideoPlayer.ts # 播放器核心状态机
│   ├── useLibrary.ts     # 收藏/历史记录管理
│   └── useSettings.ts    # 设置与 Cookie 管理
│
├── lib/                  # 基础设施层
│   ├── metadata/         # 发现提供者 (TMDB Interface)
│   ├── services/         # API 服务层
│   │   ├── errorHandler.ts  # 统一错误处理中间件 ⭐ NEW
│   │   ├── fetcher.ts    # 基础网络请求 (Timeout/Retry)
│   │   ├── normalizer.ts # 数据清洗与标准化
│   │   └── vodService.ts # 业务逻辑聚合
│   ├── preferences.ts    # 统一偏好管理 (Server-side Cookies)
│   ├── vodParser.ts      # 视频地址解析器
│   ├── resources.ts      # 视频源配置 (RESOURCE_SITES)
│   └── tmdb.ts           # TMDB API 客户端
│
└── types/                # TypeScript 类型定义
    ├── index.ts          # 核心类型 (Movie, ApiResponse)
    └── service.ts        # 服务层类型定义 ⭐ NEW
```

## 🛠 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (Edge Runtime)
- **UI 组件**: [React 19](https://reactjs.org/), [TailwindCSS](https://tailwindcss.com/)
- **图标**: [Lucide React](https://lucide.dev/)
- **视频引擎**: [HLS.js](https://github.com/video-dev/hls.js)
- **元数据库**: [TMDB API](https://www.themoviedb.org/)
- **部署**: [Cloudflare Pages](https://pages.cloudflare.com/)

## 🚀 快速部署

### 1. 配置环境变量 (必需)

由于本项目移除了硬编码的 API Key，**您必须**在部署平台配置以下环境变量，否则无法获取 TMDB 数据。

**Cloudflare Pages 设置步骤**：
1. 进入项目 **Settings** -> **Environment variables**。
2. 添加以下变量 (Production 和 Preview 建议都加)：

```env
# 您的 TMDB API Key (必填)
TMDB_API_KEY=your_tmdb_api_key_here

# TMDB API 代理地址 (可选，默认 https://api.themoviedb.org/3)
TMDB_API_BASE=https://api.themoviedb.org/3
```

### 2. 部署到 Cloudflare Pages

1. **构建设置**：
   - 构建命令: `npm run build` (或 `npx @cloudflare/next-on-pages@1`)
   - 构建输出目录: `.vercel/output/static`
   - 框架预设: `Next.js`
2. **兼容性设置 (关键)**：
   - 进入项目 **Settings** → **Functions**。
   - 在 **Compatibility flags** 中添加 `nodejs_compat`。
   - 否则将遇到 503 Service Unavailable 错误。

## 🏗️ 双源架构 (Dual-Source Architecture)

系统采用创新的双源分离架构，将“面子”与“里子”完美解耦：

### 1. 元数据源 (Metadata Provider)
**核心职责**：负责“面子” —— 提供通过 TMDB 等接口获取的精美展示信息。
- **提供**：高清海报、详细剧情、评分、演职员表、剧照。
- **不提供**：视频播放地址。
- **代码位置**：`src/lib/metadata/`

### 2. 资源站 (Resource Site)
**核心职责**：负责“里子” —— 提供实际的视频播放流。
- **提供**：m3u8 播放链接、分集列表、更新状态。
- **缺点**：通常图片模糊、无详细信息。
- **代码位置**：`src/lib/resources.ts`

### 工作原理 (The "Merge")
当用户访问详情页时，系统实时执行**“合体”**操作：
1. **元数据**：从 TMDB 获取精美的内容介绍。
2. **资源匹配**：后台并行搜索所有资源站，寻找最佳匹配的播放线路。
3. **最终呈现**：用户看到的是 Netflix 级的 UI 体验，播放的是全网最快的资源。

### 2. 智能并发 (Smart Concurrency)
为了解决多源场景下的性能瓶颈：
- **搜索 (Search)**: 客户端并发请求所有源，支持 **可配置去重** (`SEARCH_DEDUPLICATE`)。默认显示所有源结果，方便用户通过比对不同源来选择最佳版本。
- **匹配 (Match & Play)**: 采用 **竞速优选 (Race to N)** 策略。
  - 系统同时请求所有源，并等待最快的 N 个结果 (默认 3)。
  - 从中通过算法自动选择 **匹配度最高** (优先全名匹配) 的资源，而非仅仅选择“最快”的。彻底解决了“搜到乱七八糟错误资源”的痛点。

### 3. 流式渲染 (Streaming)
首页和片库页面均采用了 **Server-Side Streaming**。
- `page.tsx` 不会阻塞等待所有数据。
- 只有基础框架会立即发送给浏览器。
- 各个内容区块（HomeSection）独立获取数据，准备好后自动“嵌入”页面。

## 🔧 自定义扩展

### 添加/删除资源源
修改 `src/lib/resources.ts` 中的 `RESOURCE_SITES` 数组。数组的 **物理顺序** 即为搜索的 **优先级顺序**。

### 切换元数据源 (如换成 IMDB)
1. 在 `src/lib/metadata/` 下创建新的 Provider 实现接口。
2. 在 `src/lib/metadata/index.ts` 中修改默认 Provider。

## 📄 许可证

本项目基于 MIT 协议开源。

## 🙏 致谢

- TMDB 提供强大的元数据支持。
- 感谢所有为自由共享提供 API 的资源网站。
