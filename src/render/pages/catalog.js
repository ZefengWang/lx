/**
 * catalog.js — 题目目录页（章节/题号列表）
 * 用户在答题页点「目录」按钮进入，可一键跳转到任意题
 * 顶部「← 返回刷题」按钮确保移动端不迷路（修复 BUG-007）
 * @module render/pages/catalog
 */

import { h, render } from '../dom.js';
import { navigate } from '../router.js';
import { toastInfo } from '../toast.js';

const TYPE_LABELS = {
    single: '单选',
    multi: '多选',
    judge: '判断',
    fill: '填空',
    essay: '简答',
};

const STATUS_DOT = {
    mastered: '✅',
    review:   '📕',
    pending:  '⏳',
};

export function createCatalogPage() {
    let _container = null;
    let _unsubscribe = null;

    function renderPage(container) {
        _container = container;

        const LX = window.LX;
        if (!_unsubscribe) {
            _unsubscribe = LX.on(LX.Events.NAVIGATION_CHANGED, () => {
                if (_container) refresh();
            });
        }
        refresh();
    }

    function refresh() {
        if (!_container) return;
        const LX = window.LX;

        const currentLibId = LX.LibraryAPI.current().data;
        if (!currentLibId) {
            render(_container, [renderEmpty()]);
            return;
        }

        const libR = LX.LibraryAPI.get(currentLibId);
        if (!libR.ok) {
            render(_container, [renderEmpty()]);
            return;
        }
        const lib = libR.data;
        const questions = lib.questions || [];

        const navR = LX.NavigationAPI.current();
        const currentQId = navR.ok && navR.data ? navR.data.qId : null;

        // 按分类/章节分组
        const groups = new Map();
        questions.forEach((q, i) => {
            const cat = q.category || '未分类';
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push({ q, index: i });
        });

        const elements = [];

        // 顶部：返回 + 题库信息
        elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } }, [
                h('button', {
                    class: 'lx-button lx-button--secondary',
                    onclick: () => navigate('study'),
                    'aria-label': '返回刷题',
                }, ['← 返回刷题']),
                h('div', { style: { flex: 1 } }, [
                    h('div', { class: 'lx-font-semibold' }, [lib.name]),
                    h('div', { class: 'lx-text-xs lx-text-muted' }, [`${questions.length} 题`]),
                ]),
            ]),
            h('div', { class: 'lx-text-xs lx-text-light' }, [
                '提示：点击题目直接跳转',
            ]),
        ]));

        // 各分组题目列表
        groups.forEach((items, cat) => {
            elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
                h('div', {
                    class: 'lx-text-sm lx-font-semibold',
                    style: { marginBottom: '8px', color: 'var(--lx-primary)' },
                }, [`📁 ${cat}（${items.length} 题）`]),
                h('div', { class: 'lx-list' }, items.map(({ q, index }) => {
                    const isCurrent = q.uid === currentQId;
                    const statusR = LX.ProgressAPI.getStatus(q);
                    const status = statusR.ok ? statusR.data : 'pending';
                    const statusIcon = STATUS_DOT[status] || '⏳';
                    const typeLabel = TYPE_LABELS[q.type] || '简答';

                    return h('button', {
                        class: `lx-catalog-item${isCurrent ? ' lx-catalog-item--current' : ''}`,
                        onclick: () => {
                            LX.NavigationAPI.goto(index);
                            toastInfo(`跳到第 ${index + 1} 题`);
                            navigate('study');
                        },
                    }, [
                        h('span', { class: 'lx-catalog-item__status' }, [statusIcon]),
                        h('span', { class: 'lx-catalog-item__id' }, [`#${index + 1}`]),
                        h('span', { class: 'lx-catalog-item__type' }, [typeLabel]),
                        h('span', { class: 'lx-catalog-item__text lx-truncate' }, [
                            (q.question || '（无题干）').replace(/_{2,}/g, '___').slice(0, 60),
                        ]),
                        isCurrent && h('span', { class: 'lx-catalog-item__current' }, ['▶']),
                    ]);
                })),
            ]));
        });

        render(_container, elements);
    }

    function renderEmpty() {
        return h('div', { class: 'lx-empty' }, [
            h('div', { class: 'lx-empty__icon' }, ['📭']),
            h('div', { class: 'lx-empty__title' }, ['没有可显示的题目']),
            h('div', { class: 'lx-empty__desc' }, ['请先选择题库']),
            h('button', {
                class: 'lx-button lx-button--primary',
                style: { marginTop: '16px' },
                onclick: () => navigate('home'),
            }, ['去首页']),
        ]);
    }

    return {
        render: renderPage,
        onLeave() {
            if (_unsubscribe) {
                _unsubscribe();
                _unsubscribe = null;
            }
        },
    };
}
