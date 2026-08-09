/**
 * home.js — 首页
 * 内容：欢迎卡 + 总览统计卡 + 题库列表 + 开始学习按钮
 * @module render/pages/home
 */

import { h, render } from '../dom.js';
import { navigate } from '../router.js';
import { toastInfo } from '../toast.js';

export function createHomePage() {
    let _container = null;

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

        // 欢迎卡
        elements.push(h('div', { class: 'lx-card', style: { marginBottom: '16px' } }, [
            h('div', { style: { fontSize: '24px', marginBottom: '8px' } }, ['👋']),
            h('div', { class: 'lx-text-xl lx-font-semibold' }, [`欢迎来到刷题器`]),
            h('div', { class: 'lx-text-sm lx-text-muted', style: { marginTop: '4px' } }, [
                current ? `当前正在学习：${current.name}` : '从下方选择一个题库开始学习',
            ]),
        ]));

        // 统计卡（4 项）
        if (current) {
            elements.push(h('div', { class: 'lx-stat-grid', style: { marginBottom: '16px' } }, [
                statCard(summary.total, '题目总数', 'primary'),
                statCard(summary.mastered, '已掌握', 'success'),
                statCard(summary.review, '错题', 'warning'),
                statCard(`${summary.percent || 0}%`, '掌握率', 'primary'),
            ]));
        }

        // 题库列表
        if (libs.length === 0) {
            elements.push(h('div', { class: 'lx-empty' }, [
                h('div', { class: 'lx-empty__icon' }, ['📚']),
                h('div', { class: 'lx-empty__title' }, ['还没有题库']),
                h('div', { class: 'lx-empty__desc' }, ['从右上角菜单 ☰ 上传你的第一个题库']),
            ]));
        } else {
            elements.push(h('div', { class: 'lx-card' }, [
                h('div', { class: 'lx-text-sm lx-text-muted lx-font-medium', style: { marginBottom: '12px', textTransform: 'uppercase' } }, ['我的题库']),
                h('div', { class: 'lx-list' }, libs.map((lib) => {
                    const isActive = lib.id === currentId;
                    return h('button', {
                        class: 'lx-list__item',
                        style: {
                            width: '100%',
                            textAlign: 'left',
                            cursor: 'pointer',
                            background: isActive ? 'var(--lx-primary-light)' : 'transparent',
                            fontWeight: isActive ? '600' : '400',
                        },
                        onclick: () => {
                            const r = LX.LibraryAPI.switch(lib.id);
                            if (r.ok) {
                                toastInfo(`已切换到「${lib.name}」`);
                                navigate('study');
                            }
                        },
                    }, [
                        h('div', { class: 'lx-flex-1 lx-truncate' }, [
                            isActive && h('span', { style: { color: 'var(--lx-primary)', marginRight: '6px' } }, ['▶']),
                            lib.name,
                        ]),
                        h('span', { class: 'lx-drawer__item-meta' }, [`${lib.questionCount || 0} 题`]),
                    ]);
                })),
            ]));
        }

        // 开始学习按钮
        if (current) {
            elements.push(h('button', {
                class: 'lx-button lx-button--primary lx-button--block',
                style: { marginTop: '16px', minHeight: '56px', fontSize: '17px' },
                onclick: () => navigate('study'),
            }, ['▶ 开始学习']));
        }

        render(_container, elements);
    }

    return {
        render: renderPage,
        onLeave() {},
    };
}

function statCard(value, label, modifier = '') {
    return h('div', { class: `lx-stat-card${modifier ? ` lx-stat-card--${modifier}` : ''}` }, [
        h('div', { class: 'lx-stat-card__value' }, [String(value)]),
        h('div', { class: 'lx-stat-card__label' }, [label]),
    ]);
}
