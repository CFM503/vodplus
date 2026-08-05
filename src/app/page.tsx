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
  async (s, dsKey, cul) => {
    const ds = dsKey ? dsKey.split(",") : [];
    return getTrendingMovies(s, ds, cul);
  },
  ["trending-movies-v2"],
  { revalidate: CONFIG.TRENDING_REVALIDATE, tags: ["trending"] }
);

const getCachedTrendingTv = unstable_cache(
  async (s, dsKey, cul) => {
    const ds = dsKey ? dsKey.split(",") : [];
    return getTrendingTv(s, ds, cul);
  },
  ["trending-tv-v2"],
  { revalidate: CONFIG.TRENDING_REVALIDATE, tags: ["trending"] }
);

const getCachedNewestAction = unstable_cache(
  async (dsKey, cul) => {
    const ds = dsKey ? dsKey.split(",") : [];
    return getNewestAction(ds, cul);
  },
  ["newest-action-v2"],
  { revalidate: CONFIG.CATEGORY_REVALIDATE, tags: ["latest"] }
);

const getCachedNewestTv = unstable_cache(
  async (dsKey, cul) => {
    const ds = dsKey ? dsKey.split(",") : [];
    return getNewestTv(ds, cul);
  },
  ["newest-tv-v2"],
  { revalidate: CONFIG.CATEGORY_REVALIDATE, tags: ["latest"] }
);

async function TrendingMoviesSection({ source, disabledSources, customLocalUrl }: { source: string; disabledSources: string[]; customLocalUrl: string }) {
  const dsKey = disabledSources.join(",");
  const list = await getCachedTrendingMovies(source, dsKey, customLocalUrl);
  if (!list || list.length === 0) return null;
  // Only the first above-the-fold section gets priority image loading
  return <HomeSection title={source === "tmdb" ? "今日趋势 (电影)" : "热门电影 (本地)"} list={list} iconColor="indigo" priorityCount={6} />;
}

async function ActionSection({ disabledSources, customLocalUrl }: { disabledSources: string[]; customLocalUrl: string }) {
  const dsKey = disabledSources.join(",");
  const list = await getCachedNewestAction(dsKey, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title="最新入库 (动作片)" list={list} iconColor="orange" />;
}

async function TrendingTvSection({ source, disabledSources, customLocalUrl }: { source: string; disabledSources: string[]; customLocalUrl: string }) {
  const dsKey = disabledSources.join(",");
  const list = await getCachedTrendingTv(source, dsKey, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title={source === "tmdb" ? "今日趋势 (电视剧)" : "热门剧集 (本地)"} list={list} iconColor="emerald" />;
}

async function NewestTvSection({ disabledSources, customLocalUrl }: { disabledSources: string[]; customLocalUrl: string }) {
  const dsKey = disabledSources.join(",");
  const list = await getCachedNewestTv(dsKey, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title="最新入库 (国产剧)" list={list} iconColor="pink" />;
}

export default async function Home() {
  const cookieStore = await cookies();
  const { disabledSources: rawDisabled, movieSource, tvSource, customLocalUrl } = await getUserPreferences(cookieStore);
  // Sort to ensure deterministic cache keys regardless of cookie order
  const disabledSources = [...rawDisabled].sort();

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