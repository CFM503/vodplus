
export interface ResourceSite {
    id: string;
    name: string;
    baseUrl: string;
    searchPath: string;
    detailPath: string;
    headers?: Record<string, string>;
    // v0.9.26: 视频分片 CDN 节点位置 (实测定位, 用于设置页资源站管理列表展示)
    region?: string;
}

export const RESOURCE_SITES: ResourceSite[] = [
    {
        id: 'feifan',
        name: '非凡资源',
        region: 'FRA',
        baseUrl: 'https://cj.ffzyapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'liangzi',
        name: '量子资源',
        region: 'EWR/FRA',
        baseUrl: 'https://cj.lziapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'hongniu',
        name: '红牛资源',
        region: 'SJC',
        baseUrl: 'https://www.hongniuzy2.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        // v0.9.30: 红牛网络备用域名 (同一 CDN, 主域名失效时兜底)
        id: 'hongniu3',
        name: '红牛3',
        region: 'SJC',
        baseUrl: 'https://www.hongniuzy3.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'jisu',
        name: '极速资源',
        region: 'HKG',
        baseUrl: 'https://jszyapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'guangsu',
        name: '光速资源',
        region: 'SJC',
        baseUrl: 'https://api.guangsuapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    // ============ v3: 亚洲/国内节点资源站 (2026-08 实测) ============
    // 360资源: 分片节点在国内 (合肥电信/哈尔滨联通), 实测 ~700KB/s, 国内最快的通用线路
    // 注意: 未收录《长安十二时辰》, 但有大量热门新片 (如《狂飙》)
    {
        id: '360zy',
        name: '360资源',
        region: 'CN',
        baseUrl: 'https://360zy.com/api.php/provide/vod',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    }
];
