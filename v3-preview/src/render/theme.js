/**
 * theme.js — 主题 / 模式 管理
 * 实现 13 色主题 + 夜间 + 护眼（可组合）
 *
 * 色主题列表（仅影响 primary 家族 & 主按钮渐变）：
 *   default | red | orange | yellow | green | cyan | blue | purple | red-blue | blue-green | rainbow
 *
 * 模式列表：
 *   normal | night（夜间深色） | eye（护眼米黄纸色）
 *
 * 持久化：localStorage 键 lx_theme / lx_mode
 * 生效方式：给 <html> 设置 data-theme / data-mode 属性，由 theme.css 覆写 CSS 变量
 * @module render/theme
 */

const K_THEME = 'lx_theme';
const K_MODE  = 'lx_mode';

export const THEMES = [
    { id: 'default',   name: '默认（紫）', color: '#4f46e5' },
    { id: 'red',       name: '红',         color: '#dc2626' },
    { id: 'orange',    name: '橙',         color: '#ea580c' },
    { id: 'yellow',    name: '黄',         color: '#ca8a04' },
    { id: 'green',     name: '绿',         color: '#16a34a' },
    { id: 'cyan',      name: '青',         color: '#0891b2' },
    { id: 'blue',      name: '蓝',         color: '#2563eb' },
    { id: 'purple',    name: '紫',         color: '#7c3aed' },
    { id: 'red-blue',  name: '红蓝渐变',   gradient: true, colors: ['#dc2626', '#2563eb'] },
    { id: 'blue-green',name: '蓝绿渐变',   gradient: true, colors: ['#2563eb', '#10b981'] },
    { id: 'rainbow',   name: '彩虹色',     gradient: true, colors: ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed'] },
];

export const MODES = [
    { id: 'normal', name: '普通模式', hint: '浅色白底' },
    { id: 'night',  name: '夜间模式', hint: '深色护眼' },
    { id: 'eye',    name: '护眼模式', hint: '米黄纸色' },
];

/** 应用主题（持久化 + <html> attribute） */
export function setTheme(themeId) {
    const ok = THEMES.some(t => t.id === themeId);
    if (!ok) return false;
    try { localStorage.setItem(K_THEME, themeId); } catch (e) {}
    applyThemeToDoc();
    return true;
}

/** 应用模式（持久化 + <html> attribute） */
export function setMode(modeId) {
    const ok = MODES.some(m => m.id === modeId);
    if (!ok) return false;
    try { localStorage.setItem(K_MODE, modeId); } catch (e) {}
    applyModeToDoc();
    return true;
}

/** 获取当前主题 id（默认 default） */
export function getTheme() {
    try {
        const v = localStorage.getItem(K_THEME);
        if (v && THEMES.some(t => t.id === v)) return v;
    } catch (e) {}
    return 'default';
}

/** 获取当前模式 id（默认 normal） */
export function getMode() {
    try {
        const v = localStorage.getItem(K_MODE);
        if (v && MODES.some(m => m.id === v)) return v;
    } catch (e) {}
    return 'normal';
}

function applyThemeToDoc() {
    const th = getTheme();
    const html = document.documentElement;
    if (th === 'default') {
        html.removeAttribute('data-theme');
    } else {
        html.setAttribute('data-theme', th);
    }
}

function applyModeToDoc() {
    const md = getMode();
    const html = document.documentElement;
    if (md === 'normal') {
        html.removeAttribute('data-mode');
    } else {
        html.setAttribute('data-mode', md);
    }
}

/** 启动时应用一次（必须在 main-ui 初始化前调用） */
export function applyInitial() {
    applyThemeToDoc();
    applyModeToDoc();
}

/**
 * 生成主题调色盘按钮上的色块（供 UI 展示）
 * 返回 CSS background 字符串
 */
export function swatchStyle(theme) {
    if (theme.gradient) {
        return `background: linear-gradient(90deg, ${theme.colors.join(', ')});`;
    }
    return `background: ${theme.color};`;
}
