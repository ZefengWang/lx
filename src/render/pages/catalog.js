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
    none:     '⏳',   // ProgressAPI 默认值：未标记/未开始
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

        // 顶部：返回 + 题库信息 + 练习设置 + 新增题目入口
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
            // 练习设置：模式切换 + 换一批 + 清除分类筛选
            // 答题页保持简洁，所有"出题方式"集中到目录页
            renderPracticeSettings(LX),
            h('button', {
                class: 'lx-button lx-button--primary lx-button--block',
                style: { minHeight: '44px', marginTop: '12px' },
                onclick: () => navigate('add-question'),
            }, ['➕ 新增题目']),
            h('div', { class: 'lx-text-xs lx-text-light', style: { marginTop: '8px' } }, [
                '提示：点击题目直接跳转；点分类标题旁「只练本类」可只刷该分类',
            ]),
        ]));

        // 各分组题目列表
        groups.forEach((items, cat) => {
            elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
                h('div', {
                    style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
                }, [
                    h('div', {
                        class: 'lx-text-sm lx-font-semibold',
                        style: { flex: 1, color: 'var(--lx-primary)' },
                    }, [`📁 ${cat}（${items.length} 题）`]),
                    // 「只练本类」：设置分类筛选后返回答题页
                    h('button', {
                        class: 'lx-button lx-button--secondary',
                        style: { fontSize: '12px', padding: '4px 10px', minHeight: 'auto' },
                        onclick: () => {
                            LX.NavigationAPI.setCategory(cat);
                            toastInfo(`已切换到分类：${cat}（共 ${items.length} 题）`);
                            navigate('study');
                        },
                    }, ['🎯 只练本类']),
                ]),
                h('div', { class: 'lx-list' }, items.map(({ q, index }) => {
                    const isCurrent = q.uid === currentQId;
                    const statusR = LX.ProgressAPI.getStatus(q);
                    const status = statusR.ok ? statusR.data : 'none';
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

/**
 * 练习设置区（目录页内联）
 *   - 显示当前模式：顺序 / 随机
 *   - 切换模式按钮
 *   - 随机模式下显示「🎴 换一批」
 *   - 当有分类筛选时显示「📁 当前：xxx  ✕ 清除」
 *
 * 分类筛选本身通过下方各分类分组的「🎯 只练本类」按钮触发，
 * 这里只提供"清除筛选"回到全部分类的入口。
 */
function renderPracticeSettings(LX) {
    const mode = LX.NavigationAPI.getMode();
    const category = LX.NavigationAPI.getCategory();
    const isRandom = mode === 'random';
    const hasCategory = category && category !== 'all';

    const btn = (text, onClick, opts = {}) =>
        h('button', {
            class: `lx-toolbar__btn${opts.active ? ' lx-toolbar__btn--active' : ''}`,
            type: 'button',
            onclick: onClick,
            'aria-pressed': opts.active ? 'true' : 'false',
        }, [text]);

    const children = [
        h('div', { class: 'lx-text-xs lx-text-muted', style: { marginBottom: '6px' } }, ['练习设置']),
        h('div', { class: 'lx-study-toolbar' }, [
            btn(isRandom ? '🔀 随机' : '➡️ 顺序', () => {
                LX.NavigationAPI.setMode(isRandom ? 'sequential' : 'random');
                toastInfo(isRandom ? '已切换为顺序模式' : '已切换为随机模式（已洗牌）');
                // catalog.js 已订阅 NAVIGATION_CHANGED → 自动 refresh，无需手动调
            }, { active: isRandom }),
            isRandom && btn('🎴 换一批', () => {
                LX.NavigationAPI.shuffle();
                toastInfo('已重新洗牌');
            }),
            hasCategory && btn(`✕ 清除分类`, () => {
                LX.NavigationAPI.setCategory('all');
                toastInfo('已显示全部分类');
            }, { active: true }),
        ]),
        hasCategory && h('div', { class: 'lx-text-xs lx-text-muted', style: { marginTop: '4px' } }, [
            `当前仅练习分类：${category}`,
        ]),
    ];
    return h('div', { style: { marginTop: '8px' } }, children);
}
