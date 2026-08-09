/**
 * topbar.js — 顶栏渲染
 * 来源：DESIGN.md 7.1
 * 结构：☰ 菜单 | 📚 题库名 | 📕错题角标 + 23/156 进度
 *
 * 移动端导航修复（BUG-007）：
 *   - study 页：左侧 ☰ 打开抽屉
 *   - 其他页（stats/settings/catalog/wrong 等）：左侧显示「← 返回」
 *     一键回到 study，避免用户迷路
 * @module render/topbar
 */

import { h } from './dom.js';

/**
 * 渲染顶栏
 * @param {object} ctx
 * @param {string} [ctx.routeName] 当前路由名（study/home/stats/...）
 * @param {string} ctx.libraryName 当前题库名（无则「未选择题库」）
 * @param {number} ctx.wrongCount 错题数
 * @param {number} ctx.masteredCount 已掌握数
 * @param {number} ctx.totalCount 总题数
 * @param {number} [ctx.percent] 掌握率
 * @param {() => void} [ctx.onMenu] 菜单按钮回调（study 页用）
 * @param {() => void} [ctx.onBack] 返回按钮回调（其他页用）
 * @param {() => void} [ctx.onLibraryClick] 题库名点击（切库下拉）
 * @param {() => void} [ctx.onWrongClick] 错题入口点击
 * @param {() => void} [ctx.onProgressClick] 进度点击
 * @returns {HTMLElement}
 */
export function renderTopbar(ctx = {}) {
    const libName = ctx.libraryName || '未选择题库';
    const wrongCount = ctx.wrongCount || 0;
    const mastered = ctx.masteredCount || 0;
    const total = ctx.totalCount || 0;
    const percent = ctx.percent != null ? ctx.percent : (total ? Math.round(mastered / total * 100) : 0);

    // 判断显示 ☰ 还是 ← 返回
    // home 页是入口，显示 ☰；study 页显示 ☰；其他页显示 ← 返回
    const route = ctx.routeName || 'home';
    const showBack = (route !== 'study' && route !== 'home');

    const leftBtn = showBack
        ? h('button', {
            class: 'lx-button lx-button--icon',
            'aria-label': '返回刷题',
            onclick: ctx.onBack,
        }, ['←'])
        : h('button', {
            class: 'lx-button lx-button--icon',
            'aria-label': '打开菜单',
            onclick: ctx.onMenu,
        }, ['☰']);

    return h('header', { class: 'lx-topbar', role: 'banner' }, [
        leftBtn,

        // 📚 题库名（可点击切换）
        h('button', {
            class: 'lx-topbar__title',
            onclick: ctx.onLibraryClick,
            'aria-label': '切换题库',
        }, [
            h('span', { class: 'lx-topbar__icon' }, ['📚']),
            h('span', { class: 'lx-topbar__title-text' }, [libName]),
            h('span', { class: 'lx-topbar__icon', style: { opacity: 0.5, fontSize: '12px' } }, ['▾']),
        ]),

        // 右侧：错题角标 + 进度文字
        h('div', { class: 'lx-topbar__right' }, [
            h('button', {
                class: 'lx-button lx-button--icon',
                'aria-label': `错题本（${wrongCount}）`,
                onclick: ctx.onWrongClick,
            }, [
                h('span', { class: 'lx-badge' }, [
                    '📕',
                    wrongCount > 0 && h('span', {
                        class: `lx-badge__count${wrongCount === 0 ? ' lx-badge__count--zero' : ''}`,
                    }, [String(wrongCount)]),
                ]),
            ]),
            h('button', {
                class: 'lx-button--text',
                onclick: ctx.onProgressClick,
                'aria-label': `进度：${mastered} / ${total}`,
                style: { padding: 0, minWidth: 'auto' },
            }, [
                h('div', { class: 'lx-progress-text' }, [
                    h('span', {}, [`${mastered}/${total}`]),
                    h('span', { class: 'lx-progress-text__sub' }, [`${percent}%`]),
                ]),
            ]),
        ]),
    ]);
}
