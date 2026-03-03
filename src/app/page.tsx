import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { HomeSection } from '@/components/home/HomeSection';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';
import { Footer } from '@/components/layout/Footer';
import { cookies } from 'next/headers';
import { getUserPreferences } from '@/lib/preferences';
import { getTrendingMovies, getTrendingTv, getNewestAction, getNewestTv } from '@/lib/services/vodService';

export const runtime = 'edge';
export const revalidate = 60;

// 预加载关键资源
export const metadata = {
  title: 'VOD 视频聚合播放平台',
  description: '极速视频聚合平台，0等待播放体验',
  openGraph: {
    title: 'VOD 视频聚合播放平台',
    description: '极速视频聚合平台，0等待播放体验',
  },
};

// 预加载关键 API
export const fetchCache = 'force-no-store';

// ---- Individual Async Section Components (for Suspense Streaming) ----

async function TrendingMoviesSection({ source, disabledSources, customLocalUrl }: { source: string, disabledSources: string[], customLocalUrl: string }) {
  const list = await getTrendingMovies(source, disabledSources, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title={source === 'tmdb' ? '今日趋势 (电影)' : '热门电影 (本地)'} list={list} iconColor="indigo" />;
}

async function ActionSection({ disabledSources, customLocalUrl }: { disabledSources: string[], customLocalUrl: string }) {
  const list = await getNewestAction(disabledSources, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title="最新入库 (动作片)" list={list} iconColor="orange" />;
}

async function TrendingTvSection({ source, disabledSources, customLocalUrl }: { source: string, disabledSources: string[], customLocalUrl: string }) {
  const list = await getTrendingTv(source, disabledSources, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title={source === 'tmdb' ? '今日趋势 (电视剧)' : '热门剧集 (本地)'} list={list} iconColor="emerald" />;
}

async function NewestTvSection({ disabledSources, customLocalUrl }: { disabledSources: string[], customLocalUrl: string }) {
  const list = await getNewestTv(disabledSources, customLocalUrl);
  if (!list || list.length === 0) return null;
  return <HomeSection title="最新入库 (国产剧)" list={list} iconColor="pink" />;
}

// ---- Main Page ----

export default async function Home() {
  const cookieStore = await cookies();
  const { disabledSources, movieSource, tvSource, customLocalUrl } = await getUserPreferences(cookieStore);

  return (
    <div className="min-h-screen bg-slate-950 pb-20 selection:bg-indigo-500/30">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-12">

        {/* Each section renders independently via Suspense streaming.
                    The skeleton appears immediately, then section data streams as it arrives. */}

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
