/**
 * settings.js — 设置/导入导出页
 * @module render/pages/settings
 */

import { h, render } from '../dom.js';
import { toastSuccess, toastWarning, toastInfo } from '../toast.js';
import { THEMES, MODES, getTheme, getMode, setTheme, setMode, swatchStyle } from '../theme.js';

/**
 * 把 "background: red; border: 1px solid #000;" 这种内联字符串
 * 转成 { background: 'red', border: '1px solid #000' } 对象（供 dom.js style 传入）
 */
function parseStyle(cssText) {
    const out = {};
    if (!cssText) return out;
    cssText.split(';').forEach((seg) => {
        const idx = seg.indexOf(':');
        if (idx < 0) return;
        const k = seg.slice(0, idx).trim();
        const v = seg.slice(idx + 1).trim();
        if (k && v) out[k] = v;
    });
    return out;
}

export function createSettingsPage() {
    let _container = null;
    let _fileInput = null;
    let _progressInput = null;

    function renderPage(container) {
        _container = container;
        refresh();
    }

    function refresh() {
        if (!_container) return;
        const LX = window.LX;

        const libsR = LX.LibraryAPI.list();
        const libs = libsR.ok ? libsR.data : [];
        const currentId = LX.LibraryAPI.current().data;
        const current = currentId ? LX.LibraryAPI.get(currentId).data : null;
        const summary = current ? LX.StatsAPI.summary().data : { total: 0, mastered: 0, review: 0, percent: 0 };

        const elements = [];

        // 隐藏的 file input
        _fileInput = h('input', {
            type: 'file',
            accept: '.xlsx,.xls,.json,.csv,.txt',
            style: { display: 'none' },
            onchange: (e) => handleImportFile(e.target.files[0]),
        });
        _progressInput = h('input', {
            type: 'file',
            accept: '.json',
            style: { display: 'none' },
            onchange: (e) => handleImportProgress(e.target.files[0]),
        });

        // 题库管理
        elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
            h('div', { class: 'lx-text-base lx-font-semibold', style: { marginBottom: '12px' } }, ['📚 题库管理']),
            h('div', { class: 'lx-list' }, libs.length === 0 ? [
                h('div', { class: 'lx-list__item lx-text-light' }, ['还没有题库']),
            ] : libs.map((lib) => h('div', { class: 'lx-list__item' }, [
                h('div', { style: { flex: 1 } }, [
                    h('div', { class: 'lx-font-medium' }, [lib.name]),
                    h('div', { class: 'lx-text-xs lx-text-muted' }, [`${lib.questionCount || 0} 题 · ${lib.createdAt || ''}`]),
                ]),
                h('div', { class: 'lx-flex lx-gap-2' }, [
                    lib.id !== currentId && h('button', {
                        class: 'lx-button--text',
                        onclick: () => {
                            LX.LibraryAPI.switch(lib.id);
                            toastInfo(`已切换到「${lib.name}」`);
                            refresh();
                        },
                    }, ['切换']),
                    h('button', {
                        class: 'lx-button--text',
                        style: { color: 'var(--lx-danger)' },
                        onclick: () => handleDeleteLibrary(lib),
                    }, ['删除']),
                ]),
            ]))),
            h('button', {
                class: 'lx-button lx-button--primary lx-button--block',
                style: { marginTop: '12px' },
                onclick: () => _fileInput.click(),
            }, ['＋ 上传新题库']),
        ]));

        // 学习进度
        if (current) {
            elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
                h('div', { class: 'lx-text-base lx-font-semibold', style: { marginBottom: '12px' } }, ['📊 学习进度']),
                h('div', { class: 'lx-stat-grid', style: { marginBottom: '12px' } }, [
                    h('div', { class: 'lx-stat-card' }, [
                        h('div', { class: 'lx-stat-card__value' }, [String(summary.total)]),
                        h('div', { class: 'lx-stat-card__label' }, ['总数']),
                    ]),
                    h('div', { class: 'lx-stat-card lx-stat-card--success' }, [
                        h('div', { class: 'lx-stat-card__value' }, [String(summary.mastered)]),
                        h('div', { class: 'lx-stat-card__label' }, ['已掌握']),
                    ]),
                    h('div', { class: 'lx-stat-card lx-stat-card--warning' }, [
                        h('div', { class: 'lx-stat-card__value' }, [String(summary.review)]),
                        h('div', { class: 'lx-stat-card__label' }, ['错题']),
                    ]),
                    h('div', { class: 'lx-stat-card lx-stat-card--primary' }, [
                        h('div', { class: 'lx-stat-card__value' }, [`${summary.percent || 0}%`]),
                        h('div', { class: 'lx-stat-card__label' }, ['掌握率']),
                    ]),
                ]),
                h('div', { class: 'lx-flex lx-gap-2' }, [
                    h('button', {
                        class: 'lx-button lx-button--secondary lx-button--block',
                        onclick: () => handleExportProgress(),
                    }, ['💾 备份进度']),
                    h('button', {
                        class: 'lx-button lx-button--secondary lx-button--block',
                        onclick: () => _progressInput.click(),
                    }, ['📂 恢复进度']),
                ]),
                h('button', {
                    class: 'lx-button lx-button--ghost lx-button--block',
                    style: { marginTop: '8px', color: 'var(--lx-danger)' },
                    onclick: () => handleResetProgress(),
                }, ['🗑️ 重置当前题库进度']),
            ]));
        }

        // 导出
        if (current) {
            elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
                h('div', { class: 'lx-text-base lx-font-semibold', style: { marginBottom: '12px' } }, ['📥 导出']),
                h('div', { class: 'lx-flex lx-gap-2' }, [
                    h('button', {
                        class: 'lx-button lx-button--secondary lx-button--block',
                        onclick: () => handleExportLibrary('json'),
                    }, ['JSON']),
                    h('button', {
                        class: 'lx-button lx-button--secondary lx-button--block',
                        onclick: () => handleExportLibrary('xlsx'),
                    }, ['Excel']),
                    h('button', {
                        class: 'lx-button lx-button--secondary lx-button--block',
                        onclick: () => handleExportLibrary('csv'),
                    }, ['CSV']),
                ]),
                h('button', {
                    class: 'lx-button lx-button--ghost lx-button--block',
                    style: { marginTop: '8px' },
                    onclick: () => handleDownloadTemplate(),
                }, ['⬇ 下载导入模板']),
            ]));
        }

        // 主题 + 模式（可组合）
        const currentTheme = getTheme();
        const currentMode = getMode();
        elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
            h('div', { class: 'lx-text-base lx-font-semibold', style: { marginBottom: '12px' } }, ['🎨 主题色'], [
                h('div', { class: 'lx-text-xs lx-text-light', style: { marginLeft: '8px', fontWeight: 400 } }, ['（可与夜间/护眼模式组合）']),
            ]),
            h('div', { style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
                gap: '10px',
            } }, THEMES.map((th) => {
                const selected = th.id === currentTheme;
                return h('button', {
                    title: th.name,
                    onclick: () => {
                        setTheme(th.id);
                        toastInfo(`已切换主题：${th.name}`);
                        refresh();
                    },
                    style: {
                        position: 'relative',
                        aspectRatio: '1 / 1',
                        border: selected ? '3px solid var(--lx-primary)' : '1px solid var(--lx-border)',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        padding: 0,
                        overflow: 'hidden',
                        boxShadow: selected ? '0 0 0 3px var(--lx-primary-light)' : 'none',
                    },
                }, [
                    h('div', {
                        style: Object.assign({
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 600,
                        }, parseStyle(swatchStyle(th))),
                    }, [selected ? '✓' : '']),
                ]);
            })),
        ]));

        elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
            h('div', { class: 'lx-text-base lx-font-semibold', style: { marginBottom: '12px' } }, ['🌓 显示模式']),
            h('div', { class: 'lx-list' }, MODES.map((md) => {
                const selected = md.id === currentMode;
                return h('button', {
                    class: `lx-drawer__item${selected ? ' lx-drawer__item--active' : ''}`,
                    style: { borderRadius: '10px', marginBottom: '6px' },
                    onclick: () => {
                        setMode(md.id);
                        toastInfo(`已切换：${md.name}`);
                        refresh();
                    },
                }, [
                    h('span', { class: 'lx-font-medium' }, [md.name]),
                    h('span', { class: 'lx-drawer__item-meta' }, [md.hint]),
                ]);
            })),
        ]));

        // 关于
        elements.push(h('div', { class: 'lx-card' }, [
            h('div', { class: 'lx-text-base lx-font-semibold', style: { marginBottom: '8px' } }, ['ℹ️ 关于']),
            h('div', { class: 'lx-text-sm lx-text-muted' }, [
                `刷题器 v${LX.version}`,
            ]),
            h('div', { class: 'lx-text-xs lx-text-light', style: { marginTop: '8px' } }, [
                '本地存储 · 数据不上云 · 离线可用',
            ]),
        ]));

        render(_container, [_fileInput, _progressInput, ...elements]);
    }

    async function handleImportFile(file) {
        if (!file) return;
        const LX = window.LX;
        // 注意：File.name 是只读属性（现代浏览器严格执行：Cannot set property name of #<File> which has only a getter）
        // 这里绝对不能再给 file.name 赋值，否则直接抛异常
        const fileName = (file && file.name) ? file.name : 'upload.xlsx';
        try {
            const parseR = await LX.IOAPI.parseFile(file, { fileName });
            if (!parseR.ok) {
                toastWarning(`解析失败：${parseR.error?.message || '未知错误'}`);
                return;
            }
            const qs = parseR.data.questions;
            if (!qs || qs.length === 0) {
                toastWarning('文件解析后没有题目，请检查格式');
                return;
            }

            const name = fileName.replace(/\.(xlsx|xls|json|csv|txt)$/i, '');
            const impR = LX.IOAPI.importLibrary(name, qs);
            if (!impR.ok) {
                if (impR.error?.code === 'DUPLICATE') {
                    toastWarning(`题库已存在（重复内容）：${impR.error.message}`);
                    return;
                }
                toastWarning(`导入失败：${impR.error?.message || '未知错误'}`);
                return;
            }
            LX.LibraryAPI.switch(impR.data.id);
            toastSuccess(`成功导入 ${qs.length} 题`);
            refresh();
        } catch (e) {
            toastWarning(`导入异常：${e.message}`);
        }
    }

    function handleDeleteLibrary(lib) {
        if (!confirm(`确定删除题库「${lib.name}」吗？此操作不可撤销，进度也会被清除。`)) return;
        const LX = window.LX;
        const r = LX.LibraryAPI.delete(lib.id);
        if (r.ok) {
            toastSuccess('题库已删除');
            refresh();
        } else {
            toastWarning(`删除失败：${r.error?.message}`);
        }
    }

    function handleExportLibrary(format) {
        const LX = window.LX;
        const currentId = LX.LibraryAPI.current().data;
        const r = LX.IOAPI.exportLibrary(currentId, format);
        if (r.ok) {
            const blob = r.data.blob;
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: `library.${format}` });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toastSuccess(`已导出 ${format.toUpperCase()}`);
        } else {
            toastWarning(`导出失败：${r.error?.message}`);
        }
    }

    function handleExportProgress() {
        const LX = window.LX;
        const r = LX.IOAPI.exportProgress();
        if (r.ok) {
            const blob = r.data.blob;
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: `progress-backup-${Date.now()}.json` });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toastSuccess('进度已备份');
        } else {
            toastWarning(`备份失败：${r.error?.message}`);
        }
    }

    async function handleImportProgress(file) {
        if (!file) return;
        const LX = window.LX;
        try {
            const text = await file.text();
            const r = LX.IOAPI.importProgress(text);
            if (r.ok) {
                toastSuccess('进度已恢复');
                refresh();
            } else {
                toastWarning(`恢复失败：${r.error?.message}`);
            }
        } catch (e) {
            toastWarning(`恢复异常：${e.message}`);
        }
    }

    function handleResetProgress() {
        if (!confirm('确定要重置当前题库的所有学习进度吗？此操作不可撤销。')) return;
        const LX = window.LX;
        const r = LX.ProgressAPI.reset();
        if (r.ok) {
            toastSuccess('进度已重置');
            refresh();
        } else {
            toastWarning(`重置失败：${r.error?.message}`);
        }
    }

    function handleDownloadTemplate() {
        const LX = window.LX;
        const r = LX.IOAPI.downloadTemplate();
        if (r.ok) {
            const blob = r.data.blob;
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: 'lx-template.xlsx' });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toastSuccess('模板已下载');
        } else {
            toastWarning(`下载失败：${r.error?.message}`);
        }
    }

    return { render: renderPage, onLeave() {} };
}
