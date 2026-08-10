/**
 * drawer.js — 侧边抽屉
 * 来源：DESIGN.md 7.5
 * 包含：题库管理 / 筛选 / 导入导出 / 更多
 * @module render/drawer
 */

import { h, render, $ } from './dom.js';
import { escapeHtml } from '../utils.js';
import { createLogo } from './logo.js';

/** @type {null | ((state: { open: boolean, source?: string }) => void)} */
let _drawerSinkForTest = null;
/** @type {Array<{ open: boolean, source?: string }>} */
let _drawerLogForTest = [];

/**
 * 【仅测试用】抽屉开关旁路观测
 * @param {null | ((state: { open: boolean, source?: string }) => void)} sink
 */
export function __setDrawerSinkForTest(sink) {
    _drawerSinkForTest = typeof sink === 'function' ? sink : null;
}

/** 【仅测试用】 */
export function __getDrawerLogForTest() {
    return _drawerLogForTest.slice();
}

/** 【仅测试用】 */
export function __clearDrawerLogForTest() {
    _drawerLogForTest = [];
}

function notifyDrawer(open, source) {
    const entry = { open: !!open, source };
    _drawerLogForTest.push(entry);
    if (_drawerSinkForTest) {
        try { _drawerSinkForTest(entry); } catch (_) { /* ignore */ }
    }
}

/**
 * 渲染抽屉骨架（首次创建）
 * @returns {HTMLElement}
 */
export function createDrawer() {
    return h('aside', {
        class: 'lx-drawer',
        role: 'navigation',
        'aria-label': '应用菜单',
        'aria-hidden': 'true',
    }, [
        h('div', { class: 'lx-drawer__header' }, [
            createLogo({ size: 28 }),
            h('span', { class: 'lx-drawer__title' }, ['刷题器']),
            h('button', {
                class: 'lx-button lx-button--icon',
                'aria-label': '关闭菜单',
                onclick: () => closeDrawer(),
            }, ['✕']),
        ]),
        h('div', { class: 'lx-drawer__body' }, [
            // 题库管理
            h('div', { class: 'lx-drawer__section' }, [
                h('div', { class: 'lx-drawer__section-title' }, ['题库管理']),
                h('div', { id: 'drawer-libraries' }),
            ]),
            // 筛选
            h('div', { class: 'lx-drawer__section' }, [
                h('div', { class: 'lx-drawer__section-title' }, ['筛选']),
                h('div', { id: 'drawer-filters' }),
            ]),
            // 导入导出
            h('div', { class: 'lx-drawer__section' }, [
                h('div', { class: 'lx-drawer__section-title' }, ['数据']),
                h('div', { id: 'drawer-io' }),
            ]),
            // 更多
            h('div', { class: 'lx-drawer__section' }, [
                h('div', { class: 'lx-drawer__section-title' }, ['更多']),
                h('div', { id: 'drawer-more' }),
            ]),
        ]),
    ]);
}

/**
 * 渲染遮罩
 * @returns {HTMLElement}
 */
export function createOverlay() {
    return h('div', {
        class: 'lx-overlay',
        'aria-hidden': 'true',
        onclick: () => closeDrawer(),
    });
}

/**
 * 打开抽屉
 * @param {string} [source]
 */
export function openDrawer(source) {
    const drawer = $('.lx-drawer');
    const overlay = $('.lx-overlay');
    if (drawer) {
        drawer.classList.add('lx-drawer--open');
        drawer.setAttribute('aria-hidden', 'false');
    }
    if (overlay) {
        overlay.classList.add('lx-overlay--visible');
        overlay.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
    notifyDrawer(true, source || 'open');
}

/**
 * 关闭抽屉
 * @param {string} [source]
 */
export function closeDrawer(source) {
    const drawer = $('.lx-drawer');
    const overlay = $('.lx-overlay');
    if (drawer) {
        drawer.classList.remove('lx-drawer--open');
        drawer.setAttribute('aria-hidden', 'true');
    }
    if (overlay) {
        overlay.classList.remove('lx-overlay--visible');
        overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    notifyDrawer(false, source || 'close');
}

/**
 * 抽屉是否打开
 */
export function isDrawerOpen() {
    const drawer = $('.lx-drawer');
    return drawer && drawer.classList.contains('lx-drawer--open');
}

/**
 * 渲染抽屉内容
 * @param {object} ctx
 * @param {Array<{id,name,questionCount}>} ctx.libraries
 * @param {string} [ctx.currentLibId]
 * @param {() => void} [ctx.onSwitchLib]
 * @param {() => void} [ctx.onImportLibrary]
 * @param {() => void} [ctx.onCreateLibrary]  手动新建空题库
 * @param {() => void} [ctx.onDeleteLibrary]
 * @param {() => void} [ctx.onExportLibrary]
 * @param {() => void} [ctx.onExportProgress]
 * @param {() => void} [ctx.onImportProgress]
 * @param {() => void} [ctx.onResetProgress]
 * @param {() => void} [ctx.onAbout]
 * @param {() => void} [ctx.onHelp]  打开使用帮助
 */
export function renderDrawerContent(ctx = {}) {
    const libs = ctx.libraries || [];
    const currentLibId = ctx.currentLibId;

    // 题库列表
    const libList = h('div', { class: 'lx-list' }, libs.map((lib) => {
        const isActive = lib.id === currentLibId;
        return h('button', {
            class: `lx-drawer__item${isActive ? ' lx-drawer__item--active' : ''}`,
            onclick: () => ctx.onSwitchLib && ctx.onSwitchLib(lib.id),
        }, [
            h('span', { class: 'lx-truncate' }, [lib.name]),
            h('span', { class: 'lx-drawer__item-meta' }, [`${lib.questionCount || 0} 题`]),
        ]);
    }));

    const libActions = h('div', { style: { marginTop: '8px', display: 'flex', gap: '8px' } }, [
        h('button', {
            class: 'lx-button lx-button--secondary lx-button--block',
            onclick: ctx.onImportLibrary,
        }, ['＋ 上传新题库']),
        h('button', {
            class: 'lx-button lx-button--ghost lx-button--block',
            onclick: ctx.onCreateLibrary,
        }, ['✍️ 新建空题库']),
        h('button', {
            class: 'lx-button lx-button--ghost lx-button--block',
            onclick: ctx.onDeleteLibrary,
            disabled: libs.length === 0 ? '' : undefined,
        }, ['－ 删除当前题库']),
    ]);

    // 筛选区（占位，由 study page 填充）
    const filters = h('div', {}, [
        h('button', {
            class: 'lx-button lx-button--ghost lx-button--block',
            onclick: () => { closeDrawer(); location.hash = '#/stats'; },
        }, ['查看进度统计 →']),
    ]);

    // 数据 IO
    const ioSection = h('div', { class: 'lx-list' }, [
        h('button', {
            class: 'lx-drawer__item',
            onclick: ctx.onExportLibrary,
        }, [
            h('span', {}, ['📥 导出当前题库']),
        ]),
        h('button', {
            class: 'lx-drawer__item',
            onclick: ctx.onExportProgress,
        }, [
            h('span', {}, ['💾 备份学习进度']),
        ]),
        h('button', {
            class: 'lx-drawer__item',
            onclick: ctx.onImportProgress,
        }, [
            h('span', {}, ['📂 恢复学习进度']),
        ]),
        h('button', {
            class: 'lx-drawer__item',
            onclick: ctx.onResetProgress,
        }, [
            h('span', {}, ['🗑️ 重置学习进度']),
        ]),
    ]);

    // 更多
    const more = h('div', { class: 'lx-list' }, [
        h('button', {
            class: 'lx-drawer__item',
            onclick: ctx.onHelp,
        }, [
            h('span', {}, ['❓ 使用帮助']),
        ]),
        h('button', {
            class: 'lx-drawer__item',
            onclick: ctx.onAbout,
        }, [
            h('span', {}, ['ℹ️ 关于']),
        ]),
    ]);

    const libsContainer = $('#drawer-libraries');
    const filtersContainer = $('#drawer-filters');
    const ioContainer = $('#drawer-io');
    const moreContainer = $('#drawer-more');

    if (libsContainer) render(libsContainer, [libList, libActions]);
    if (filtersContainer) render(filtersContainer, [filters]);
    if (ioContainer) render(ioContainer, [ioSection]);
    if (moreContainer) render(moreContainer, [more]);
}
