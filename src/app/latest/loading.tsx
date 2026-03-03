import { Header } from '@/components/Header';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';

export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <div className="h-9 w-32 bg-slate-800 rounded mb-2 animate-pulse" />
                        <div className="h-5 w-48 bg-slate-800/60 rounded animate-pulse" />
                    </div>
                    <div className="h-10 w-full md:w-96 bg-slate-800/60 rounded-xl animate-pulse" />
                </div>

                {/* Reuse the grid skeleton from Home */}
                <HomeSkeleton />
            </main>
        </div>
    );
}
