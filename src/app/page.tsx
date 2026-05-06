import { Suspense } from "react";
import { Header } from "@/components/Header";
import { HomeSection } from "@/components/home/HomeSection";
import { HomeSkeleton } from "@/components/home/HomeSkeleton";
import { Footer } from "@/components/layout/Footer";
import { cookies } from "next/headers";
import { getUserPreferences } from "@/lib/preferences";
import { getTrendingMovies, getTrendingTv, getNewestAction, getNewestTv } from "@/lib/services/vodService";
import { unstable_cache } from "next/cache";
import { CONFIG } from "@/config/config";

export const runtime = "edge";
export const revalidate = 60;

export const metadata = {
  title: "VOD 视频聚合播放平台",
  description: "极速视频聚合平台，0等待播放体验",
  openGraph: {
    title: "VOD 视频聚合播放平台",
    description: "极速视频聚合平台，0等待播放体验",
  },
};

export const fetchCache = "force-no-store";

const getCachedTrendingMovies = unstable_cache(
  async (s, ds, cul) => getTrendingMovies(s, ds, cul),
  ["trending-movies"],
  { revalidate: CONFIG.API_REVALIDATE_SECONDS, tags: ["trending"] }
);

const getCachedTrendingTv = unstable_cache(
  async (s, ds, cul) => getTrendingTv(s, ds, cul),
  ["trending-tv"],
  { revalidate: CONFIG.API_REVALIDATE_SECONDS, tags: ["trending"] }
);

const getCachedNewestAction = unstable_cache(
  async (ds, cul) => getNewestAction(ds, cul),
  ["newest-action"],
  { revalidate: CONFIG.API_REVALIDATE_SECONDS, tags: ["latest"] }
);

const getCachedNewestTv = unstable_cache(
  async (ds, cul) => getNewestTv(ds, cul),
  ["newest-tv"],
  { revalidate: CONFIG.API_REVALIDATE_SECONDS, tags: ["latest"] }
);

async function TrendingMoviesSection({ source, disabledSources, customLocalUrl }: { source: string; disabledSources: string[]; customLocalUrl: string }) {
  const list = await getCachedTrendingMovies(source, disabledSources, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title={source === "tmdb" ? "今日趋势 (电影)" : "热门电影 (本地)"} list={list} iconColor="indigo" />;
}

async function ActionSection({ disabledSources, customLocalUrl }: { disabledSources: string[]; customLocalUrl: string }) {
  const list = await getCachedNewestAction(disabledSources, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title="最新入库 (动作片)" list={list} iconColor="orange" />;
}

async function TrendingTvSection({ source, disabledSources, customLocalUrl }: { source: string; disabledSources: string[]; customLocalUrl: string }) {
  const list = await getCachedTrendingTv(source, disabledSources, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title={source === "tmdb" ? "今日趋势 (电视剧)" : "热门剧集 (本地)"} list={list} iconColor="emerald" />;
}

async function NewestTvSection({ disabledSources, customLocalUrl }: { disabledSources: string[]; customLocalUrl: string }) {
  const list = await getCachedNewestTv(disabledSources, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title="最新入库 (国产剧)" list={list} iconColor="pink" />;
}

export default async function Home() {
  const cookieStore = await cookies();
  const { disabledSources, movieSource, tvSource, customLocalUrl } = await getUserPreferences(cookieStore);

  return (
    <div className="min-h-screen bg-slate-950 pb-20 selection:bg-indigo-500/30">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-12">

        <Suspense fallback={<HomeSkeleton title="今日趋势 (电影)" />}>
          <TrendingMoviesSection source={movieSource} disabledSources={disabledSources} customLocalUrl={customLocalUrl} />
        </Suspense>

        <Suspense fallback={<HomeSkeleton title="最新入库 (动作片)" />}>
          <ActionSection disabledSources={disabledSources} customLocalUrl={customLocalUrl} />
        </Suspense>

        <Suspense fallback={<HomeSkeleton title="今日趋势 (电视剧)" />}>
          <TrendingTvSection source={tvSource} disabledSources={disabledSources} customLocalUrl={customLocalUrl} />
        </Suspense>

        <Suspense fallback={<HomeSkeleton title="最新入库 (国产剧)" />}>
          <NewestTvSection disabledSources={disabledSources} customLocalUrl={customLocalUrl} />
        </Suspense>

      </main>

      <Footer />
    </div>
  );
}