'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { RESOURCE_SITES, type ResourceSite } from '@/lib/resources';
import { useSettings } from '@/hooks/useSettings';
import { mergeSources, buildExportPayload, validateImportPayload } from '@/lib/sourceConfig';
import { X, Check, Search, Settings2, Trash2, Film, Tv, Link as LinkIcon, AlertCircle, Download, Upload, Plus, Pencil } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { mounted, settings, setters, saveSettings } = useSettings(isOpen);
    const { disabledSources, movieSource, tvSource, customLocalUrl, customSources } = settings;
    const { setDisabledSources, setMovieSource, setTvSource, setCustomLocalUrl, toggleSource, addCustomSource, updateCustomSource, removeCustomSource, importSources } = setters;

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'rec' | 'sources'>('rec');

    // v0.9.31: 自定义源表单 + 导入导出
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSource, setNewSource] = useState({ id: '', name: '', baseUrl: '', region: '' });
    const [formError, setFormError] = useState<string | null>(null);
    // v0.9.x: 自定义源修改表单
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', baseUrl: '', region: '' });
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState<string | null>(null);
    const [importOk, setImportOk] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // v0.9.31: 合并 内置源 + 自定义源 用于列表展示
    const mergedSources = useMemo(() => mergeSources(customSources), [customSources]);
    const builtInIds = useMemo(() => new Set(RESOURCE_SITES.map(s => s.id)), []);

    const filteredSources = useMemo(() => {
        if (!searchTerm) return mergedSources;
        const lower = searchTerm.toLowerCase();
        return mergedSources.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            s.id.toLowerCase().includes(lower)
        );
    }, [searchTerm, mergedSources]);

    // ===== 导出 =====
    const handleExport = () => {
        const payload = buildExportPayload(disabledSources, customSources);
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vodplus-sources-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ===== 导入 =====
    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setImportText(String(reader.result || ''));
            setImportError(null);
            setImportOk(false);
            setShowImport(true);
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmImport = () => {
        const result = validateImportPayload(importText);
        if (!result.ok) {
            setImportError(result.error);
            setImportOk(false);
            return;
        }
        importSources(result.customSources, result.disabledSources);
        setImportError(null);
        setImportOk(true);
        setImportText('');
        setShowImport(false);
    };

    // ===== 添加自定义源 =====
    const handleAddCustomSource = () => {
        const id = newSource.id.trim();
        const name = newSource.name.trim();
        const baseUrl = newSource.baseUrl.trim();

        if (!id || !name || !baseUrl) {
            setFormError('源ID、名称、接口地址均为必填');
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            setFormError('源ID只能包含英文、数字、下划线或中划线');
            return;
        }
        if (builtInIds.has(id) || customSources.some(s => s.id === id)) {
            setFormError(`源ID「${id}」已存在`);
            return;
        }
        if (!/^https?:\/\//.test(baseUrl)) {
            setFormError('接口地址必须以 http:// 或 https:// 开头');
            return;
        }

        const ok = addCustomSource({
            id,
            name,
            baseUrl,
            searchPath: '?ac=detail&wd=',
            detailPath: '?ac=detail&ids=',
            headers: {},
            region: newSource.region.trim() || undefined,
        });
        if (!ok) {
            setFormError('添加失败: 源ID冲突');
            return;
        }
        setFormError(null);
        setNewSource({ id: '', name: '', baseUrl: '', region: '' });
        setShowAddForm(false);
    };

    // ===== 修改自定义源 =====
    const handleEditCustomSource = (source: ResourceSite) => {
        setShowAddForm(false);
        setFormError(null);
        setEditingSourceId(source.id);
        setEditForm({
            name: source.name,
            baseUrl: source.baseUrl,
            region: source.region || '',
        });
    };

    const handleSaveEdit = () => {
        const name = editForm.name.trim();
        const baseUrl = editForm.baseUrl.trim();

        if (!name || !baseUrl) {
            setFormError('名称和接口地址均为必填');
            return;
        }
        if (!/^https?:\/\//.test(baseUrl)) {
            setFormError('接口地址必须以 http:// 或 https:// 开头');
            return;
        }

        if (!editingSourceId) {
            setFormError('修改失败：未找到该自定义源');
            return;
        }

        const ok = updateCustomSource(editingSourceId, {
            name,
            baseUrl,
            region: editForm.region.trim() || undefined,
        });
        if (!ok) {
            setFormError('修改失败：未找到该自定义源');
            return;
        }
        setFormError(null);
        setEditingSourceId(null);
        setEditForm({ name: '', baseUrl: '', region: '' });
    };

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
                            <div className="p-4 bg-slate-900/50 space-y-3 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                    <input type="text" placeholder="搜索资源站..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600" />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => setDisabledSources([])} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
                                            <Check className="h-3.5 w-3.5" /> 开启全部
                                        </button>
                                        <button onClick={() => setDisabledSources(mergedSources.map(s => s.id))} className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                            <Trash2 className="h-3.5 w-3.5" /> 全不选
                                        </button>
                                    </div>
                                    {/* v0.9.31: 导出 / 导入 */}
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={handleExport} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors" title="导出当前源列表为 JSON">
                                            <Download className="h-3.5 w-3.5" /> 导出
                                        </button>
                                        <button onClick={() => { setShowImport(true); setImportError(null); setImportOk(false); }} className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors" title="从 JSON 文件/文本导入源列表">
                                            <Upload className="h-3.5 w-3.5" /> 导入
                                        </button>
                                    </div>
                                </div>

                                {/* 添加自定义源 */}
                                {showAddForm && (
                                    <div className="bg-slate-950/40 border border-indigo-500/20 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-2">
                                        <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                            <Plus className="h-3.5 w-3.5" /> 添加自定义源
                                        </div>
                                        <input value={newSource.id} onChange={(e) => setNewSource(s => ({ ...s, id: e.target.value }))} placeholder="源ID (英文, 如 myzy)" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" />
                                        <input value={newSource.name} onChange={(e) => setNewSource(s => ({ ...s, name: e.target.value }))} placeholder="名称 (如 我的资源)" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" />
                                        <input value={newSource.baseUrl} onChange={(e) => setNewSource(s => ({ ...s, baseUrl: e.target.value }))} placeholder="接口地址 https://xxx/api.php/provide/vod/" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600 font-mono" />
                                        <input value={newSource.region} onChange={(e) => setNewSource(s => ({ ...s, region: e.target.value }))} placeholder="节点 (可选, 如 HKG / CN)" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" />
                                        {formError && <div className="text-[11px] text-red-400">{formError}</div>}
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={handleAddCustomSource} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all active:scale-[0.98]">添加</button>
                                            <button onClick={() => { setShowAddForm(false); setFormError(null); }} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all">取消</button>
                                        </div>
                                    </div>
                                )}

                                {/* 修改自定义源 */}
                                {editingSourceId && (
                                    <div className="bg-slate-950/40 border border-amber-500/20 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-2">
                                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                            <Pencil className="h-3.5 w-3.5" /> 修改自定义源
                                        </div>
                                        <input value={editForm.name} onChange={(e) => setEditForm(s => ({ ...s, name: e.target.value }))} placeholder="名称 (如 我的资源)" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600" />
                                        <input value={editForm.baseUrl} onChange={(e) => setEditForm(s => ({ ...s, baseUrl: e.target.value }))} placeholder="接口地址 https://xxx/api.php/provide/vod/" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600 font-mono" />
                                        <input value={editForm.region} onChange={(e) => setEditForm(s => ({ ...s, region: e.target.value }))} placeholder="节点 (可选, 如 HKG / CN)" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600" />
                                        {formError && <div className="text-[11px] text-red-400">{formError}</div>}
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={handleSaveEdit} className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all active:scale-[0.98]">保存</button>
                                            <button onClick={() => { setEditingSourceId(null); setEditForm({ name: '', baseUrl: '', region: '' }); setFormError(null); }} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all">取消</button>
                                        </div>
                                    </div>
                                )}

                                {/* 导入面板 */}
                                {showImport && (
                                    <div className="bg-slate-950/40 border border-amber-500/20 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-2">
                                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                            <Upload className="h-3.5 w-3.5" /> 导入源列表
                                        </div>
                                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all">
                                            选择 JSON 文件
                                        </button>
                                        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
                                        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="或直接粘贴导出的 JSON 内容..." rows={4} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600 resize-none" />
                                        {importError && <div className="text-[11px] text-red-400">{importError}</div>}
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={handleConfirmImport} className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all active:scale-[0.98]">确认导入</button>
                                            <button onClick={() => { setShowImport(false); setImportError(null); setImportText(''); }} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all">取消</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                                <div className="grid gap-1">
                                    {filteredSources.map((source) => {
                                        const isDisabled = disabledSources.includes(source.id);
                                        const isCustom = !builtInIds.has(source.id);
                                        return (
                                            <div key={source.id} className={`flex items-center justify-between p-4 rounded-xl transition-all group ${isDisabled ? 'bg-slate-950/30 opacity-60 hover:opacity-100' : 'hover:bg-white/5 bg-slate-800/20'}`}>
                                                <button onClick={() => toggleSource(source.id)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${isDisabled ? 'bg-slate-800 text-slate-500' : 'bg-indigo-500/10 text-indigo-400'}`}>{source.name.charAt(0)}</div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold text-sm text-white truncate">{source.name}</div>
                                                            {isCustom && (
                                                                <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold whitespace-nowrap">自定义</span>
                                                            )}
                                                            {source.region && (
                                                                <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700/40 text-slate-400 font-mono whitespace-nowrap">({source.region})</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{source.baseUrl}</div>
                                                    </div>
                                                </button>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isCustom && (
                                                        <>
                                                            <button onClick={() => handleEditCustomSource(source)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="修改自定义源">
                                                                <Pencil className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => removeCustomSource(source.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="删除自定义源">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button onClick={() => toggleSource(source.id)} className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${isDisabled ? 'border-white/5 bg-transparent' : 'border-indigo-500 bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}>
                                                        <Check className={`h-3.5 w-3.5 text-white transition-opacity ${isDisabled ? 'opacity-0' : 'opacity-100'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredSources.length === 0 && (
                                        <div className="p-6 text-center text-slate-500 text-sm">没有匹配的资源站</div>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 border-t border-white/5 bg-slate-900/50 shrink-0">
                                <button onClick={() => { setShowAddForm(v => !v); setEditingSourceId(null); setEditForm({ name: '', baseUrl: '', region: '' }); }} className={`w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${showAddForm ? 'bg-slate-800 text-slate-300' : 'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/20'}`}>
                                    <Plus className="h-3.5 w-3.5" /> {showAddForm ? '收起' : '添加自定义源'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/5 bg-slate-900/80 shrink-0">
                    {importOk && (
                        <div className="mb-3 text-xs text-emerald-400 flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5" /> 导入成功，点击下方保存后生效
                        </div>
                    )}
                    <button onClick={handleSave} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]">
                        保存设置并应用
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
