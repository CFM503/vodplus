'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MonitorPlay, Settings, User, LogIn, LogOut } from 'lucide-react';
import dynamic from 'next/dynamic';
import SearchOverlay from './SearchOverlay';
const SettingsModal = dynamic(() => import('./SettingsModal'), { ssr: false });

export function Header({ searchValue }: { searchValue?: string }) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [authStatus, setAuthStatus] = useState<{ enabled: boolean; authenticated: boolean; username?: string } | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // 搜索框回填当前关键词：从 /search?q=xxx 跳转后输入框不再是空的，
    // 用户可以直接在原关键词基础上增删，无需重打。
    const [query, setQuery] = useState(searchValue ?? '');
    useEffect(() => {
        setQuery(searchValue ?? '');
    }, [searchValue]);

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
                <div className="container mx-auto flex h-16 items-center justify-between px-3 sm:px-4">
                    <Link href="/" className="flex items-center space-x-2 group shrink-0">
                        <div className="p-2 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                            <MonitorPlay className="h-6 w-6 text-indigo-400" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 hidden sm:block">
                            vod
                        </span>
                    </Link>

                    {/* ≥640px 用内联搜索表单；<640px 一行放不下，改用右侧图标 + 全屏浮层 */}
                    <div className="hidden sm:block flex-1 min-w-0 max-w-sm md:max-w-md mx-2 md:mx-4">
                        <form
                            action="/search"
                            className="relative flex items-center group"
                            onMouseEnter={() => router.prefetch('/search')}
                            onTouchStart={() => router.prefetch('/search')}
                        >
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                {/* text-base(16px) 阻止 iOS 聚焦时自动放大页面；min-h-[44px] 保证 44px 触控目标 */}
                                <input
                                    name="q"
                                    type="search"
                                    autoComplete="off"
                                    enterKeyHint="search"
                                    inputMode="search"
                                    aria-label="搜索全网资源"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="搜索全网资源..."
                                    className="w-full min-h-[44px] rounded-l-xl bg-slate-900/50 border border-slate-800 py-2.5 pl-9 md:pl-10 pr-3 md:pr-4 text-base md:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all placeholder:text-slate-600"
                                />
                            </div>
                            <button
                                type="submit"
                                aria-label="搜索"
                                className="shrink-0 px-3 md:px-4 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-r-xl border border-indigo-500 transition-colors shadow-lg active:scale-95 cursor-pointer"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        </form>
                    </div>

                    {/* shrink-0：右侧导航/设置不参与收缩，避免被搜索框挤到换行 */}
                    <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
                        <nav className="flex items-center space-x-2 sm:space-x-4 text-sm font-bold text-slate-400 shrink-0">
                            <Link href="/" prefetch={true} className="px-2 py-1.5 hover:text-white transition-colors hidden md:block">首页</Link>
                            <Link href="/latest" prefetch={true} className="px-2.5 py-1.5 hover:text-white transition-colors">片库</Link>
                        </nav>

                        {/* <640px 专用：打开全屏搜索浮层（内联搜索框在此断点已隐藏）。44x44 触控目标 */}
                        <button
                            type="button"
                            onClick={() => setSearchOpen(true)}
                            aria-label="打开搜索"
                            title="搜索"
                            className="sm:hidden shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all active:scale-90 cursor-pointer"
                        >
                            <Search className="h-5 w-5" />
                        </button>

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
                                    aria-label="登录账号"
                                    className="px-2.5 sm:px-3 py-1.5 min-h-[40px] rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="登录账号"
                                >
                                    <LogIn className="w-3.5 h-3.5" />
                                    {/* 移动端隐藏文字：logo+片库+登录+设置 已占满一行，
                                        这 24px 文字会把搜索框可用宽度挤成负数导致塌陷 */}
                                    <span className="hidden sm:inline">登录</span>
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

            {/* 移动端全屏搜索浮层（≥640px 不使用，入口按钮为 sm:hidden） */}
            <SearchOverlay
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
                initialValue={searchValue}
            />
        </>
    );
}
