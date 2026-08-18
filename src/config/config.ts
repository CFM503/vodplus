/**
 * 全局应用配置文件
 * 集中管理所有硬编码参数，方便统一调优
 */
export const CONFIG = {
    // ===========================
    // 🔍 搜索与匹配策略
    // ===========================

    // 片源搜索超时时间 (毫秒)
    // 影响范围：
    // 1. 全库关键词搜索 (searchAllSources)
    // 2. 详情页自动匹配播放源 (getMovieDetail -> fetchFromSource)
    // 3. 首页/片库页的分类数据加载 (getRecentMovies, fetchMixedCategory)
    // 注意：调大此值可提高成功率，但会增加无结果时的等待时间
    SEARCH_TIMEOUT: 10000,
    // 列表/分类接口快速超时时间 (毫秒)，防止慢源站长时间挂起 SSR 渲染
    LIST_TIMEOUT: 4000,

    // 特定资源源的超时时间（毫秒），未配置的源沿用SEARCH_TIMEOUT
    SOURCE_TIMEOUT_MAP: {
        "hongniu": 15000 // 红牛资源超时设为15秒
    } as Record<string, number>,

    // 详情页自动匹配时的并发批次大小
    // 例如 3 表示每次同时搜 3 个站。越大速度越快但服务器压力越大。
    MATCH_BATCH_SIZE: 3,

    // 自动匹配时，等待收集到的最快结果数量 (竞速优选策略)
    // 系统会尽可能收集更多有效候选源 (默认: 8，尽量覆盖全部活跃站)
    MATCH_CANDIDATE_COUNT: 8,
    // 详情页单个视频源搜索匹配的超时时间 (毫秒)，防范慢源站挂起详情页起播
    MATCH_SOURCE_TIMEOUT: 3500,
    // 竞速匹配总超时上限 (毫秒)，到期即收工返回已有候选，防范全源挂起 SSR 渲染
    MATCH_TOTAL_TIMEOUT: 5500,
    // 客户端跨源线路由浏览器发起分散请求的并发限制 (默认: 3，避开与 HLS 抢带宽)
    // v2: 资源站增至 14 个, 提高到 5 加快线路匹配完成速度 (各站域名不同, 不受同域 6 连接限制)
    CLIENT_MATCH_CONCURRENCY: 5,
    // 客户端单个源搜索请求超时时间 (毫秒, 默认: 5000)
    CLIENT_MATCH_TIMEOUT_MS: 5000,
    // 是否开启去除括号副标题的二次匹配 (如：长安十二时辰(粤语) 与 长安十二时辰)
    MATCH_CLEAN_TITLE: true,

    // 搜索结果是否去重
    // true: 合并同名同年的电影 (只显示一个，界面整洁)
    // false: 显示所有源的结果 (方便对比各源资源，界面结果多)
    // 默认: false (不去重)
    SEARCH_DEDUPLICATE: false,

    // 全库搜索时的并发请求限制
    // 浏览器一般限制同域名并发数为 6，建议设置为 5 以避免请求阻塞 (Pending)
    CONCURRENCY_LIMIT: 5,

    // 全网搜索最大返回结果数
    // 限制过多的结果导致前端渲染卡顿
    MAX_SEARCH_RESULTS: 200,

    // ===========================
    // 🎮 播放器交互体验
    // ===========================

    // 播放页屏幕中心 播放/暂停 按钮显示开关
    // 0: 隐藏 (默认), 1: 显示
    SHOW_CENTER_PLAY_BUTTON: 0,

    // 长按倍速播放的倍率
    // 例如 3.0 表示 3倍速
    LONG_PRESS_SPEED: 3.0,

    // 双击快进/快退的秒数
    SKIP_SECONDS: 10,

    // 控制栏自动隐藏延迟 (毫秒)
    // 鼠标静止多久后隐藏 UI
    CONTROLS_AUTO_HIDE_TIME: 8000,

    // 是否自动隐藏控制栏
    // true: 鼠标静止后自动隐藏
    // false: 鼠标静止后保持显示 (仅移出播放器区域或点击视频时隐藏)
    AUTO_HIDE_CONTROLS: true,

    // 双击判定时间间隔 (毫秒)
    // 两次点击在此间隔内才算双击
    DOUBLE_TAP_DELAY: 300,

    // ===========================
    // 📡 网络与缓冲策略
    // ===========================

    // 默认起播缓冲长度 (秒)
    // 降低此值可加快起播速度，HLS.js 会在播放中自动继续缓冲更多。
    // 建议: 15 (快速起播) ~ 45 (晚高峰抗卡顿)
    DEFAULT_BUFFER_LENGTH: 20,
    // 网络自适应缓冲配置 (晚高峰网络抖动时动态扩展至 45s 抗抖动缓冲)
    BUFFER_ADAPTIVE: true,
    BUFFER_LOW_BW: 10,
    BUFFER_HIGH_BW: 45,
    // HLS 分片拉取最大重试超时 (毫秒，8000ms 快速超时并退避重试，防范卡死)
    HLS_FRAGMENT_TRY_TIMEOUT: 8000,

    // HLS 清单/层级加载超时时间 (毫秒)
    HLS_TIMEOUT: 5000,

    // 播放卡死检测阈值 (毫秒)
    // waiting 状态持续超过此时间，触发跳过恢复 (3000ms 快速响应恢复)
    STALL_THRESHOLD_MS: 3000,

    // 卡死时跳过秒数
    STALL_SKIP_SECONDS: 5,

    // 最大连续跳过次数，超过后提示用户切换线路
    MAX_STALL_SKIPS: 4,

    // 线路自动切换 (v0.9.25):
    // 当前线路反复卡顿 (达到 MAX_STALL_SKIPS) 时, 自动切换到偏好列表里更快的线路, 而不是只弹提示
    // 典型场景: 直连速度贴着码率临界点 (如量子源 ~112KB/s vs 100KB/s 码率), 稍有波动就缓冲
    AUTO_SWITCH_LINE: true,
    // 自动切换的线路偏好顺序 (按实测 CDN 速度从快到慢; 只列出已知快的, 其余线路按原顺序排在后面)
    LINE_PREFERENCE: ['jisu', '360zy', 'hongniu', 'hongniu3', 'guangsu', 'liangzi', 'feifan'],

    // API 数据缓存时间 (秒)
    // 控制首页/详情页数据在边缘节点缓存多久，减少重复请求。
    // 0: 不缓存；300: 缓存5分钟 (默认)
    API_REVALIDATE_SECONDS: 300,
    // 详情页数据及源站匹配长效缓存时间 (秒) - 默认 12 小时 (43200秒)
    DETAIL_REVALIDATE_SECONDS: 43200,

    // 分类缓存时间（秒），不同内容类型使用不同缓存时长
    TRENDING_REVALIDATE: 60, // 热门内容1分钟缓存
    CATEGORY_REVALIDATE: 600, // 分类内容10分钟缓存

    // ===========================
    // 🎨 UI 细节与阈值 (高级设置)
    // ===========================

    // Toast 提示显示时长 (毫秒)
    TOAST_DISPLAY_TIME: 3000,

    // 移动端手势判定阈值
    // 垂直滑动最小距离 (像素)，防误触
    GESTURE_VERTICAL_THRESHOLD: 30,

    // 垂直滑动判定为调节音量/亮度的 宽高比阈值
    // DeltaY > DeltaX * 1.5 才算垂直滑动
    GESTURE_ASPECT_RATIO_THRESHOLD: 1.5,

    // 水平滑动快进/快退：整屏宽度对应的 seek 秒数
    HORIZONTAL_SEEK_SECONDS: 90,

    // 点击手势最大持续时间 (毫秒)
    // 超过此时间算长按或拖拽
    TAP_MAX_DURATION: 300,

    // 点击手势最大位移 (像素)
    // 超过此位移算拖拽 (调至 20px 消除 10~30px 轻触盲区)
    TAP_MAX_MOVEMENT: 20,

    // 拖动进度条结束后的点击抑制时间 (毫秒)
    // 防止拖动结束时误触发点击暂停
    SEEK_CLICK_SUPPRESSION_DELAY: 200,

    // 双击快进触发区域占比 (0.3 = 屏幕左右 30%)
    DOUBLE_TAP_SKIP_ZONE_PERCENT: 0.3,

    // 进度条颜色 (十六进制)
    // 默认: #4f46e5 (Indigo-600, 与主题一致)
    PROGRESS_BAR_COLOR: '#4f46e5',

    // 是否启用缩略图预览
    // true: 开启 (尝试加载预览视频)
    // false: 关闭 (仅显示时间)
    SHOW_THUMBNAIL_PREVIEW: true,

    // 进度条高度 (CSS像素)
    // 建议范围 3-10。桌面端悬停/移动端会在此基础上自动增加厚度。
    PROGRESS_BAR_HEIGHT: 10,

    // 进度条圆形指针额外增加的大小 (px)
    // 最终直径 = 进度条高度 + 此数值
    // 默认: 15 (即 直径 = 高度 + 15px)
    PROGRESS_BAR_HANDLE_SIZE_ADD: 15,

    // 进度条圆形指针颜色 (十六进制)
    // 默认: #FFFFFF (白色) 或 #d1d5db (灰色)
    // YouTube 默认是红色，但用户想要灰色
    PROGRESS_BAR_HANDLE_COLOR: '#d1d5db',

    // 设置面板自动关闭时间 (毫秒)
    // 用户停止交互后多久自动关闭设置面板
    SETTINGS_AUTO_CLOSE_TIME: 10000,

    // 手势 HUD 自动隐藏时间 (毫秒)
    // 双击快进/快退提示显示多久后自动消失
    GESTURE_HUD_AUTO_HIDE_TIME: 1000,

    // 是否显示视频左上角的集数/标题浮层
    // true: 显示 (默认)
    // false: 隐藏
    SHOW_EPISODE_TITLE_OVERLAY: true,

    // 封面图加载时的模糊占位（base64 SVG）
    // 在封面图真正加载完成前显示一个深色模糊占位，避免闪烁。
    // 可替换为符合品牌风格的自定义 base64 图片。
    IMAGE_BLUR_PLACEHOLDER: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUyOTNiIi8+PC9zdmc+',

    // 封面缩略图代理宽度 (px) — 卡片展示足够，避免拉取源站原图
    IMAGE_THUMB_WIDTH: 400,

    // 封面缩略图 WebP 质量 (1-100)
    IMAGE_THUMB_QUALITY: 70,
};
