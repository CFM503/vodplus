export interface Movie {
    vod_id: string;
    vod_name: string;
    vod_pic: string;
    vod_remarks: string;
    type_name: string;
    vod_year?: string;
    vod_area?: string;
    vod_actor?: string;
    vod_director?: string;
    vod_content?: string;
    vod_play_url?: string;
    vod_play_from?: string;
    source_id?: string;
    latency?: number; // API response time in milliseconds
}

export interface ApiResponse {
    code: number;
    msg: string;
    page: number | string;
    pagecount: number | string;
    limit: number | string;
    total: number | string;
    list: Movie[];
}

export interface Episode {
    name: string;
    url: string;
}
