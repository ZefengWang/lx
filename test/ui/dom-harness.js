/**
 * UI DOM 测试基建（挂在 test.html 同源跑）
 * 提供：挂载页面、点击/输入、按文案/aria 查找、断言文本、保护 location.hash
 * 以及 toast/confirm/drawer/download 钩子与 mountShell。
 *
 * 这是按钮级 UI 测试的「土壤」。没有它，页面按钮无法被稳定覆盖。
 * @module test/ui/dom-harness
 */

import { createMountPoint, destroyMountPoint, getLX } from '../helpers.js';
import { register, __setNavigateHookForTest, navigate } from '../../src/render/router.js';
import { h, render } from '../../src/render/dom.js';
import { renderTopbar } from '../../src/render/topbar.js';
import { renderBottombar } from '../../src/render/bottombar.js';
import {
    createDrawer, createOverlay, openDrawer, closeDrawer, renderDrawerContent, isDrawerOpen,
    __setDrawerSinkForTest, __clearDrawerLogForTest, __getDrawerLogForTest,
} from '../../src/render/drawer.js';
import {
    __setToastSinkForTest, __clearToastLogForTest, __getToastLogForTest,
} from '../../src/render/toast.js';
import {
    __setConfirmForTest, __clearConfirmLogForTest, __getConfirmLogForTest,
} from '../../src/render/confirm.js';
import {
    __setPromptForTest, __clearPromptLogForTest, __getPromptLogForTest,
} from '../../src/render/prompt.js';
import {
    __setDownloadSinkForTest, __clearDownloadLogForTest, __getDownloadLogForTest,
} from '../../src/render/download.js';
import { toastInfo, toastSuccess, toastWarning } from '../../src/render/toast.js';
import { appConfirm } from '../../src/render/confirm.js';
import { appPrompt } from '../../src/render/prompt.js';

/**
 * @typedef {{ render: (el: HTMLElement) => void, onLeave?: () => void }} PageView
 */

let _routesReady = false;

/** @type {Array<{ name: string, params: object }>} */
let _navLog = [];
let _navSpyOn = false;

/**
 * test.html 无 #app，不会 initUI/register 路由。
 * 页面里的 navigate() 依赖 routes 表；单测挂载前必须先注册，否则 hash 不会变。
 */
export function ensureTestRoutes() {
    if (_routesReady) return;
    const noop = () => ({ render() {} });
    const table = [
        ['home', '#/'],
        ['study', '#/study'],
        ['wrong', '#/wrong'],
        ['stats', '#/stats'],
        ['settings', '#/settings'],
        ['browse', '#/browse'],
        ['catalog', '#/catalog'],
        ['add-question', '#/add-question'],
        ['help', '#/help'],
    ];
    for (const [name, pattern] of table) {
        register(name, pattern, noop);
    }
    _routesReady = true;
}

/**
 * 安装 navigate 钩子，记录调用序列。返回卸载函数。
 * 比断言 location.hash 更可靠：直接观测「意图」。
 */
export function installNavigateSpy() {
    _navLog = [];
    __setNavigateHookForTest((name, params) => {
        _navLog.push({ name, params: params || {} });
    });
    _navSpyOn = true;
    return () => {
        __setNavigateHookForTest(null);
        _navLog = [];
        _navSpyOn = false;
    };
}

/**
 * mountPage / mountShell 时启用钩子并清空日志。
 * 必须「每次重新钉死」回调：router-hook 等套件 afterEach 会 __setNavigateHookForTest(null)，
 * 但本模块 _navSpyOn 仍可能为 true（跨「运行全部」残留）。若只 clear 日志不重绑，
 * 第二次点运行会出现整整一批「钩子未记录到任何 navigate」（实测 16 条）。
 */
function ensureNavigateSpy() {
    if (!_navSpyOn) {
        installNavigateSpy();
        return;
    }
    __setNavigateHookForTest((name, params) => {
        _navLog.push({ name, params: params || {} });
    });
    clearNavigateLog();
}

/**
 * 每次「运行全部」开始时调用：清跨轮次残留，避免二次运行假绿/连环失败。
 */
export function resetHarnessForFullRun() {
    _navSpyOn = false;
    _navLog = [];
    _routesReady = false;
    __setNavigateHookForTest(null);
    if (typeof window !== 'undefined') {
        window.__lxPrevConfirmForTest = null;
    }
}

/** @returns {Array<{ name: string, params: object }>} */
export function getNavigateLog() {
    return _navLog.slice();
}

export function clearNavigateLog() {
    _navLog = [];
}

/**
 * 断言最近一次（或历史上）调用了 navigate(name)
 * @param {string} name
 * @param {{ last?: boolean }} [opts] last=true 只看最后一次（默认 true）
 */
export function assertNavigatedTo(name, opts = {}) {
    const lastOnly = opts.last !== false;
    const log = _navLog;
    if (!log.length) {
        const e = new Error(`期望 navigate('${name}')，但钩子未记录到任何 navigate`);
        e.actual = [];
        e.expected = name;
        throw e;
    }
    if (lastOnly) {
        const last = log[log.length - 1];
        if (last.name !== name) {
            const e = new Error(`期望最后一次 navigate('${name}')，实际 '${last.name}'；全程=${JSON.stringify(log.map((x) => x.name))}`);
            e.actual = last.name;
            e.expected = name;
            throw e;
        }
        return;
    }
    if (!log.some((x) => x.name === name)) {
        const e = new Error(`期望曾 navigate('${name}')，实际序列=${JSON.stringify(log.map((x) => x.name))}`);
        e.actual = log.map((x) => x.name);
        e.expected = name;
        throw e;
    }
}

/**
 * 挂载页面工厂，返回 { root, page, destroy }
 * @param {() => PageView} factory
 */
export function mountPage(factory) {
    ensureTestRoutes();
    ensureNavigateSpy();
    const root = createMountPoint();
    const page = factory();
    page.render(root);
    return {
        root,
        page,
        destroy() {
            try {
                if (page && typeof page.onLeave === 'function') page.onLeave();
            } catch (_) { /* ignore */ }
            destroyMountPoint(root);
        },
    };
}

/**
 * 在根节点下按可见文本查找可点击元素（button / [role=button] / a / label）
 * @param {ParentNode} root
 * @param {string|RegExp} text
 * @returns {HTMLElement}
 */
export function findByText(root, text) {
    const match = (s) => {
        const t = (s || '').replace(/\s+/g, ' ').trim();
        if (!t) return false;
        if (typeof text === 'string') return t.includes(text);
        return text.test(t);
    };
    const candidates = root.querySelectorAll('button, [role="button"], a, label, .lx-list__item, .lx-catalog-item, .lx-toolbar__btn, .lx-button, .lx-button--bar, .lx-button--text, .lx-button--primary, .lx-button--secondary, .lx-button--ghost, .lx-button--block, .lx-button--success');
    for (const el of candidates) {
        if (match(el.textContent)) return /** @type {HTMLElement} */ (el);
    }
    // 兜底：任意元素
    const all = root.querySelectorAll('*');
    for (const el of all) {
        if (el.children.length === 0 && match(el.textContent)) {
            const clickable = el.closest('button, [role="button"], a, .lx-list__item, .lx-catalog-item');
            if (clickable) return /** @type {HTMLElement} */ (clickable);
        }
    }
    throw new Error(`findByText: 未找到文本 ${text}`);
}

/**
 * @param {ParentNode} root
 * @param {string|RegExp} label aria-label
 */
export function findByLabel(root, label) {
    const all = root.querySelectorAll('[aria-label]');
    for (const el of all) {
        const v = el.getAttribute('aria-label') || '';
        if (typeof label === 'string' ? v.includes(label) : label.test(v)) {
            return /** @type {HTMLElement} */ (el);
        }
    }
    throw new Error(`findByLabel: 未找到 aria-label ${label}`);
}

/**
 * 触发真实 DOM 点击（走 addEventListener('click')）
 * @param {Element} el
 */
export function click(el) {
    if (!el) throw new Error('click: 元素为空');
    // 优先原生 click()（更接近用户）；再补发事件以防个别环境只听监听器
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

/**
 * @param {ParentNode} root
 * @param {string|RegExp} text
 */
export function clickText(root, text) {
    click(findByText(root, text));
}

/**
 * @param {ParentNode} root
 * @param {string|RegExp} label
 */
export function clickLabel(root, label) {
    click(findByLabel(root, label));
}

/**
 * 输入并触发 input 事件（适配 h() 的 oninput）
 * @param {HTMLInputElement|HTMLTextAreaElement} el
 * @param {string} value
 */
export function type(el, value) {
    if (!el) throw new Error('type: 元素为空');
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * @param {Element|Document} target
 * @param {string} key
 * @param {object} [opts]
 */
export function pressKey(target, key, opts = {}) {
    const init = {
        key,
        code: opts.code || key,
        bubbles: true,
        cancelable: true,
        ...opts,
    };
    target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
}

/**
 * @param {ParentNode} root
 * @param {string|RegExp} text
 * @param {string} [msg]
 */
export function assertTextIncludes(root, text, msg) {
    const body = (root.textContent || '').replace(/\s+/g, ' ');
    const ok = typeof text === 'string' ? body.includes(text) : text.test(body);
    if (!ok) {
        const e = new Error(msg || `期望文本包含 ${text}，实际片段：${body.slice(0, 200)}`);
        e.actual = body.slice(0, 500);
        e.expected = String(text);
        throw e;
    }
}

/**
 * 保护 test.html 自身 hash：用例里 navigate() 会改 location.hash
 * @returns {() => void} restore
 */
export function preserveHash() {
    const prev = location.hash;
    return () => {
        if (location.hash !== prev) location.hash = prev;
    };
}

/**
 * 等待微任务/定时器（搜索防抖 200ms 等）
 * @param {number} ms
 */
export function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 断言当前 hash 路由（副作用；优先用 assertNavigatedTo）
 * @param {string} name study/home/help/...
 */
export function assertHashRoute(name) {
    const expected = name === 'home' || name === '' ? '#/' : `#/${name}`;
    const actual = location.hash || '#/';
    const norm = (h) => (h === '#' || h === '' ? '#/' : h);
    if (norm(actual) !== expected) {
        const e = new Error(`期望 hash=${expected}，实际 ${actual}`);
        e.actual = actual;
        e.expected = expected;
        throw e;
    }
}

// —— 副作用钩子（toast / confirm / drawer / download）——

/** 安装 toast sink（跳过 DOM），返回卸载 */
export function installToastSpy() {
    __clearToastLogForTest();
    __setToastSinkForTest(() => {});
    return () => {
        __setToastSinkForTest(null);
        __clearToastLogForTest();
    };
}

export function getToastLog() {
    return __getToastLogForTest();
}

export function clearToastLog() {
    __clearToastLogForTest();
}

/**
 * @param {string|RegExp} text
 * @param {{ type?: string, last?: boolean }} [opts]
 */
export function assertToastIncludes(text, opts = {}) {
    const log = __getToastLogForTest();
    const lastOnly = opts.last !== false;
    const pick = lastOnly && log.length ? [log[log.length - 1]] : log;
    const ok = pick.some((e) => {
        const msgOk = typeof text === 'string' ? e.message.includes(text) : text.test(e.message);
        const typeOk = !opts.type || e.type === opts.type;
        return msgOk && typeOk;
    });
    if (!ok) {
        const e = new Error(`期望 toast 含 ${text}${opts.type ? ` type=${opts.type}` : ''}，实际=${JSON.stringify(log)}`);
        e.actual = log;
        e.expected = String(text);
        throw e;
    }
}

/**
 * @param {boolean|((msg: string) => boolean)} [impl=true]
 * @returns {() => void} 卸载时恢复为「上一层钩子」（默认 true），禁止卸成 null 导致回落原生 confirm 弹窗
 */
export function installConfirmSpy(impl = true) {
    __clearConfirmLogForTest();
    const prev = typeof window !== 'undefined' ? window.__lxPrevConfirmForTest : null;
    const fn = typeof impl === 'function' ? impl : () => !!impl;
    // 记下当前钩子以便嵌套恢复（简单栈：只保一层，满足套件内临时 false）
    if (typeof window !== 'undefined') {
        window.__lxPrevConfirmForTest = fn;
    }
    __setConfirmForTest(fn);
    return () => {
        // 恢复为「始终同意」，避免后续用例弹原生对话框被人工点「取消」→ 整套 16 条连环失败
        __setConfirmForTest(() => true);
        if (typeof window !== 'undefined') {
            window.__lxPrevConfirmForTest = prev;
        }
        __clearConfirmLogForTest();
    };
}

export function getConfirmLog() {
    return __getConfirmLogForTest();
}

export function assertConfirmAsked(text) {
    const log = __getConfirmLogForTest();
    const ok = log.some((e) => (typeof text === 'string' ? e.message.includes(text) : text.test(e.message)));
    if (!ok) {
        const e = new Error(`期望 confirm 含 ${text}，实际=${JSON.stringify(log)}`);
        e.actual = log;
        e.expected = String(text);
        throw e;
    }
}

/**
 * @param {string|null|((msg: string, def: string) => string|null)} [impl]
 */
export function installPromptSpy(impl = '测试题库') {
    __clearPromptLogForTest();
    const fn = typeof impl === 'function' ? impl : () => impl;
    __setPromptForTest(fn);
    return () => {
        // 恢复为安全默认，禁止卸成 null 弹原生 prompt
        __setPromptForTest((_msg, def) => (def == null ? '' : String(def)));
        __clearPromptLogForTest();
    };
}

export function getPromptLog() {
    return __getPromptLogForTest();
}

export function installDrawerSpy() {
    __clearDrawerLogForTest();
    __setDrawerSinkForTest(() => {});
    return () => {
        __setDrawerSinkForTest(null);
        __clearDrawerLogForTest();
    };
}

export function getDrawerLog() {
    return __getDrawerLogForTest();
}

export function assertDrawerOpen(expected = true) {
    const open = !!isDrawerOpen();
    if (open !== !!expected) {
        const e = new Error(`期望抽屉 open=${expected}，实际 ${open}；log=${JSON.stringify(__getDrawerLogForTest())}`);
        e.actual = open;
        e.expected = expected;
        throw e;
    }
}

export function installDownloadSpy() {
    __clearDownloadLogForTest();
    __setDownloadSinkForTest(() => {});
    return () => {
        __setDownloadSinkForTest(null);
        __clearDownloadLogForTest();
    };
}

export function getDownloadLog() {
    return __getDownloadLogForTest();
}

export function assertDownloaded(filenamePart) {
    const log = __getDownloadLogForTest();
    const ok = log.some((e) => e.filename.includes(filenamePart));
    if (!ok) {
        const e = new Error(`期望下载含 ${filenamePart}，实际=${JSON.stringify(log.map((x) => x.filename))}`);
        e.actual = log.map((x) => x.filename);
        e.expected = filenamePart;
        throw e;
    }
}

/**
 * 挂载与 main-ui 等价接线的壳层（顶栏 + 底栏槽 + 抽屉），不启动路由。
 * 接线逻辑与 main-ui.refreshTopbar / refreshDrawer / refreshBottombar 对齐。
 * @param {{ routeName?: string, showBottombar?: boolean }} [opts]
 */
export function mountShell(opts = {}) {
    ensureTestRoutes();
    ensureNavigateSpy();
    const uninstallToast = installToastSpy();
    const uninstallConfirm = installConfirmSpy(true);
    const uninstallPrompt = installPromptSpy('壳层测试题库');
    const uninstallDrawer = installDrawerSpy();
    const uninstallDownload = installDownloadSpy();

    const LX = getLX();
    const root = createMountPoint();
    root.setAttribute('data-lx-shell', '1');
    render(root, [
        h('div', { id: 'lx-topbar-slot' }),
        h('main', { class: 'lx-main', id: 'lx-main', role: 'main' }),
        h('div', { id: 'lx-bottombar-slot' }),
        createOverlay(),
        createDrawer(),
    ]);

    let routeName = opts.routeName || 'study';

    function refreshTopbar() {
        const slot = root.querySelector('#lx-topbar-slot');
        if (!slot) return;
        const libsR = LX.LibraryAPI.list();
        const libs = libsR.ok ? libsR.data : [];
        const currentId = LX.LibraryAPI.current().data;
        const current = currentId ? LX.LibraryAPI.get(currentId).data : null;
        const summary = current ? LX.StatsAPI.summary().data : { total: 0, mastered: 0, review: 0, percent: 0 };
        const wrongCount = summary.review || 0;
        render(slot, [
            renderTopbar({
                routeName,
                libraryName: current?.name || '未选择题库',
                wrongCount,
                masteredCount: summary.mastered,
                totalCount: summary.total,
                percent: summary.percent,
                onMenu: () => {
                    if (isDrawerOpen()) closeDrawer('menu-toggle');
                    else openDrawer('menu');
                },
                onBack: () => navigate('study'),
                onLibraryClick: () => navigate('settings'),
                onWrongClick: () => {
                    if (wrongCount === 0) {
                        toastInfo('当前没有错题');
                        return;
                    }
                    navigate('wrong');
                },
                onProgressClick: () => navigate('stats'),
            }),
        ]);
    }

    function refreshBottombar() {
        const slot = root.querySelector('#lx-bottombar-slot');
        if (!slot) return;
        const show = opts.showBottombar !== false && routeName === 'study';
        if (!show) {
            render(slot, []);
            return;
        }
        const currentId = LX.LibraryAPI.current().data;
        if (!currentId) {
            render(slot, []);
            return;
        }
        const navR = LX.NavigationAPI.current();
        const nav = navR.ok ? navR.data : null;
        const q = nav?.qId ? LX.QuestionAPI.get(nav.qId).data : null;
        const statusR = q ? LX.ProgressAPI.getStatus(q) : { ok: false };
        const status = statusR.ok ? statusR.data : 'none';
        render(slot, [
            renderBottombar({
                canPrev: true,
                canNext: true,
                isMastered: status === 'mastered',
                isWrong: status === 'review',
                canReset: status !== 'none',
                onReset: () => {
                    if (!q) return;
                    LX.ProgressAPI.setStatus(q, 'none');
                },
                onMastered: () => {
                    if (!q) return;
                    LX.ProgressAPI.setStatus(q, status === 'mastered' ? 'none' : 'mastered');
                },
                onWrong: () => {
                    if (!q) return;
                    LX.ProgressAPI.setStatus(q, status === 'review' ? 'none' : 'review');
                },
                onPrev: () => LX.NavigationAPI.prev(),
                onCatalog: () => navigate('browse'),
                onNext: () => LX.NavigationAPI.next(),
            }),
        ]);
    }

    function refreshDrawer() {
        const libsR = LX.LibraryAPI.list();
        const libs = libsR.ok ? libsR.data : [];
        const currentId = LX.LibraryAPI.current().data;
        renderDrawerContent({
            libraries: libs.map((lib) => ({
                id: lib.id,
                name: lib.name,
                questionCount: lib.questionCount,
            })),
            currentLibId: currentId,
            onSwitchLib: (libId) => {
                LX.LibraryAPI.switch(libId);
                closeDrawer('switch-lib');
                navigate('study');
            },
            onImportLibrary: () => {
                closeDrawer('import');
                navigate('settings');
            },
            onCreateLibrary: () => {
                closeDrawer('create');
                const name = appPrompt('请输入新题库名称：', '我的题库');
                if (name == null) return;
                const trimmed = String(name).trim();
                if (!trimmed) {
                    toastWarning('题库名不能为空');
                    return;
                }
                const r = LX.LibraryAPI.create(trimmed, [], { skipDuplicateCheck: true });
                if (!r.ok) {
                    toastWarning(`创建失败：${r.error?.message || '未知错误'}`);
                    return;
                }
                LX.LibraryAPI.switch(r.data.id);
                toastSuccess(`已创建空题库「${trimmed}」，现在可以添加题目了`);
                navigate('add-question');
            },
            onDeleteLibrary: () => {
                closeDrawer('delete');
                navigate('settings');
            },
            onExportLibrary: () => {
                closeDrawer('export');
                navigate('settings');
            },
            onExportProgress: () => {
                closeDrawer('export-progress');
                navigate('settings');
            },
            onImportProgress: () => {
                closeDrawer('import-progress');
                navigate('settings');
            },
            onResetProgress: () => {
                if (!appConfirm('确定要重置当前题库的所有学习进度吗？此操作不可撤销。')) return;
                const r = LX.ProgressAPI.reset();
                if (r.ok) {
                    toastInfo('进度已重置');
                    closeDrawer('reset');
                }
            },
            onAbout: () => {
                closeDrawer('about');
                navigate('settings');
            },
            onHelp: () => {
                closeDrawer('help');
                navigate('help');
            },
        });
    }

    function refresh() {
        refreshTopbar();
        refreshBottombar();
        refreshDrawer();
    }

    // 与 main-ui 对齐：进度/题库变化自动刷顶栏（含 PROGRESS_RESET → lx-progress-text）
    const shellEvents = [
        LX.Events.LIBRARY_SWITCHED,
        LX.Events.LIBRARY_CREATED,
        LX.Events.LIBRARY_DELETED,
        LX.Events.QUESTION_STATUS_CHANGED,
        LX.Events.NAVIGATION_CHANGED,
        LX.Events.PROGRESS_UPDATED,
        LX.Events.PROGRESS_RESET,
        LX.Events.WRONGBOOK_ENTERED,
        LX.Events.WRONGBOOK_EXITED,
    ];
    const unsubs = shellEvents.map((evt) => LX.on(evt, () => refresh()));

    refresh();

    return {
        root,
        refresh,
        setRoute(name) {
            routeName = name;
            refresh();
        },
        destroy() {
            for (const off of unsubs) {
                try { off(); } catch (_) { /* ignore */ }
            }
            try { closeDrawer('destroy'); } catch (_) { /* ignore */ }
            destroyMountPoint(root);
            uninstallToast();
            uninstallConfirm();
            uninstallPrompt();
            uninstallDrawer();
            uninstallDownload();
            document.body.style.overflow = '';
        },
    };
}
