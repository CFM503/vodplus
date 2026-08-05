import { Header } from '@/components/Header';
import { Loader2 } from 'lucide-react';

export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            <Header />

            <main className="container mx-auto px-4 pt-4 animate-pulse">
                {/* Player Section Skeleton */}
                <div className="mb-8">
                    <div className="relative aspect-video w-full bg-slate-900/90 rounded-2xl border border-white/10 overflow-hidden flex flex-col items-center justify-center shadow-2xl">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                            <span className="text-slate-400 text-sm font-medium">正在加载视频播放器...</span>
                        </div>
                        {/* Control bar skeleton at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                            <div className="h-4 bg-slate-800 rounded w-1/4"></div>
                            <div className="flex items-center gap-3">
                                <div className="h-4 w-4 bg-slate-800 rounded-full"></div>
                                <div className="h-4 w-4 bg-slate-800 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Movie Info Skeleton */}
                <div className="glass p-6 rounded-2xl space-y-4 mb-8">
                    <div className="h-8 bg-slate-800/80 rounded-lg w-1/3"></div>
                    <div className="flex gap-2">
                        <div className="h-6 w-16 bg-slate-800/60 rounded-md"></div>
                        <div className="h-6 w-16 bg-slate-800/60 rounded-md"></div>
                        <div className="h-6 w-16 bg-slate-800/60 rounded-md"></div>
                    </div>
                    <div className="space-y-3 pt-4">
                        <div className="h-4 bg-slate-800/50 rounded w-1/2"></div>
                        <div className="h-4 bg-slate-800/50 rounded w-1/3"></div>
                        <div className="h-4 bg-slate-800/50 rounded w-1/4"></div>
                    </div>
                </div>

                {/* Description Skeleton */}
                <div className="glass p-6 rounded-2xl mb-8 space-y-3">
                    <div className="h-6 bg-slate-800/80 rounded-md w-24"></div>
                    <div className="h-4 bg-slate-800/50 rounded w-full"></div>
                    <div className="h-4 bg-slate-800/50 rounded w-5/6"></div>
                </div>
            </main>
        </div>
    );
}
