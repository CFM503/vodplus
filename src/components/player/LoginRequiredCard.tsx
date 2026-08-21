'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, LogIn, Sparkles } from 'lucide-react';

interface LoginRequiredCardProps {
    poster?: string;
    movieName?: string;
}

export default function LoginRequiredCard({ poster, movieName }: LoginRequiredCardProps) {
    const [redirectUrl, setRedirectUrl] = useState('/login');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname + window.location.search;
            setRedirectUrl(`/login?redirect=${encodeURIComponent(currentPath)}`);
        }
    }, []);

    return (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-slate-950 border border-indigo-500/20 flex items-center justify-center select-none group">
            {/* Background Poster with heavy blur */}
            {poster && (
                <div
                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-20 scale-110 transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundImage: `url(${poster})` }}
                />
            )}

            {/* Dark glass overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/60" />

            {/* Ambient decorative glow */}
            <div className="absolute w-72 h-72 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center text-center px-6 py-8 max-w-md animate-in fade-in zoom-in-95 duration-300">
                {/* Glowing Lock Icon */}
                <div className="relative mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.25)] text-indigo-400">
                        <Lock className="w-8 h-8 animate-pulse" />
                    </div>
                    <div className="absolute -top-1 -right-1 bg-amber-500/20 border border-amber-500/40 rounded-full p-1 text-amber-300">
                        <Sparkles className="w-3 h-3" />
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
                    登录后即可观看
                </h3>

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
                    {movieName ? (
                        <>
                            观看《<span className="text-indigo-300 font-medium">{movieName}</span>》需要验证身份。
                        </>
                    ) : (
                        '该站点已启用访问控制。'
                    )}
                    <br className="hidden sm:inline" />
                    请使用管理员设置的账号密码登录后继续播放。
                </p>

                {/* Login Button */}
                <Link
                    href={redirectUrl}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 border border-indigo-400/40 transition-all cursor-pointer"
                >
                    <LogIn className="w-4 h-4" />
                    <span>立即登录</span>
                </Link>
            </div>
        </div>
    );
}
