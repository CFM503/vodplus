'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MonitorPlay, Settings, User, LogIn, LogOut } from 'lucide-react';
import dynamic from 'next/dynamic';
const SettingsModal = dynamic(() => import('./SettingsModal'), { ssr: false });

export function Header() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [authStatus, setAuthStatus] = useState<{ enabled: boolean; authenticated: boolean; username?: string } | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;
        fetch('/api/auth/status')
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.code === 1) {
                    setAuthStatus(data.data);
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, []);

    // Close user menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showUserMenu]);

    const handleLogout = async () => {
        setShowUserMenu(false);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            setAuthStatus(prev => prev ? { ...prev, authenticated: false } : null);
            router.refresh();
        } catch {}
    };

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
                                className="px-4 py-2 md:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-r-xl border border-indigo-500 transition-colors shadow-lg active:scale-95 cursor-pointer"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        </form>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <nav className="flex items-center space-x-2 sm:space-x-4 text-sm font-bold text-slate-400 shrink-0">
                            <Link href="/" prefetch={true} className="px-2 py-1.5 hover:text-white transition-colors hidden md:block">首页</Link>
                            <Link href="/latest" prefetch={true} className="px-2.5 py-1.5 hover:text-white transition-colors">片库</Link>
                        </nav>

                        {/* Authentication Status Badge / Buttons */}
                        {authStatus?.enabled && (
                            authStatus.authenticated ? (
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => setShowUserMenu(!showUserMenu)}
                                        className="px-2.5 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-slate-200 border border-indigo-500/30 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                                        title={authStatus.username || '用户'}
                                    >
                                        <User className="w-3.5 h-3.5 text-indigo-400" />
                                        <span className="hidden sm:inline max-w-[70px] truncate">{authStatus.username || '已登录'}</span>
                                    </button>

                                    {showUserMenu && (
                                        <div className="absolute right-0 mt-2 w-36 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95">
                                            <div className="px-3 py-2 text-[11px] text-slate-400 border-b border-white/5 truncate">
                                                账号: <strong className="text-white">{authStatus.username}</strong>
                                            </div>
                                            <button
                                                onClick={handleLogout}
                                                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                            >
                                                <LogOut className="w-3.5 h-3.5" />
                                                <span>退出登录</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Link
                                    href="/login"
                                    className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="登录账号"
                                >
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>登录</span>
                                </Link>
                            )
                        )}

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-90 cursor-pointer"
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
