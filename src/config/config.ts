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

    // 详情页自动匹配时的并发批次大小
    // 例如 3 表示每次同时搜 3 个站。越大速度越快但服务器压力越大。
    MATCH_BATCH_SIZE: 3,

    // 自动匹配时，等待收集到的最快结果数量 (竞速优选策略)
    // 系统会等待最先返回的 N 个结果，然后从中挑选匹配度最高的。
    // 默认: 3 (兼顾速度与准确性)
    // 1: 极速模式 (找到第一个就停，可能不准)
    // 5: 精准模式 (等待更多结果对比，速度稍慢)
    MATCH_CANDIDATE_COUNT: 3,

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
    // 建议: 10 (快速起播) ~ 30 (抗卡顿)
    DEFAULT_BUFFER_LENGTH: 10,

    // HLS 分片拉取超时时间 (毫秒)
    // 网络差时建议调大
    HLS_TIMEOUT: 10000,

    // 播放卡死检测阈值 (毫秒)
    // waiting 状态持续超过此时间，触发跳过恢复
    STALL_THRESHOLD_MS: 8000,

    // 卡死时跳过秒数
    STALL_SKIP_SECONDS: 5,

    // 最大连续跳过次数，超过后提示用户切换线路
    MAX_STALL_SKIPS: 5,

    // API 数据缓存时间 (秒)
    // 控制首页/详情页数据在边缘节点缓存多久，减少重复请求。
    // 0: 不缓存；300: 缓存5分钟 (默认)
    API_REVALIDATE_SECONDS: 300,

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

    // 点击手势最大持续时间 (毫秒)
    // 超过此时间算长按或拖拽
    TAP_MAX_DURATION: 300,

    // 点击手势最大位移 (像素)
    // 超过此位移算拖拽
    TAP_MAX_MOVEMENT: 10,

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

    // 是否显示视频左上角的集数/标题浮层
    // true: 显示 (默认)
    // false: 隐藏
    SHOW_EPISODE_TITLE_OVERLAY: true,

    // 封面图加载时的模糊占位（base64 SVG）
    // 在封面图真正加载完成前显示一个深色模糊占位，避免闪烁。
    // 可替换为符合品牌风格的自定义 base64 图片。
    IMAGE_BLUR_PLACEHOLDER: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUyOTNiIi8+PC9zdmc+',
};
