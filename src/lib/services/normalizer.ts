import { Movie, ApiResponse } from '@/types';
import { RESOURCE_SITES, ResourceSite } from '../resources';
import { getProxyImage, getThemedPlaceholder } from '../utils';

export function normalizeVodResponse(data: any, source: ResourceSite, duration: number): ApiResponse {
    if (!data) {
        return { code: 500, msg: 'Error or Empty', page: 1, pagecount: 0, limit: 0, total: 0, list: [] };
    }

    const movies: Movie[] = (data.list || data.data || []).map((m: any) => {
        const rawPic = m.vod_pic || m.pic;
        const typeName = m.type_name || m.type;
        const vodName = m.vod_name || m.name;
        const picUrl = rawPic ? getProxyImage(rawPic) : getThemedPlaceholder(typeName, vodName);

        // Clean up play_from (e.g., "feifan$$$ffm3u8" -> "非凡资源")
        const rawPlayFrom = m.vod_play_from || '';
        const cleanPlayFrom = rawPlayFrom.split('$$$')[0];
        const displaySource = RESOURCE_SITES.find(s => s.id === cleanPlayFrom || s.name === cleanPlayFrom)?.name || source.name;

        return {
            vod_id: m.vod_id || m.id,
            vod_name: vodName,
            vod_pic: picUrl,
            vod_remarks: m.vod_remarks || m.note,
            type_name: typeName,
            vod_year: m.vod_year || m.year,
            vod_area: m.vod_area || m.area,
            vod_actor: m.vod_actor || m.actor,
            vod_director: m.vod_director || m.director,
            vod_content: m.vod_content || m.des || m.content,
            vod_play_url: m.vod_play_url,
            vod_play_from: displaySource,
            source_id: source.id,
            latency: duration
        };
    });

    return {
        code: data.code || 1,
        msg: data.msg || 'OK',
        page: data.page || 1,
        pagecount: data.pagecount || 1,
        limit: data.limit || 20,
        total: data.total || movies.length,
        list: movies
    };
}
