
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
    }
];
