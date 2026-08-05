import { Header } from '@/components/Header';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';

export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <div className="h-9 w-32 rounded mb-2 shimmer-item" />
                        <div className="h-5 w-48 rounded shimmer-item" />
                    </div>
                    <div className="h-10 w-full md:w-96 rounded-xl shimmer-item" />
                </div>

                {/* Reuse the grid skeleton from Home */}
                <HomeSkeleton />
            </main>
        </div>
    );
}
