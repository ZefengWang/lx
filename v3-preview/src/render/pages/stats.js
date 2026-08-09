/**
 * stats.js — 进度统计页
 * @module render/pages/stats
 */

import { h, render } from '../dom.js';

export function createStatsPage() {
    let _container = null;

    function renderPage(container) {
        _container = container;
        refresh();
    }

    function refresh() {
        if (!_container) return;
        const LX = window.LX;

        const currentId = LX.LibraryAPI.current().data;
        if (!currentId) {
            render(_container, [renderEmpty('请先选择题库')]);
            return;
        }

        const summaryR = LX.StatsAPI.summary();
        if (!summaryR.ok) {
            render(_container, [renderEmpty(summaryR.error?.message || '统计失败')]);
            return;
        }
        const s = summaryR.data;

        const elements = [];

        // 总览卡
        elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
            h('div', { class: 'lx-text-base lx-font-semibold', style: { marginBottom: '12px' } }, ['📊 学习进度']),
            h('div', { class: 'lx-stat-grid', style: { marginBottom: '12px' } }, [
                statCard(s.total, '题目总数', 'primary'),
                statCard(s.mastered, '已掌握', 'success'),
                statCard(s.review, '错题', 'warning'),
                statCard(`${s.percent || 0}%`, '掌握率', 'primary'),
            ]),
            h('div', { class: 'lx-progress' }, [
                h('div', {
                    class: `lx-progress__bar${s.percent >= 80 ? ' lx-progress__bar--success' : s.percent >= 50 ? '' : ' lx-progress__bar--warning'}`,
                    style: { width: `${s.percent || 0}%` },
                }),
            ]),
        ]));

        // 按题型
        if (s.byType) {
            elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
                h('div', { class: 'lx-text-sm lx-text-muted lx-font-medium', style: { marginBottom: '8px' } }, ['按题型']),
                h('div', { class: 'lx-list' }, Object.entries(s.byType).map(([type, info]) => {
                    const total = typeof info === 'number' ? info : info.total;
                    const mastered = typeof info === 'object' ? (info.mastered || 0) : 0;
                    const percent = total ? Math.round(mastered / total * 100) : 0;
                    const labels = { single: '单选', multi: '多选', judge: '判断', fill: '填空', essay: '简答' };
                    return h('div', { class: 'lx-list__item' }, [
                        h('span', {}, [labels[type] || type]),
                        h('span', { class: 'lx-drawer__item-meta' }, [`${mastered} / ${total} (${percent}%)`]),
                    ]);
                })),
            ]));
        }

        // 按分类
        if (s.byCategory) {
            const entries = Object.entries(s.byCategory);
            if (entries.length > 0) {
                elements.push(h('div', { class: 'lx-card' }, [
                    h('div', { class: 'lx-text-sm lx-text-muted lx-font-medium', style: { marginBottom: '8px' } }, ['按分类']),
                    h('div', { class: 'lx-list' }, entries.map(([cat, info]) => {
                        const total = typeof info === 'number' ? info : info.total;
                        const mastered = typeof info === 'object' ? (info.mastered || 0) : 0;
                        const percent = total ? Math.round(mastered / total * 100) : 0;
                        return h('div', { class: 'lx-list__item' }, [
                            h('span', { class: 'lx-truncate', style: { flex: 1, marginRight: '8px' } }, [cat || '未分类']),
                            h('span', { class: 'lx-drawer__item-meta' }, [`${mastered} / ${total} (${percent}%)`]),
                        ]);
                    })),
                ]));
            }
        }

        render(_container, elements);
    }

    return { render: renderPage, onLeave() {} };
}

function statCard(value, label, modifier = '') {
    return h('div', { class: `lx-stat-card${modifier ? ` lx-stat-card--${modifier}` : ''}` }, [
        h('div', { class: 'lx-stat-card__value' }, [String(value)]),
        h('div', { class: 'lx-stat-card__label' }, [label]),
    ]);
}

function renderEmpty(msg) {
    return h('div', { class: 'lx-empty' }, [
        h('div', { class: 'lx-empty__icon' }, ['📊']),
        h('div', { class: 'lx-empty__title' }, [msg || '暂无数据']),
    ]);
}
