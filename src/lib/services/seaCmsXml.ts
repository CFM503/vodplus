// SeaCMS (MacCMS XML 采集协议 RSS 5.1) 解析器
// Edge Runtime 没有 DOMParser，也不引入新依赖，使用正则解析。
// 输出结构与 MacCMS JSON 对齐（{code,msg,page,pagecount,limit,total,list}），
// 使 normalizer.ts 无需改动即可直接消费。
//
// 安全说明：部分被入侵/被植入后门的采集站会在 <pic> 字段注入
// 模板代码（#{if:...}{end if}）或 XSS payload，例如：
//   #{if:1)@eval(pack('H*',...));//}{end if}"><img src=1 onerror=...><a a="https://real/pic.jpg
// sanitizePicUrl 负责将这类 payload 彻底丢弃，只保留纯净的 http(s) 图片地址。

function stripCdata(raw: string): string {
    return raw.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function decodeEntities(raw: string): string {
    return raw
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function cleanText(raw: string): string {
    if (!raw) return '';
    let s = stripCdata(raw);
    s = decodeEntities(s);
    // 去除控制字符（\u0009 \u000A \u000D 保留）
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    return s.trim();
}

/**
 * 图片地址净化：取第一个 # 之前的部分，且必须为纯净的 http(s) URL。
 * 注入站把 #{if:...}{end if} 模板代码放在 pic 最前面，按 # 切割后为空 → 丢弃。
 * 合法 URL 中带 #fragment 的（如 ?x=1#frag）会被保留 query 部分，同样安全。
 */
function sanitizePicUrl(raw: string): string {
    if (!raw) return '';
    const beforeHash = raw.split('#')[0].trim();
    if (!/^https?:\/\/[^\s"'<>]+$/.test(beforeHash)) return '';
    return beforeHash;
}

function getField(block: string, tag: string): string {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1] : '';
}

export function parseSeaCmsXml(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed.startsWith('<')) return undefined;

    const listAttrMatch = trimmed.match(/<list\s+([^>]*)>/);
    if (!listAttrMatch) return undefined;

    const attrs = listAttrMatch[1] || '';
    const attrNum = (name: string): number => {
        const m = attrs.match(new RegExp(`${name}\\s*=\\s*["'](\\d+)["']`));
        return m ? parseInt(m[1], 10) : 0;
    };

    const page = attrNum('page');
    const pagecount = attrNum('pagecount');
    const pagesize = attrNum('pagesize');
    const recordcount = attrNum('recordcount');

    const list: any[] = [];
    const videoRe = /<video>([\s\S]*?)<\/video>/g;
    let videoMatch: RegExpExecArray | null;
    while ((videoMatch = videoRe.exec(trimmed)) !== null) {
        const block = videoMatch[1];
        const item: any = {
            id: cleanText(getField(block, 'id')),
            name: cleanText(getField(block, 'name')),
            type: cleanText(getField(block, 'type')),
            pic: sanitizePicUrl(cleanText(getField(block, 'pic'))),
            lang: cleanText(getField(block, 'lang')),
            area: cleanText(getField(block, 'area')),
            year: cleanText(getField(block, 'year')),
            note: cleanText(getField(block, 'note')),
            state: cleanText(getField(block, 'state')),
            actor: cleanText(getField(block, 'actor')),
            director: cleanText(getField(block, 'director')),
            des: cleanText(getField(block, 'des')),
            vod_play_from: '',
            vod_play_url: '',
        };

        // <dl><dd flag="线路名">第1集$url#第2集$url</dd></dl>
        // 多线路时按 MacCMS 惯例用 $$$ 连接，与客户端播放器解析逻辑一致
        const dlMatch = block.match(/<dl>([\s\S]*?)<\/dl>/);
        if (dlMatch) {
            const flags: string[] = [];
            const urls: string[] = [];
            const ddRe = /<dd(?:\s+flag\s*=\s*["']([^"']*)["'])?>([\s\S]*?)<\/dd>/g;
            let ddMatch: RegExpExecArray | null;
            while ((ddMatch = ddRe.exec(dlMatch[1])) !== null) {
                flags.push(cleanText(ddMatch[1] || ''));
                urls.push(cleanText(ddMatch[2]));
            }
            item.vod_play_from = flags.join('$$$');
            item.vod_play_url = urls.join('$$$');
        }

        list.push(item);
    }

    return {
        code: 1,
        msg: 'OK',
        page: page || 1,
        pagecount: pagecount || 1,
        limit: pagesize || 20,
        total: recordcount || list.length,
        list,
    };
}
