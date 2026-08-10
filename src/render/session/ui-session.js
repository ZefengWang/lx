/**
 * ui-session.js — 界面会话（跨路由 UI 上下文）
 *
 * 属于 render 内子层 `session/`：pages / shell 可依赖；禁止 api/core 依赖本层。
 * 不写入刷题队列；搜索命中队列见 NavigationAPI.searchPlaylist。
 *
 * @module render/session/ui-session
 */

/** @typedef {'quick'|'memory'} PracticeMode */

/**
 * @typedef {{
 *   browseSearch: { filters: string[], draft: string },
 *   practiceSheet: { open: boolean, mode: PracticeMode, countDraft: string },
 * }} UiSessionState
 */

/** @returns {UiSessionState} */
function createInitial() {
    return {
        browseSearch: { filters: [], draft: '' },
        practiceSheet: {
            open: false,
            mode: 'memory',
            countDraft: '100',
        },
    };
}

/** @type {UiSessionState} */
let _session = createInitial();

/** @returns {UiSessionState} */
export function getUiSession() {
    return {
        browseSearch: {
            filters: _session.browseSearch.filters.slice(),
            draft: _session.browseSearch.draft,
        },
        practiceSheet: { ..._session.practiceSheet },
    };
}

/**
 * @returns {{ filters: string[], draft: string }}
 */
export function getBrowseSearch() {
    return {
        filters: _session.browseSearch.filters.slice(),
        draft: _session.browseSearch.draft,
    };
}

/**
 * @param {{ filters?: string[], draft?: string }} patch
 */
export function setBrowseSearch(patch = {}) {
    const cur = _session.browseSearch;
    _session.browseSearch = {
        filters: Array.isArray(patch.filters) ? patch.filters.map(String) : cur.filters.slice(),
        draft: patch.draft != null ? String(patch.draft) : cur.draft,
    };
    return getBrowseSearch();
}

export function clearBrowseSearch() {
    _session.browseSearch = { filters: [], draft: '' };
    return getBrowseSearch();
}

/**
 * @returns {{ open: boolean, mode: PracticeMode, countDraft: string }}
 */
export function getPracticeSheet() {
    return { ..._session.practiceSheet };
}

/**
 * @param {{ open?: boolean, mode?: PracticeMode, countDraft?: string }} patch
 */
export function setPracticeSheet(patch = {}) {
    const cur = _session.practiceSheet;
    let mode = cur.mode;
    if (patch.mode === 'quick' || patch.mode === 'memory') mode = patch.mode;
    _session.practiceSheet = {
        open: patch.open != null ? !!patch.open : cur.open,
        mode,
        countDraft: patch.countDraft != null ? String(patch.countDraft) : cur.countDraft,
    };
    return getPracticeSheet();
}

export function closePracticeSheet() {
    _session.practiceSheet = { ..._session.practiceSheet, open: false };
    return getPracticeSheet();
}

/** 【仅测试用】 */
export function __resetUiSessionForTest() {
    _session = createInitial();
}
