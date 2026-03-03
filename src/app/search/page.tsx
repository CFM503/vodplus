import { Header } from '@/components/Header';
import { SearchResults } from '@/components/search/SearchResults';
import { Sparkles } from 'lucide-react';
import { RESOURCE_SITES } from '@/lib/resources';
import { cookies } from 'next/headers';
import { getUserPreferences } from '@/lib/preferences';

export const runtime = 'edge';

interface PageProps {
    searchParams: Promise<{
        q?: string;
    }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
    const { q } = await searchParams;
    const keyword = q || '';

    // Read preferences
    const cookieStore = await cookies();
    const { disabledSources } = await getUserPreferences(cookieStore);

    // Prepare active sources list for client
    const activeSources = RESOURCE_SITES
        .filter(s => !disabledSources.includes(s.id))
        .map(s => ({ id: s.id, name: s.name }));

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            <Header />

            <main className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-amber-400 w-6 h-6" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">"{keyword}"</span> 的搜索结果
                    </h1>
                </div>


                <SearchResults
                    keyword={keyword}
                    activeSources={activeSources}
                />
            </main>
        </div>
    );
}
