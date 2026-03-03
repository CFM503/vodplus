'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { RESOURCE_SITES } from '@/lib/resources';
import { useSettings } from '@/hooks/useSettings';
import { X, Check, Search, Settings2, Trash2, Film, Tv, Link as LinkIcon, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { mounted, settings, setters, saveSettings } = useSettings(isOpen);
    const { disabledSources, movieSource, tvSource, customLocalUrl } = settings;
    const { setDisabledSources, setMovieSource, setTvSource, setCustomLocalUrl, toggleSource } = setters;

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'rec' | 'sources'>('rec');

    const router = useRouter();

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleSave = () => {
        if (saveSettings()) {
            onClose();
            // Soft refresh to apply changes without resetting client state (like player)
            router.refresh();
        } else {
            alert('保存设置失败，请检查浏览器 Cookie 权限');
        }
    };

    const filteredSources = RESOURCE_SITES.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col h-[85dvh] overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <Settings2 className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">设置</h2>
                            <p className="text-xs text-slate-500 mt-0.5">个性化您的观影体验</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex border-b border-white/5 bg-slate-900/50 shrink-0">
                    <button onClick={() => setActiveTab('rec')} className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'rec' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        推荐源
                        {activeTab === 'rec' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
                    </button>
                    <button onClick={() => setActiveTab('sources')} className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'sources' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        资源站管理
                        {activeTab === 'sources' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'rec' && (
                        <div className="p-6 space-y-8">
                            {(movieSource === 'local' || tvSource === 'local') && !customLocalUrl && (
                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>您选择了本地源，但未填写自定义接口。系统将默认使用内置聚合源。</span>
                                </div>
                            )}

                            {/* Movie Source */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-white font-medium">
                                    <Film className="w-4 h-4 text-indigo-400" />
                                    电影推荐源
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <select
                                                value={movieSource === 'local' ? 'local_placeholder' : movieSource}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val !== 'local_placeholder') setMovieSource(val);
                                                }}
                                                className={`w-full p-3 rounded-xl border appearance-none text-left transition-all outline-none [&>option]:bg-slate-900 [&>option]:text-white ${movieSource !== 'local'
                                                    ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/50 text-white'
                                                    : 'bg-slate-800/20 border-white/5 text-slate-500'
                                                    }`}
                                            >
                                                {movieSource === 'local' && (
                                                    <option value="local_placeholder" disabled>选择默认源...</option>
                                                )}
                                                <option value="tmdb">TMDB</option>
                                            </select>
                                        </div>
                                        <button onClick={() => setMovieSource('local')} className={`p-3 rounded-xl border transition-all text-left ${movieSource === 'local' ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/50' : 'bg-slate-800/20 border-white/5 hover:bg-slate-800/40'}`}>
                                            <div className="text-sm font-bold text-white">资源站 (Native)</div>
                                            <div className="text-[10px] text-slate-400 mt-1">直接读取采集源，无视API限制</div>
                                        </button>
                                    </div>
                                    {movieSource === 'local' && (
                                        <div className="pl-1 animate-in slide-in-from-top-2">
                                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1.5 flex items-center gap-1">
                                                <LinkIcon className="w-3 h-3" /> 自定义源 API 链接 (可选)
                                            </label>
                                            <input type="text" value={customLocalUrl} onChange={(e) => setCustomLocalUrl(e.target.value)} placeholder="https://cj.ffzyapi.com/api.php/provide/vod/" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* TV Source */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-white font-medium">
                                    <Tv className="w-4 h-4 text-emerald-400" />
                                    剧集推荐源
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <select
                                                value={tvSource === 'local' ? 'local_placeholder' : tvSource}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val !== 'local_placeholder') setTvSource(val);
                                                }}
                                                className={`w-full p-3 rounded-xl border appearance-none text-left transition-all outline-none [&>option]:bg-slate-900 [&>option]:text-white ${tvSource !== 'local'
                                                    ? 'bg-emerald-600/10 border-emerald-500/50 ring-1 ring-emerald-500/50 text-white'
                                                    : 'bg-slate-800/20 border-white/5 text-slate-500'
                                                    }`}
                                            >
                                                {tvSource === 'local' && (
                                                    <option value="local_placeholder" disabled>选择默认源...</option>
                                                )}
                                                <option value="tmdb">TMDB</option>
                                            </select>
                                        </div>
                                        <button onClick={() => setTvSource('local')} className={`p-3 rounded-xl border transition-all text-left ${tvSource === 'local' ? 'bg-emerald-600/10 border-emerald-500/50 ring-1 ring-emerald-500/50' : 'bg-slate-800/20 border-white/5 hover:bg-slate-800/40'}`}>
                                            <div className="text-sm font-bold text-white">资源站 (Native)</div>
                                            <div className="text-[10px] text-slate-400 mt-1">同步全网更新</div>
                                        </button>
                                    </div>
                                    {tvSource === 'local' && movieSource !== 'local' && (
                                        <div className="pl-1 animate-in slide-in-from-top-2">
                                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1.5 flex items-center gap-1">
                                                <LinkIcon className="w-3 h-3" /> 自定义源 API 链接 (可选)
                                            </label>
                                            <input type="text" value={customLocalUrl} onChange={(e) => setCustomLocalUrl(e.target.value)} placeholder="https://cj.ffzyapi.com/api.php/provide/vod/" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sources' && (
                        <div className="flex flex-col h-full">
                            <div className="p-4 bg-slate-900/50 space-y-4 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                    <input type="text" placeholder="搜索资源站..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600" />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <button onClick={() => setDisabledSources([])} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
                                        <Check className="h-3.5 w-3.5" /> 开启全部
                                    </button>
                                    <button onClick={() => setDisabledSources(RESOURCE_SITES.map(s => s.id))} className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                        <Trash2 className="h-3.5 w-3.5" /> 全不选
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                                <div className="grid gap-1">
                                    {filteredSources.map((source) => {
                                        const isDisabled = disabledSources.includes(source.id);
                                        return (
                                            <button key={source.id} onClick={() => toggleSource(source.id)} className={`flex items-center justify-between p-4 rounded-xl transition-all group ${isDisabled ? 'bg-slate-950/30 opacity-60 hover:opacity-100' : 'hover:bg-white/5 bg-slate-800/20'}`}>
                                                <div className="flex items-center gap-3 text-left">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${isDisabled ? 'bg-slate-800 text-slate-500' : 'bg-indigo-500/10 text-indigo-400'}`}>{source.name.charAt(0)}</div>
                                                    <div>
                                                        <div className="font-bold text-sm text-white">{source.name}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{source.id}</div>
                                                    </div>
                                                </div>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${isDisabled ? 'border-white/5 bg-transparent' : 'border-indigo-500 bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}>
                                                    <Check className={`h-3.5 w-3.5 text-white transition-opacity ${isDisabled ? 'opacity-0' : 'opacity-100'}`} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/5 bg-slate-900/80 shrink-0">
                    <button onClick={handleSave} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]">
                        保存设置并应用
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
