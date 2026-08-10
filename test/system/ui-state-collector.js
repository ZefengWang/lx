/**
 * UI 状态采集器（系统测协议）
 *
 * 协议见 docs/testing/UI-CONTROLS.inventory.json → uiStateSnapshotSchema / systemTestProtocol
 * 每次 action 前后调用 collectUiState()，用 assertStateDelta 断言 expectDelta。
 *
 * 支持两种采集面：
 * 1. 父页 mountShell / mountShellWithPage（过渡）——默认读父页 getState / getUiSession / isDrawerOpen
 * 2. iframe `app.html?test=1` 整页 `#app`——必须传 adapter（或走 LX.TestAPI.probeUi），
 *    **禁止**误用父页 getState/getUiSession/isDrawerOpen 读子页面
 *
 * @module test/system/ui-state-collector
 */

import { getLX } from '../helpers.js';
import { getState } from '../../src/core/state.js';
import { isDrawerOpen } from '../../src/render/drawer.js';
import { __getToastLogForTest } from '../../src/render/toast.js';
import { __getConfirmLogForTest } from '../../src/render/confirm.js';
import { __getPromptLogForTest } from '../../src/render/prompt.js';
import { __getDownloadLogForTest } from '../../src/render/download.js';
import { getUiSession } from '../../src/render/session/index.js';

/**
 * @typedef {object} UiStateAdapter
 * @property {object} LX
 * @property {Document} [doc]
 * @property {() => boolean} [getWrongbookActive]
 * @property {() => boolean} [isDrawerOpen]
 * @property {() => string|null} [getToastLast]
 * @property {() => string[]} [getConfirmAsked]
 * @property {() => string[]} [getPromptAsked]
 * @property {() => string[]} [getDownloads]
 * @property {() => object|null} [getUiSession]
 * @property {() => string} [getHash]
 */

/**
 * @param {ParentNode} [root=document]
 * @param {UiStateAdapter|null} [adapter=null]  iframe 整页采集时必传（同源子窗 LX/doc/hooks）
 * @returns {object}
 */
export function collectUiState(root = document, adapter = null) {
    const LX = adapter?.LX || getLX();
    const currentId = LX.LibraryAPI.current().data;
    const lib = currentId ? LX.LibraryAPI.get(currentId).data : null;
    const summary = currentId
        ? (LX.StatsAPI.summary().data || { total: 0, mastered: 0, review: 0, percent: 0 })
        : { total: 0, mastered: 0, review: 0, percent: 0 };
    const nav = LX.NavigationAPI.current();
    const navData = nav.ok ? nav.data : null;
    const playlist = LX.NavigationAPI.getSearchPlaylist?.() || null;
    const drillActive = !!(LX.DrillAPI && LX.DrillAPI.isActive && LX.DrillAPI.isActive());
    let drill = { active: drillActive, mode: null, index: null, total: null };
    if (drillActive && LX.DrillAPI.current) {
        const s = LX.DrillAPI.current();
        const d = s?.ok ? s.data : null;
        if (d) {
            drill = {
                active: true,
                mode: d.mode ?? null,
                index: d.progressIndex ?? d.viewIndex ?? null,
                total: d.total ?? null,
            };
        }
    }
    const wrongCount = summary.review || 0;

    let wrongbookActive = false;
    if (adapter?.getWrongbookActive) {
        wrongbookActive = !!adapter.getWrongbookActive();
    } else if (adapter) {
        // 有 adapter 却未给 hook：禁止回落父页 getState（避免采到父页错题模式）
        wrongbookActive = false;
    } else {
        wrongbookActive = !!getState().isWrongBookMode;
    }

    const progressTextEl = root.querySelector?.('.lx-progress-text');
    const progressBtn = progressTextEl?.closest?.('button');
    const wrongBtn = root.querySelector?.('[aria-label^="错题本"]');
    const titleText = root.querySelector?.('.lx-topbar__title-text')?.textContent || '';
    const bottombar = root.querySelector?.('.lx-bottombar');
    const clearBtn = bottombar?.querySelector?.('[aria-label="清除标记"]');
    const masteredBtn = bottombar?.querySelector?.('[aria-label*="掌握"]');
    const wrongBarBtn = bottombar?.querySelector?.('[aria-label*="错题"]');

    let uiSession = null;
    if (adapter?.getUiSession) {
        try { uiSession = adapter.getUiSession(); } catch (_) { uiSession = null; }
    } else if (!adapter) {
        try { uiSession = getUiSession(); } catch (_) { uiSession = null; }
    }

    let toastLast = null;
    let confirmAsked = [];
    let promptAsked = [];
    let downloads = [];
    if (adapter) {
        toastLast = adapter.getToastLast ? adapter.getToastLast() : null;
        confirmAsked = adapter.getConfirmAsked ? adapter.getConfirmAsked() : [];
        promptAsked = adapter.getPromptAsked ? adapter.getPromptAsked() : [];
        downloads = adapter.getDownloads ? adapter.getDownloads() : [];
    } else {
        const toastLog = typeof __getToastLogForTest === 'function' ? __getToastLogForTest() : [];
        const confirmLog = typeof __getConfirmLogForTest === 'function' ? __getConfirmLogForTest() : [];
        const promptLog = typeof __getPromptLogForTest === 'function' ? __getPromptLogForTest() : [];
        const downloadLog = typeof __getDownloadLogForTest === 'function' ? __getDownloadLogForTest() : [];
        toastLast = toastLog.length ? toastLog[toastLog.length - 1].message : null;
        confirmAsked = confirmLog.map((e) => e.message);
        promptAsked = promptLog.map((e) => e.message);
        downloads = downloadLog.map((e) => e.filename);
    }

    let drawerOpen = false;
    if (adapter?.isDrawerOpen) {
        drawerOpen = !!adapter.isDrawerOpen();
    } else if (!adapter) {
        drawerOpen = !!isDrawerOpen();
    }

    let hash = '';
    if (adapter?.getHash) {
        hash = adapter.getHash() || '';
    } else if (typeof location !== 'undefined') {
        hash = location.hash || '';
    }

    let currentStatus = 'none';
    if (navData?.qId != null) {
        const qR = LX.QuestionAPI.get(navData.qId);
        if (qR.ok && qR.data) {
            const st = LX.ProgressAPI.getStatus(qR.data);
            if (st.ok) currentStatus = st.data;
        }
    }

    return {
        meta: {
            t: Date.now(),
            hash,
            drawerOpen,
            toastLast,
            confirmAsked,
            promptAsked,
            downloads,
        },
        chrome: {
            progressText: progressTextEl ? (progressTextEl.textContent || '').trim() : '',
            progressAria: progressBtn?.getAttribute?.('aria-label') || '',
            wrongBadge: wrongCount,
            wrongAria: wrongBtn?.getAttribute?.('aria-label') || '',
            libraryTitle: titleText,
            bottombarVisible: !!bottombar,
            bottombar: {
                clearMarkDisabled: clearBtn ? !!clearBtn.disabled : null,
                masteredPressed: masteredBtn?.getAttribute?.('aria-pressed') === 'true',
                wrongPressed: wrongBarBtn?.getAttribute?.('aria-pressed') === 'true',
            },
        },
        domain: {
            currentLibId: currentId,
            libCount: (LX.LibraryAPI.list().data || []).length,
            questionCount: lib?.questions?.length || 0,
            nav: navData
                ? {
                    index: navData.index,
                    total: navData.total,
                    qId: navData.qId ?? navData.question?.uid ?? null,
                    mode: navData.mode,
                    category: navData.category,
                    statusFilter: navData.statusFilter,
                }
                : null,
            progress: {
                mastered: summary.mastered || 0,
                review: summary.review || 0,
                percent: summary.percent || 0,
                currentStatus,
            },
            drill,
            wrongbook: { active: wrongbookActive, count: wrongCount },
            searchPlaylist: playlist && Array.isArray(playlist.uids)
                ? {
                    active: playlist.uids.length > 0,
                    size: playlist.uids.length,
                    keywords: playlist.keywords || [],
                }
                : { active: false, size: 0, keywords: [] },
            uiSession: uiSession
                ? {
                    browseSearch: uiSession.browseSearch || null,
                    practiceSheet: uiSession.practiceSheet || null,
                }
                : null,
        },
        page: {
            practiceModalOpen: !!root.querySelector?.('[aria-label="练习模式设置"]'),
            filterChipCount: root.querySelectorAll?.('.lx-chip').length || 0,
            celebrateVisible: !!root.querySelector?.('.lx-celebrate'),
            catalogItemCount: root.querySelectorAll?.('.lx-catalog-item').length || 0,
            optionCount: root.querySelectorAll?.('.lx-option').length || 0,
            hasProgressText: !!progressTextEl,
            searchDraft: root.querySelector?.('input[aria-label="搜索题干"]')?.value ?? null,
            practiceCountDisabled: (() => {
                const el = root.querySelector?.('[aria-label="本轮题量"]');
                return el ? !!el.disabled : null;
            })(),
            practiceMode: uiSession?.practiceSheet?.mode ?? null,
        },
    };
}

/**
 * 浅路径取值：a.b.c
 * @param {object} obj
 * @param {string} path
 */
function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/**
 * @param {object} before
 * @param {object} after
 * @param {object} expectDelta  只写应变化字段；嵌套对象按叶子比对
 * @param {string[]} [expectUnchanged]
 */
export function assertStateDelta(before, after, expectDelta = {}, expectUnchanged = []) {
    for (const path of expectUnchanged) {
        const a = getPath(before, path);
        const b = getPath(after, path);
        if (JSON.stringify(a) !== JSON.stringify(b)) {
            const e = new Error(`期望不变 ${path}，before=${JSON.stringify(a)} after=${JSON.stringify(b)}`);
            e.actual = b;
            e.expected = a;
            throw e;
        }
    }

    const leaves = flattenLeaves(expectDelta);
    for (const [path, expected] of leaves) {
        if (path.endsWith('Includes') || path.includes('.Includes')) {
            continue;
        }
        if (typeof expected === 'string' && path.endsWith('Includes')) {
            // handled below
        }
        const actual = getPath(after, path);
        if (path.endsWith('Includes') || /Includes$/.test(path.split('.').pop() || '')) {
            const basePath = path.replace(/Includes$/, '');
            const text = String(getPath(after, basePath) ?? '');
            if (!text.includes(String(expected))) {
                const e = new Error(`期望 ${basePath} 包含 ${expected}，实际=${text}`);
                e.actual = text;
                e.expected = expected;
                throw e;
            }
            continue;
        }
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            const e = new Error(`差分失败 ${path}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
            e.actual = actual;
            e.expected = expected;
            throw e;
        }
    }

    // progressTextIncludes 等便捷键
    if (expectDelta.chrome && typeof expectDelta.chrome.progressTextIncludes === 'string') {
        const text = after.chrome?.progressText || '';
        if (!text.includes(expectDelta.chrome.progressTextIncludes)) {
            throw new Error(`期望 progressText 含 ${expectDelta.chrome.progressTextIncludes}，实际=${text}`);
        }
    }
    if (expectDelta.meta && typeof expectDelta.meta.toastLastIncludes === 'string') {
        const t = after.meta?.toastLast || '';
        if (!t.includes(expectDelta.meta.toastLastIncludes)) {
            throw new Error(`期望 toast 含 ${expectDelta.meta.toastLastIncludes}，实际=${t}`);
        }
    }
}

function flattenLeaves(obj, prefix = '') {
    /** @type {Array<[string, any]>} */
    const out = [];
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
        if (prefix) out.push([prefix, obj]);
        return out;
    }
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'progressTextIncludes' || k === 'toastLastIncludes') continue;
        const p = prefix ? `${prefix}.${k}` : k;
        if (v != null && typeof v === 'object' && !Array.isArray(v)) {
            out.push(...flattenLeaves(v, p));
        } else {
            out.push([p, v]);
        }
    }
    return out;
}
