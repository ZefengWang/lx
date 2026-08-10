/**
 * browse.js — 题目浏览页（搜索 / 列表 / 练习入口）
 * 题干搜索 v1.2：AND filters + 滚动续载；跨页状态经 UiSession
 * @module render/pages/browse
 */

import { h, render } from '../dom.js';
import { navigate } from '../router.js';
import { toastInfo, toastWarning, toastSuccess } from '../toast.js';
import { appConfirm } from '../confirm.js';
import { openHelpSection } from './help.js';
import { jumpToQuestionFromSearch } from '../contracts/catalog-search.js';
import {
    addFilter, removeFilterAt, isSearchMode as filtersActive,
    groupHitsByCategory, categoryOrderFromQuestions,
} from '../contracts/catalog-search-state.js';
import {
    getBrowseSearch, setBrowseSearch,
    getPracticeSheet, setPracticeSheet, closePracticeSheet as closePracticeSession,
} from '../session/index.js';

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
    none:     '⏳',
};

const SEARCH_PAGE = 50;
const TOOL_BTN_STYLE = {
    minHeight: '44px',
    padding: '10px 14px',
    fontSize: '14px',
};

export function createBrowsePage() {
    let _container = null;
    let _unsubscribe = null;
    const _collapsed = new Map();

    /** @type {string} */
    let _draft = '';
    /** @type {string[]} */
    let _filters = [];
    let _composing = false;

    /** 搜索续载 */
    let _loadedHits = [];
    let _searchTotal = 0;
    let _searchLoading = false;
    /** @type {IntersectionObserver|null} */
    let _io = null;
    /** @type {string} 用于判断 filters 是否变化 */
    let _loadedKey = '';

    function hydrateSearchFromSession() {
        const s = getBrowseSearch();
        _filters = s.filters.slice();
        _draft = s.draft;
    }

    function persistSearchSession() {
        setBrowseSearch({ filters: _filters, draft: _draft });
        if (!filtersActive(_filters) && window.LX?.NavigationAPI?.clearSearchPlaylist) {
            window.LX.NavigationAPI.clearSearchPlaylist();
        }
    }

    function renderPage(container) {
        _container = container;
        hydrateSearchFromSession();

        const LX = window.LX;
        if (!_unsubscribe) {
            _unsubscribe = LX.on(LX.Events.NAVIGATION_CHANGED, () => {
                if (_composing) return;
                if (_container) refresh();
            });
        }
        refresh();
    }

    function filtersKey() {
        const LX = window.LX;
        const cat = (LX && LX.NavigationAPI.getCategory()) || 'all';
        const status = (LX && LX.NavigationAPI.getStatusFilter()) || 'all';
        // 分类/状态变更须使搜索缓存失效（只练本类内搜 ≠ 全库搜）
        return `${cat}\u0002${status}\u0002${_filters.join('\u0001')}`;
    }

    function searchScopeOptions() {
        const LX = window.LX;
        const category = LX.NavigationAPI.getCategory() || 'all';
        const status = LX.NavigationAPI.getStatusFilter() || 'all';
        /** @type {{ keywords: string[], limit: number, offset?: number, category?: string, status?: string }} */
        const opts = { keywords: _filters, limit: SEARCH_PAGE };
        if (category && category !== 'all') opts.category = category;
        if (status && status !== 'all') opts.status = status;
        return opts;
    }

    function resetSearchLoad() {
        _loadedHits = [];
        _searchTotal = 0;
        _loadedKey = '';
        _searchLoading = false;
    }

    function fetchSearchBatch(reset) {
        const LX = window.LX;
        if (reset) {
            _loadedHits = [];
            _loadedKey = filtersKey();
        }
        const offset = _loadedHits.length;
        const searchR = LX.QuestionAPI.search('', {
            ...searchScopeOptions(),
            offset,
        });
        if (!searchR.ok) return searchR;
        _searchTotal = searchR.data.total;
        _loadedHits = _loadedHits.concat(searchR.data.questions || []);
        return searchR;
    }

    function commitSearch() {
        if (_composing) return;
        const r = addFilter(_filters, _draft);
        if (!r.ok) {
            toastWarning(r.error?.message || '请输入搜索关键字');
            return;
        }
        _filters = r.filters;
        // 条件已落到过滤标签；清空输入框便于继续追加下一词
        _draft = '';
        persistSearchSession();
        resetSearchLoad();
        refresh();
    }

    function removeFilter(index) {
        const r = removeFilterAt(_filters, index);
        if (!r.ok) return;
        _filters = r.filters;
        _draft = _filters[_filters.length - 1] || '';
        persistSearchSession();
        resetSearchLoad();
        refresh();
    }

    function loadMoreSearch() {
        if (_searchLoading) return;
        if (!filtersActive(_filters)) return;
        if (_loadedHits.length >= _searchTotal) return;
        _searchLoading = true;
        const r = fetchSearchBatch(false);
        _searchLoading = false;
        if (!r.ok) {
            toastWarning(r.error?.message || '加载失败');
            return;
        }
        refresh();
    }

    function detachIO() {
        if (_io) {
            _io.disconnect();
            _io = null;
        }
    }

    function attachSearchSentinel(el) {
        detachIO();
        if (!el || typeof IntersectionObserver === 'undefined') return;
        _io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) loadMoreSearch();
            }
        }, { root: null, rootMargin: '120px', threshold: 0 });
        _io.observe(el);
    }

    /** 练习模式旁「?」：本地短说明；可选再进帮助页完整章节 */
    function showPracticeModeHint() {
        const goHelp = appConfirm(
            '【练习模式】简要说明\n'
            + '· 背诵记忆（默认）：答完不自动切题，需手动下一题；题量不限（全量优先未标记）\n'
            + '· 快速刷题：答对自动下一题；答错约停留 5 秒再下一题；可设本轮题量\n'
            + '· 优先从未标记（未开始）的题中抽\n'
            + '· 上一题可回看作答与答案\n\n'
            + '需要打开帮助页查看完整说明吗？',
        );
        if (goHelp) openHelpSection('practice-mode');
    }

    function openPracticeSheet() {
        const LX = window.LX;
        setPracticeSheet({
            open: true,
            mode: 'memory',
            countDraft: String(LX.DrillAPI.DEFAULT_COUNT || 100),
        });
        refresh();
    }

    function closePracticeSheet() {
        const sheet = getPracticeSheet();
        if (!sheet.open) return;
        closePracticeSession();
        refresh();
    }

    function confirmPracticeStart() {
        const LX = window.LX;
        const sheet = getPracticeSheet();
        const mode = sheet.mode === 'quick' ? 'quick' : 'memory';
        /** @type {{ mode: string, count?: number }} */
        const opts = { mode };
        if (mode === 'quick') {
            const count = Math.floor(Number(String(sheet.countDraft).trim()));
            if (!Number.isFinite(count) || count < 1) {
                toastWarning('题量无效');
                return;
            }
            opts.count = count;
        }
        const r = LX.DrillAPI.start(opts);
        if (!r.ok) {
            toastWarning(r.error?.message || '无法开始练习');
            return;
        }
        closePracticeSession();
        toastSuccess(mode === 'quick'
            ? `快速刷题：${r.data.total} 题`
            : `背诵记忆：${r.data.total} 题`);
        navigate('study');
    }

    function renderPracticeSheet() {
        const sheet = getPracticeSheet();
        if (!sheet.open) return null;
        const practiceMode = sheet.mode === 'quick' ? 'quick' : 'memory';
        const countDisabled = practiceMode === 'memory';
        const modeBtn = (mode, label, hint) => h('button', {
            type: 'button',
            class: `lx-button ${practiceMode === mode ? 'lx-button--primary' : 'lx-button--secondary'}`,
            style: { minHeight: '44px', flex: 1, textAlign: 'left' },
            'aria-label': label,
            'aria-pressed': practiceMode === mode ? 'true' : 'false',
            onclick: () => {
                setPracticeSheet({ mode });
                refresh();
            },
        }, [
            h('div', { style: { fontWeight: 600 } }, [label]),
            h('div', {
                class: 'lx-text-xs',
                style: {
                    marginTop: '2px',
                    opacity: practiceMode === mode ? 0.9 : 0.75,
                    fontWeight: 400,
                },
            }, [hint]),
        ]);

        return h('div', {
            class: 'lx-modal lx-modal--center lx-modal--open',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': '练习模式设置',
            style: { background: 'rgba(0, 0, 0, 0.45)' },
            onclick: (ev) => {
                if (ev.target === ev.currentTarget) closePracticeSheet();
            },
        }, [
            h('div', {
                class: 'lx-modal__panel',
                onclick: (ev) => ev.stopPropagation(),
            }, [
                h('div', { class: 'lx-modal__header' }, [
                    h('div', { class: 'lx-modal__title' }, ['练习模式']),
                    h('button', {
                        type: 'button',
                        class: 'lx-button lx-button--ghost',
                        style: { minWidth: '44px', minHeight: '44px' },
                        'aria-label': '关闭练习模式设置',
                        onclick: () => closePracticeSheet(),
                    }, ['✕']),
                ]),
                h('div', { class: 'lx-modal__body' }, [
                    h('div', {
                        class: 'lx-text-sm lx-text-muted',
                        style: { marginBottom: '12px' },
                    }, ['默认背诵记忆；快速刷题时可改本轮题量。']),
                    h('div', {
                        style: { display: 'flex', gap: '8px', marginBottom: '16px' },
                    }, [
                        modeBtn('memory', '背诵记忆', '答完手动切题 · 不限量'),
                        modeBtn('quick', '快速刷题', '答对自动下一题'),
                    ]),
                    h('label', { class: 'lx-field' }, [
                        h('span', { class: 'lx-field__label' }, [
                            countDisabled ? '本轮题量（背诵模式不限）' : '本轮题量',
                        ]),
                        h('input', {
                            class: 'lx-input',
                            type: 'number',
                            min: '1',
                            inputmode: 'numeric',
                            value: sheet.countDraft,
                            disabled: countDisabled,
                            'aria-label': '本轮题量',
                            'aria-disabled': countDisabled ? 'true' : 'false',
                            style: {
                                minHeight: '44px',
                                opacity: countDisabled ? 0.55 : 1,
                            },
                            oninput: (ev) => {
                                setPracticeSheet({ countDraft: ev.target.value });
                            },
                        }),
                    ]),
                ]),
                h('div', { class: 'lx-modal__footer' }, [
                    h('button', {
                        type: 'button',
                        class: 'lx-button lx-button--secondary',
                        style: { minHeight: '44px', flex: 1 },
                        'aria-label': '取消练习模式',
                        onclick: () => closePracticeSheet(),
                    }, ['取消']),
                    h('button', {
                        type: 'button',
                        class: 'lx-button lx-button--primary',
                        style: { minHeight: '44px', flex: 1 },
                        'aria-label': '开始练习',
                        onclick: () => confirmPracticeStart(),
                    }, ['开始练习']),
                ]),
            ]),
        ]);
    }

    function paint(elements) {
        const sheet = renderPracticeSheet();
        if (sheet) elements.push(sheet);
        render(_container, elements);
    }

    function toolBtn(text, onClick, opts = {}) {
        return h('button', {
            class: `lx-toolbar__btn${opts.active ? ' lx-toolbar__btn--active' : ''}`,
            type: 'button',
            style: TOOL_BTN_STYLE,
            onclick: onClick,
            'aria-label': opts.label || text,
            'aria-pressed': opts.active ? 'true' : 'false',
        }, [text]);
    }

    function refresh() {
        if (!_container) return;
        const LX = window.LX;
        detachIO();

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

        const groups = new Map();
        questions.forEach((q, i) => {
            const cat = q.category || '未分类';
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push({ q, index: i });
        });

        const isSearchMode = filtersActive(_filters);

        let searchR = null;
        let hits = [];
        let total = 0;
        let hitGroups = [];
        if (isSearchMode) {
            if (_loadedKey !== filtersKey() || _loadedHits.length === 0) {
                searchR = fetchSearchBatch(true);
            } else {
                searchR = { ok: true, data: { questions: _loadedHits, total: _searchTotal } };
            }
            hits = searchR.ok ? _loadedHits : [];
            total = searchR.ok ? _searchTotal : 0;
            hitGroups = groupHitsByCategory(hits, categoryOrderFromQuestions(questions));
        }
        const hitSummary = !isSearchMode
            ? ''
            : (!searchR.ok ? '搜索失败' : `共 ${total} 题`);

        const foldCats = isSearchMode
            ? hitGroups.map((g) => g.category)
            : [...groups.keys()];
        const showFold = foldCats.length > 1;

        const mode = LX.NavigationAPI.getMode();
        const category = LX.NavigationAPI.getCategory();
        const isRandom = mode === 'random';
        const hasCategory = category && category !== 'all';

        const elements = [];

        elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                h('button', {
                    class: 'lx-button lx-button--secondary',
                    style: { minHeight: '44px' },
                    onclick: () => navigate('study'),
                    'aria-label': '返回刷题',
                }, ['← 返回']),
                h('div', { style: { flex: 1, minWidth: 0 } }, [
                    h('div', { class: 'lx-font-semibold lx-truncate' }, [lib.name]),
                    h('div', { class: 'lx-text-xs lx-text-muted' }, [`${questions.length} 题`]),
                ]),
                h('button', {
                    class: 'lx-button lx-button--secondary',
                    style: { minHeight: '44px', flexShrink: 0 },
                    'aria-label': '新增题目',
                    onclick: () => navigate('add-question'),
                }, ['新增']),
            ]),
            h('div', { class: 'lx-divider', style: { margin: '12px 0' } }),
            h('div', {
                style: { display: 'flex', gap: '8px', alignItems: 'stretch' },
            }, [
                h('input', {
                    class: 'lx-input',
                    type: 'search',
                    placeholder: '搜索题干…',
                    value: _draft,
                    'aria-label': '搜索题干',
                    style: { flex: 1, minHeight: '44px', minWidth: 0 },
                    oncompositionstart: () => { _composing = true; },
                    oncompositionend: (ev) => {
                        _composing = false;
                        _draft = ev.target.value;
                    },
                    oninput: (ev) => { _draft = ev.target.value; },
                    onkeydown: (ev) => {
                        if (ev.key === 'Enter' && !_composing) {
                            ev.preventDefault();
                            commitSearch();
                        }
                    },
                }),
                h('button', {
                    class: 'lx-button lx-button--secondary',
                    type: 'button',
                    style: { minHeight: '44px', flexShrink: 0 },
                    'aria-label': '执行题干搜索',
                    onclick: () => commitSearch(),
                }, ['搜索']),
            ]),
            isSearchMode && h('div', {
                class: 'lx-chips',
                style: { marginTop: '8px', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
            }, [
                ..._filters.map((term, index) => h('span', {
                    class: 'lx-chip lx-chip--active',
                    style: { minHeight: '36px', maxWidth: '100%' },
                    'data-filter-index': String(index),
                }, [
                    h('span', {
                        class: 'lx-truncate',
                        style: { maxWidth: '160px' },
                        title: term,
                    }, [term]),
                    h('button', {
                        type: 'button',
                        class: 'lx-chip__dismiss',
                        'aria-label': `清除过滤条件：${term}`,
                        'data-filter-index': String(index),
                        style: {
                            marginLeft: '4px',
                            minWidth: '44px',
                            minHeight: '36px',
                            border: 'none',
                            background: 'transparent',
                            color: 'inherit',
                            fontSize: '18px',
                            lineHeight: '1',
                            cursor: 'pointer',
                            padding: '0 4px',
                        },
                        onclick: (ev) => {
                            ev.stopPropagation && ev.stopPropagation();
                            removeFilter(index);
                        },
                    }, ['×']),
                ])),
                h('span', {
                    class: 'lx-text-xs lx-text-muted',
                    'aria-live': 'polite',
                }, [hitSummary]),
            ]),
            h('div', { class: 'lx-divider', style: { margin: '12px 0' } }),
            h('div', { class: 'lx-study-toolbar', style: { marginBottom: '0', gap: '8px' } }, [
                toolBtn(isRandom ? '🔀 随机' : '➡️ 顺序', () => {
                    LX.NavigationAPI.setMode(isRandom ? 'sequential' : 'random');
                    toastInfo(isRandom ? '已切换为顺序模式' : '已切换为随机模式（已洗牌）');
                    refresh();
                }, { active: isRandom, label: isRandom ? '随机模式' : '顺序模式' }),
                isRandom && toolBtn('🎴 换一批', () => {
                    LX.NavigationAPI.shuffle();
                    toastInfo('已重新洗牌');
                }, { label: '换一批' }),
                hasCategory && toolBtn('✕ 清除分类', () => {
                    LX.NavigationAPI.setCategory('all');
                    resetSearchLoad();
                    toastInfo(isSearchMode ? '已改为全库搜索' : '已显示全部分类');
                    refresh();
                }, { active: true, label: '清除分类' }),
                showFold && toolBtn('🔽 全部折叠', () => {
                    for (const cat of foldCats) _collapsed.set(cat, true);
                    refresh();
                }, { label: '全部折叠' }),
                showFold && toolBtn('🔼 全部展开', () => {
                    for (const cat of foldCats) _collapsed.set(cat, false);
                    refresh();
                }, { label: '全部展开' }),
            ]),
            hasCategory && h('div', {
                class: 'lx-text-xs lx-text-muted',
                style: { marginTop: '6px' },
                'aria-label': '当前分类范围',
            }, [
                isSearchMode
                    ? `搜索范围：仅「${category}」分类`
                    : `当前仅练习分类：${category}`,
            ]),
            h('div', {
                style: {
                    marginTop: '10px',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'stretch',
                },
            }, [
                h('button', {
                    class: 'lx-button lx-button--secondary',
                    type: 'button',
                    style: { minHeight: '44px', flex: 1 },
                    'aria-label': '练习模式',
                    onclick: () => openPracticeSheet(),
                }, ['练习模式']),
                h('button', {
                    class: 'lx-button lx-button--ghost',
                    type: 'button',
                    style: {
                        minHeight: '44px',
                        minWidth: '44px',
                        flexShrink: 0,
                        fontSize: '18px',
                        fontWeight: 700,
                    },
                    'aria-label': '练习模式说明',
                    title: '练习模式是什么？',
                    onclick: () => showPracticeModeHint(),
                }, ['?']),
            ]),
            h('div', { class: 'lx-text-xs lx-text-light', style: { marginTop: '8px' } }, [
                isSearchMode
                    ? (hasCategory
                        ? `仅在「${category}」内搜索；点 × 去条件；点题后上下翻也限此结果`
                        : '点过滤标签 × 去掉条件；结果可滚到底看全；点题跳转')
                    : '搜索可连续收窄；有「只练本类」时搜索只在该类内；练习模式可开快速/背诵',
            ]),
        ]));

        if (isSearchMode) {
            if (!searchR.ok) {
                elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
                    h('div', { class: 'lx-text-sm lx-text-muted' }, [searchR.error?.message || '未知错误']),
                ]));
            } else if (hits.length === 0) {
                elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
                    h('div', { class: 'lx-text-sm lx-text-muted' }, ['无匹配题干']),
                ]));
            } else {
                for (const g of hitGroups) {
                    elements.push(renderCategoryGroup({
                        cat: g.category,
                        items: g.questions.map((q) => ({ q, index: -1 })),
                        currentQId,
                        LX,
                        showPracticeBtn: false,
                        useSearchJump: true,
                    }));
                }
                if (hits.length < total) {
                    elements.push(h('div', {
                        class: 'lx-text-xs lx-text-muted',
                        style: { textAlign: 'center', padding: '12px' },
                        'data-search-sentinel': '1',
                        'aria-busy': _searchLoading ? 'true' : 'false',
                    }, [_searchLoading ? '加载中…' : '向下滚动加载更多']));
                }
            }

            paint(elements);
            const sentinel = _container.querySelector('[data-search-sentinel]');
            if (sentinel) attachSearchSentinel(sentinel);
            return;
        }

        groups.forEach((items, cat) => {
            elements.push(renderCategoryGroup({
                cat,
                items,
                currentQId,
                LX,
                showPracticeBtn: true,
                useSearchJump: false,
            }));
        });

        paint(elements);
    }

    function renderCategoryGroup(opts) {
        const { cat, items, currentQId, LX, showPracticeBtn, useSearchJump } = opts;
        const collapsed = !!_collapsed.get(cat);
        const toggle = () => {
            _collapsed.set(cat, !collapsed);
            refresh();
        };
        const arrow = collapsed ? '▶' : '▼';

        return h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
            h('div', {
                style: {
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: collapsed ? '0' : '8px', cursor: 'pointer',
                    userSelect: 'none', padding: '2px 0', borderRadius: '4px',
                },
                onclick: toggle,
                title: collapsed ? '点击展开本分类' : '点击折叠本分类',
            }, [
                h('span', {
                    class: 'lx-catalog-item__type',
                    style: {
                        display: 'inline-flex', width: '20px', height: '20px',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--lx-primary)', fontWeight: 'bold', flexShrink: 0,
                    },
                    'aria-label': collapsed ? '展开' : '折叠',
                }, [arrow]),
                h('div', {
                    class: 'lx-text-sm lx-font-semibold',
                    style: { flex: 1, color: 'var(--lx-primary)' },
                }, [`📁 ${cat}（${items.length} 题）`]),
                showPracticeBtn && h('span', { onclick: (ev) => { ev.stopPropagation && ev.stopPropagation(); } }, [
                    h('button', {
                        class: 'lx-button lx-button--secondary',
                        style: { fontSize: '12px', padding: '4px 10px', minHeight: 'auto' },
                        type: 'button',
                        onclick: (ev) => {
                            ev.stopPropagation && ev.stopPropagation();
                            LX.NavigationAPI.setCategory(cat);
                            toastInfo(`已切换到分类：${cat}（共 ${items.length} 题）`);
                            navigate('study');
                        },
                    }, ['🎯 只练本类']),
                ]),
            ]),
            !collapsed && h('div', { class: 'lx-list' }, items.map(({ q, index }) => {
                const isCurrent = q.uid === currentQId;
                const statusR = LX.ProgressAPI.getStatus(q);
                const status = statusR.ok ? statusR.data : 'none';
                const statusIcon = STATUS_DOT[status] || '⏳';
                const typeLabel = TYPE_LABELS[q.type] || '简答';
                const qCategory = q.category || '未分类';

                return h('button', {
                    class: `lx-catalog-item${isCurrent ? ' lx-catalog-item--current' : ''}`,
                    onclick: () => {
                        if (LX.DrillAPI && LX.DrillAPI.isActive()) LX.DrillAPI.exit();
                        if (useSearchJump) {
                            const jump = jumpToQuestionFromSearch(LX, q.uid, {
                                keywords: _filters.slice(),
                                category: LX.NavigationAPI.getCategory(),
                                status: LX.NavigationAPI.getStatusFilter(),
                            });
                            if (!jump.ok) {
                                toastWarning(jump.error?.message || '跳转失败');
                                return;
                            }
                            toastInfo(`搜索范围 ${jump.data.playlistTotal} 题 · 第 ${jump.data.index + 1} 题`);
                            navigate('study');
                            return;
                        }

                        if (LX.NavigationAPI.getSearchPlaylist()) {
                            LX.NavigationAPI.clearSearchPlaylist();
                        }

                        const currentCategory = LX.NavigationAPI.getCategory() || 'all';
                        const targetCategory = qCategory;
                        const isAllMode = currentCategory === 'all' || !currentCategory;
                        let newIndex = index;

                        if (!isAllMode && targetCategory !== currentCategory) {
                            const sc = LX.NavigationAPI.setCategory(targetCategory);
                            if (!sc.ok) {
                                toastWarning(sc.error?.message || '切换分类失败');
                                return;
                            }
                        }
                        const activeListR = LX.NavigationAPI.getActiveList();
                        if (activeListR.ok && Array.isArray(activeListR.data)) {
                            const idx = activeListR.data.findIndex((qq) => qq.uid === q.uid);
                            if (idx >= 0) newIndex = idx;
                        }
                        const gotoR = LX.NavigationAPI.goto(newIndex);
                        if (!gotoR.ok) {
                            toastWarning(gotoR.error?.message || '跳转失败');
                            return;
                        }
                        if (!isAllMode && targetCategory !== currentCategory) {
                            toastInfo(`已切换到「${targetCategory}」，跳到第 ${gotoR.data.index + 1} 题`);
                        } else {
                            toastInfo(`跳到第 ${gotoR.data.index + 1} 题`);
                        }
                        navigate('study');
                    },
                }, [
                    h('span', { class: 'lx-catalog-item__status' }, [statusIcon]),
                    !useSearchJump && h('span', { class: 'lx-catalog-item__id' }, [`#${index + 1}`]),
                    h('span', { class: 'lx-catalog-item__type' }, [typeLabel]),
                    h('span', { class: 'lx-catalog-item__text lx-truncate' }, [
                        (q.question || '（无题干）').replace(/_{2,}/g, '___').slice(0, 60),
                    ]),
                    isCurrent && h('span', { class: 'lx-catalog-item__current' }, ['▶']),
                ]);
            })),
        ]);
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
            closePracticeSession();
            detachIO();
            if (_unsubscribe) {
                _unsubscribe();
                _unsubscribe = null;
            }
        },
        /** 【仅测试用】触发搜索触底续载（等价 IntersectionObserver 回调） */
        __loadMoreSearchForTest() {
            loadMoreSearch();
        },
    };
}
