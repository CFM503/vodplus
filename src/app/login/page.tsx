'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MonitorPlay, Lock, User, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect') || '/';

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authStatus, setAuthStatus] = useState<{ enabled: boolean; authenticated: boolean; username?: string } | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);

    useEffect(() => {
        let isMounted = true;
        fetch('/api/auth/status')
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.code === 1) {
                    setAuthStatus(data.data);
                    if (data.data.authenticated && data.data.enabled) {
                        setTimeout(() => {
                            router.replace(redirectUrl);
                        }, 1200);
                    }
                }
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) setCheckingStatus(false);
            });

        return () => {
            isMounted = false;
        };
    }, [router, redirectUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError('请输入用户名和密码');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (data.code === 1) {
                // Login successful, navigate to redirectUrl
                router.replace(redirectUrl);
                router.refresh();
            } else {
                setError(data.msg || '用户名或密码错误');
            }
        } catch {
            setError('网络请求失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    if (checkingStatus) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                <p className="text-sm text-slate-400">正在检查登录状态...</p>
            </div>
        );
    }

    if (authStatus?.enabled && authStatus.authenticated) {
        return (
            <div className="w-full max-w-md p-8 bg-slate-900/60 backdrop-blur-xl border border-indigo-500/20 rounded-2xl shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white">您已登录</h2>
                <p className="text-sm text-slate-400">
                    当前账号：<span className="text-indigo-300 font-semibold">{authStatus.username || '已认证'}</span>
                </p>
                <p className="text-xs text-slate-500">正在为您跳转回页面...</p>
                <div className="pt-2">
                    <Link
                        href={redirectUrl}
                        className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                    >
                        立即前往
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md p-6 sm:p-8 bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            {/* Header / Logo */}
            <div className="text-center space-y-2">
                <Link href="/" className="inline-flex items-center space-x-2 group">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 border border-indigo-500/20 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                        <MonitorPlay className="h-7 w-7 text-indigo-400" />
                    </div>
                </Link>
                <h1 className="text-2xl font-bold text-white tracking-tight">登录账号</h1>
                <p className="text-xs text-slate-400">
                    请输入管理员设置的账号密码以解锁观看权限
                </p>
            </div>

            {/* Warning if auth is not enabled on server */}
            {authStatus && !authStatus.enabled && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                        当前环境未配置鉴权变量（<code className="font-mono bg-black/30 px-1 rounded">AUTH_USERNAME</code>），全站视频可直接免登录观看。
                    </div>
                </div>
            )}

            {/* Error Message Alert */}
            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2 animate-in shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username Input */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        用户名
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="请输入用户名"
                            autoComplete="username"
                            autoFocus
                            disabled={loading}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-indigo-400" />
                        密码
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            autoComplete="current-password"
                            disabled={loading}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                            title={showPassword ? '隐藏密码' : '显示密码'}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/25 border border-indigo-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>正在验证...</span>
                        </>
                    ) : (
                        <span>登 录</span>
                    )}
                </button>
            </form>

            {/* Footer actions */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 hover:text-slate-300 transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    返回首页
                </Link>
                <span>VODplus 极速影院</span>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
            {/* Ambient background decoration */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

            <Suspense
                fallback={
                    <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                        <p className="text-sm text-slate-400">正在加载页面...</p>
                    </div>
                }
            >
                <LoginForm />
            </Suspense>
        </div>
    );
}
