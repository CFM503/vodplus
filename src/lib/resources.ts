
export interface ResourceSite {
    id: string;
    name: string;
    baseUrl: string;
    searchPath: string;
    detailPath: string;
    headers?: Record<string, string>;
}

export const RESOURCE_SITES: ResourceSite[] = [
    {
        id: 'feifan',
        name: '非凡资源',
        baseUrl: 'https://cj.ffzyapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'liangzi',
        name: '量子资源',
        baseUrl: 'https://cj.lziapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'hongniu',
        name: '红牛资源',
        baseUrl: 'https://www.hongniuzy2.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'jisu',
        name: '极速资源',
        baseUrl: 'https://jszyapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'guangsu',
        name: '光速资源',
        baseUrl: 'https://api.guangsuapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'wolong',
        name: '卧龙资源',
        baseUrl: 'https://collect.wolongzyw.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'jinying',
        name: '金鹰资源',
        baseUrl: 'https://jyzyapi.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'wujin',
        name: '无尽资源',
        baseUrl: 'https://api.wujinapi.me/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    // ============ v2: 新增资源站 (2026-08 实测, 均通过 CORS 与 CDN 速度验证) ============
    {
        id: 'haohua',
        name: '豪华资源',
        baseUrl: 'https://haohuazy.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'subo',
        name: '速播资源',
        baseUrl: 'https://subocj.com/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'huya',
        name: '虎牙资源',
        baseUrl: 'https://huyazy.net/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'piaoling',
        name: '飘零资源',
        baseUrl: 'https://p2100.net/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'aidan',
        name: '艾旦资源',
        baseUrl: 'https://lovedan.net/api.php/provide/vod',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    },
    {
        id: 'zuida',
        name: '最大资源',
        baseUrl: 'http://zuidazy.me/api.php/provide/vod/',
        searchPath: '?ac=detail&wd=',
        detailPath: '?ac=detail&ids=',
        headers: {},
    }
];
