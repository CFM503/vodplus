'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, History, Trash2 } from 'lucide-react';

const HISTORY_KEY = 'VOD_SEARCH_HISTORY';
const MAX_HISTORY = 8;

/** 读取搜索历史（容错：损坏数据/隐私模式一律返回空数组） */
function readHistory(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(HISTORY_KEY);
        if (!raw) return [];
        const arr: unknown = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map(s => s.trim())
            .slice(0, MAX_HISTORY);
    } catch {
        return [];
    }
}

function writeHistory(list: string[]) {
    try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
    } catch {
        // localStorage 不可用（隐私模式/配额满）时静默降级：本次搜索仍正常
    }
}

interface SearchOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    /** 进入浮层时预填的关键词（在 /search 页打开时回填当前搜索词） */
    initialValue?: string;
}

/**
 * 移动端全屏搜索浮层（<640px 使用）
 *
 * 为什么要独立浮层：64px 高的 Header 一行里挤了 logo + 片库 + 登录 + 设置，
 * 内联搜索框可用宽度只有 60~110px（约 4~7 个汉字），无法正常输入。
 * 浮层让输入框独占整行，且天然承载搜索历史——影片名普遍较长，历史复用价值高。
 */
export default function SearchOverlay({ isOpen, onClose, initialValue }: SearchOverlayProps) {
    const router = useRouter();
    const [value, setValue] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // 用 ref 保存回调，避免父组件每次渲染重建闭包导致 effect 反复执行、正在输入的内容被重置
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const initialRef = useRef(initialValue);
    initialRef.current = initialValue;

    useEffect(() => {
        if (!isOpen) return;

        setHistory(readHistory());
        setValue(initialRef.current ?? '');

        // 等浮层完成首帧渲染后再聚焦，确保移动端弹出键盘
        const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 60);

        // 锁定背景滚动
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCloseRef.current();
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.clearTimeout(focusTimer);
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen]);

    /** 提交搜索：写历史 → 关闭浮层 → 路由跳转 */
    const commit = useCallback((raw: string) => {
        const keyword = raw.trim();
        if (!keyword) return;

        const next = [keyword, ...history.filter(h => h !== keyword)].slice(0, MAX_HISTORY);
        writeHistory(next);
        setHistory(next);

        onClose();
        router.push(`/search?q=${encodeURIComponent(keyword)}`);
    }, [history, onClose, router]);

    const removeItem = useCallback((raw: string) => {
        const keyword = raw.trim();
        const next = history.filter(h => h !== keyword);
        writeHistory(next);
        setHistory(next);
        inputRef.current?.focus();
    }, [history]);

    const clearHistory = useCallback(() => {
        writeHistory([]);
        setHistory([]);
        inputRef.current?.focus();
    }, []);

    if (!isOpen) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="全屏搜索"
            className="fixed inset-0 z-[100] flex flex-col bg-slate-950"
        >
            {/* 输入区 —— input 高 48px，独立一行占满屏宽 */}
            <div className="flex items-center gap-1.5 px-3 pt-3 pb-3 border-b border-white/5 shrink-0">
                <form
                    onSubmit={(e) => { e.preventDefault(); commit(value); }}
                    className="flex-1 min-w-0 flex items-center gap-2"
                >
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                        {/* text-base(16px) 避免 iOS 聚焦时自动放大页面 */}
                        <input
                            ref={inputRef}
                            type="search"
                            name="q"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoComplete="off"
                            enterKeyHint="search"
                            inputMode="search"
                            aria-label="搜索全网资源"
                            placeholder="搜索全网资源..."
                            className="w-full h-12 rounded-xl bg-slate-900/70 border border-slate-700 pl-11 pr-11 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                        />
                        {value && (
                            <button
                                type="button"
                                onClick={() => { setValue(''); inputRef.current?.focus(); }}
                                aria-label="清空输入"
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-300 active:bg-white/10 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="shrink-0 h-12 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold active:scale-95 transition-all"
                    >
                        搜索
                    </button>
                </form>
                <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 h-12 px-2 text-sm font-medium text-slate-400 hover:text-white transition-colors active:scale-95"
                >
                    取消
                </button>
            </div>

            {/* 搜索历史 */}
            {history.length > 0 ? (
                <div
                    className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
                    style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
                >
                    <div className="flex items-center justify-between px-1 mb-1">
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5" />
                            最近搜索
                        </span>
                        <button
                            type="button"
                            onClick={clearHistory}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 py-2 -my-2 px-1 transition-colors cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            清空
                        </button>
                    </div>
                    <ul>
                        {history.map(keyword => (
                            <li
                                key={keyword}
                                className="flex items-center border-b border-white/5 last:border-b-0"
                            >
                                <button
                                    type="button"
                                    onClick={() => commit(keyword)}
                                    className="flex-1 min-w-0 text-left py-3.5 pr-2 text-[15px] text-slate-300 active:text-white hover:text-white transition-colors truncate cursor-pointer"
                                >
                                    {keyword}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeItem(keyword)}
                                    aria-label={`删除搜索记录 ${keyword}`}
                                    className="shrink-0 w-11 h-11 flex items-center justify-center text-slate-600 hover:text-red-400 active:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div
                    className="flex-1 flex flex-col items-center justify-center gap-4 px-10 text-center"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                    <Search className="w-10 h-10 text-slate-700" />
                    <p className="text-sm leading-relaxed text-slate-600">
                        输入片名开始搜索
                        <br />
                        搜过的关键词会自动记在这里，下次一点即达
                    </p>
                </div>
            )}
        </div>
    );
}
