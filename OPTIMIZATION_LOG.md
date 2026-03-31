# VODPlus 项目优化日志

## 2026-03-31 VODPlus 优化实施记录

### 概述

本次优化主要针对 7 个代码质量与性能问题进行修复，涵盖死代码清理、无效代码删除、预加载策略优化、API 错误处理、全局错误边界、列表虚拟化和日志格式统一。

---

### 修改清单

#### #8 — 移除无效的 `useVideoPreload` ✅

| 项目 | 详情 |
|---|---|
| 文件 | `src/components/VideoPlayer.tsx` |
| 变更 | 删除 `useVideoPreload` 函数（第 24-36 行），删除调用语句和未使用的 import |
| 原因 | HLS.js 已内部管理加载逻辑，创建隐藏 `<video>` 元素预加载对 HLS 流无效，纯属浪费 DOM 资源 |
| 风险 | 🟢 零风险 — 纯删除无用代码 |

#### #9 — 剧集列表预加载策略优化 ✅

| 项目 | 详情 |
|---|---|
| 文件 | `src/app/movie/[sourceId]/[id]/ClientPlayerWrapper.tsx` |
| 变更 | `onMouseEnter`/`onTouchStart` 条件从 `currentEpIndex !== idx` 改为 `idx === currentEpIndex + 1` |
| 原因 | 原逻辑会为所有非当前集触发 `fetch`，200 集的剧鼠标扫过时发出大量无效请求 |
| 风险 | 🟢 低风险 — 仅收窄预加载范围，不影响播放功能 |

#### #10 — 剧集列表窗口化渲染 ✅

| 项目 | 详情 |
|---|---|
| 文件 | `src/app/movie/[sourceId]/[id]/ClientPlayerWrapper.tsx` |
| 变更 | 1. 新增 `useRef` 和 `useCallback` 引入 2. 添加 `visibleRange` 状态 3. 添加 `gridRef` ref 4. 新增 `handleScroll` 滚动监听，动态计算可见范围 5. 仅在 `episodes.length > 60` 时启用窗口化 6. 未启用窗口化时保持原始直接渲染 |
| 原因 | 大量剧集同时渲染影响滚动性能，窗口化仅渲染可视区域元素 |
| 风险 | 🟡 中风险 — 需验证滚动交互流畅性 |

#### #13 — API 路由返回正确 HTTP 状态码 ✅

| 项目 | 详情 |
|---|---|
| 文件 | `src/app/api/vod/search/route.ts`, `src/components/search/SearchResults.tsx`, `src/app/latest/page.tsx` |
| 变更 | 1. search route 错误时返回 500 和错误信息 2. SearchResults 组件检查 `res.ok` 并正确标记错误状态 3. latest page 错误处理也检查 HTTP 状态，区分 HTTP 错误和其他错误 |
| 原因 | API 错误时返回 200 空列表会让前端无法感知错误，返回正确状态码更标准且利于调试和监控 |
| 风险 | 🟡 中风险 — 需前后端联调确保兼容 |

#### #14 — 添加全局 Error Boundary ✅

| 项目 | 详情 |
|---|---|
| 文件 | `src/components/ErrorBoundary.tsx` (新建), `src/app/layout.tsx` (修改) |
| 变更 | 1. 新建全局 ErrorBoundary 组件，捕获渲染时错误 2. 在 layout.tsx 中用 ErrorBoundary 包装 children |
| 原因 | 防止未处理的 React 运行时错误导致白屏，给用户友好的错误提示和刷新按钮 |
| 风险 | 🟢 低风险 — 纯增量添加，不影响现有逻辑 |

#### #15 — 清理死文件 ✅

| 项目 | 详情 |
|---|---|
| 文件 | `src/lib/cacheManager.ts` |
| 变更 | 删除未被任何文件导入的死文件 |
| 原因 | 未被使用，无意义 |
| 风险 | 🟢 零风险 — 纯清理 |

#### #16 — 统一错误处理和日志格式 ✅

| 项目 | 详情 |
|---|---|
| 文件 | `src/lib/logger.ts` (新建), 多个 `lib/` 和 `hooks/` 下的文件 |
| 变更 | 1. 新建 `logger.ts` 统一日志输出格式为 `[模块] 消息` 2. 替换所有文件中的 `console.error` / `console.warn` / `console.error` 调用为 logger.error / logger.warn 3. 影响文件：`vodParser.ts`, `fetcher.ts`, `normalizer.ts`, `vodService.ts`, `tmdb.ts`, `metadata/tmdb.ts`, `preferences.ts` |
| 原因 | 当前日志格式不统一，混杂中英文和多种风格，不利于排查问题 |
| 风险 | 🟡 中风险 — 涉及多处文件修改，但仅改变日志内容 |

---

### 统计

| 类型 | 数量 |
|---|---|
| 新建文件 | 2 |
| 修改文件 | 12 |
| 删除文件 | 1 |
| 删除代码行 | ~60 |
| 新增代码行 | ~180 |

---

### 遗留问题（本次未处理）

| 编号 | 问题 | 严重程度 | 原因 |
|---|---|---|---|
| #1 | CSP Header 过于宽松 | 🔴 严重 | 需要评估对功能的影响 |
| #2 | 图片域名白名单过于宽松 | 🔴 严重 | 需要确认所有图片来源域 |
| #3 | Cache-Control 应用于所有路径 | 🔴 严重 | 需要区分静态资源和页面 |
| #4 | API Key 可能已提交 | 🔴 严重 | 需要检查 .gitignore |
| #5 | `useVideoPlayer` 过于庞大 | 🟡 中 | 重构需要较大工作量 |
| #6 | 代码中存在多个 `any` 类型 | 🟡 中 | 需要逐步替换为正确类型 |
| #7 | TMDB 逻辑重复、`Episode` 重复定义 | 🟡 中 | 需要结构重构 |
| #17 | 重复注释、重复赋值等小问题 | 🟢 低 | 琐碎问题，后续顺手修复 |

---

### 后续计划

1. **安全修复** — 处理 CSP、图片白名单、API Key 等安全问题
2. **类型安全** — 消除 `any` 类型，为 CONFIG 添加接口定义
3. **代码重构** — 拆分 `useVideoPlayer` 为多个专用 hook
4. **监控接入** — 考虑接入 Sentry 或其他错误追踪服务
