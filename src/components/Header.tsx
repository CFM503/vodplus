'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MonitorPlay, Settings } from 'lucide-react';
import SettingsModal from './SettingsModal';

export function Header() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const router = useRouter();

    return (
        <>
            <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/60">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <Link href="/" className="flex items-center space-x-2 group shrink-0">
                        <div className="p-2 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                            <MonitorPlay className="h-6 w-6 text-indigo-400" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 hidden sm:block">
                            vod
                        </span>
                    </Link>

                    <div className="flex-1 max-w-sm md:max-w-md mx-4">
                        <form
                            action="/search"
                            className="relative flex items-center group"
                            onMouseEnter={() => router.prefetch('/search')}
                            onTouchStart={() => router.prefetch('/search')}
                        >
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    name="q"
                                    type="search"
                                    autoComplete="off"
                                    placeholder="搜索全网资源..."
                                    className="w-full rounded-l-xl bg-slate-900/50 border border-slate-800 py-2 md:py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all placeholder:text-slate-600"
                                />
                            </div>
                            <button
                                type="submit"
                                className="px-4 py-2 md:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-r-xl border border-indigo-500 transition-colors shadow-lg active:scale-95"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        </form>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <nav className="flex items-center space-x-4 text-sm font-bold text-slate-400 shrink-0">
                            <Link href="/" prefetch={true} className="hover:text-white transition-colors hidden md:block">首页</Link>
                            <Link href="/latest" prefetch={true} className="hover:text-white transition-colors">片库</Link>
                        </nav>

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-90"
                            title="设置"
                        >
                            <Settings className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    );
}
