/**
 * iframe 整页采集协议：同源加载 app.html?test=1，对 iframe 内 #app 采状态。
 * 与父页双 LX + 共享 localStorage：每 case 在 iframe 内 TestAPI.reset + 建数据，必要时 reload。
 *
 * @module test/system/app-iframe-harness
 */

import { clickLabel, clickText, wait } from '../ui/dom-harness.js';

const IFRAME_ID = 'lxSarAppIframe';
/** 相对路径（兼容旧调用）；实际加载用 appSrc() 绝对地址 */
const APP_SRC = './app.html?test=1';

/** @param {{ bust?: boolean }} [opts] */
function appSrc(opts = {}) {
    try {
        const u = new URL('app.html', typeof location !== 'undefined' ? location.href : 'http://localhost/');
        u.searchParams.set('test', '1');
        if (opts.bust) u.searchParams.set('_sar', String(Date.now()));
        return u.href;
    } catch (_) {
        return opts.bust ? `${APP_SRC}&_sar=${Date.now()}` : APP_SRC;
    }
}

/**
 * 已切到 iframe 整页协议的 controlId（其余仍 mountShell）。
 * 文档与 matrix 统计共用此集合。
 */
export const IFRAME_CONTROL_IDS = new Set([
    // topbar / bottombar
    'topbar.back',
    'topbar.menu',
    'topbar.libraryTitle',
    'topbar.wrongBook',
    'topbar.progress',
    'bottombar.clearMark',
    'bottombar.mastered',
    'bottombar.wrong',
    'bottombar.prev',
    'bottombar.next',
    'bottombar.browse',
    // drawer.*
    'drawer.close',
    'drawer.overlay',
    'drawer.esc',
    'drawer.libRow',
    'drawer.importLibrary',
    'drawer.createLibrary',
    'drawer.deleteLibrary',
    'drawer.viewStats',
    'drawer.exportLibrary',
    'drawer.exportProgress',
    'drawer.importProgress',
    'drawer.resetProgress',
    'drawer.help',
    'drawer.about',
    // shell / surface
    'shell.openDrawerEvent',
    'shell.closeDrawerEvent',
    'confirm.appConfirm',
    'prompt.appPrompt',
    'toast.surface',
    'download.triggerBlobDownload',
    // home / study / card
    'home.openHelp',
    'home.libRow',
    'home.startStudy',
    'study.empty.uploadCta',
    'study.finished.gotoFirst',
    'study.gesture.swipe',
    'study.gesture.keyboard',
    'study.gesture.backGuard',
    'card.statusBadge',
    'card.option',
    'card.multiConfirm',
    'card.judge.true',
    'card.judge.false',
    'card.fill.input',
    'card.fill.confirm',
    'card.essay.textarea',
    'card.essay.skipToExplain',
    'card.essay.confirm',
    'card.essay.panelToggle',
    'card.essay.tab',
    'card.essay.addAnswerText',
    'card.essay.editAnswerText',
    'card.essay.editTextarea',
    'card.essay.cancelEdit',
    'card.essay.saveAnswerText',
    // wrong.*
    'wrong.markMastered',
    'wrong.celebration.home',
    'wrong.exit',
    'wrong.next',
    'wrong.gesture.swipe',
    'wrong.gesture.keyboard',
    'wrong.card.reuse',
    // settings.*
    'settings.fileInput.library',
    'settings.fileInput.progress',
    'settings.lib.switch',
    'settings.lib.delete',
    'settings.uploadLibrary',
    'settings.exportProgress',
    'settings.importProgressBtn',
    'settings.resetProgress',
    'settings.export.json',
    'settings.export.xlsx',
    'settings.export.csv',
    'settings.downloadTemplate',
    'settings.theme',
    'settings.mode',
    'settings.openHelp',
    // browse.*
    'browse.backStudy',
    'browse.addQuestion',
    'browse.search.input',
    'browse.search.submit',
    'browse.search.chipDismiss',
    'browse.toolbar.modeToggle',
    'browse.toolbar.reshuffle',
    'browse.toolbar.clearCategory',
    'browse.toolbar.collapseAll',
    'browse.toolbar.expandAll',
    'browse.practice.open',
    'browse.practice.hint',
    'browse.practice.overlayClose',
    'browse.practice.closeX',
    'browse.practice.mode.memory',
    'browse.practice.mode.quick',
    'browse.practice.countInput',
    'browse.practice.cancel',
    'browse.practice.start',
    'browse.categoryHeader',
    'browse.practiceCategory',
    'browse.questionRow',
    'browse.search.sentinel',
    'browse.empty.goHome',
    // addq.* / help.*
    'addq.backBrowse',
    'addq.type',
    'addq.category',
    'addq.question',
    'addq.optionCheck',
    'addq.optionText',
    'addq.optionRemove',
    'addq.addOption',
    'addq.judge.true',
    'addq.judge.false',
    'addq.fill.answer',
    'addq.essay.answerText',
    'addq.explanation',
    'addq.cancel',
    'addq.save',
    'addq.noLib.goSettings',
    'help.goStudy.quickStart',
    'help.goSettings',
    'help.goStudy.footer',
]);

export function usesIframeHarness(controlId) {
    return IFRAME_CONTROL_IDS.has(controlId);
}

/**
 * @param {HTMLIFrameElement} iframe
 * @param {number} [timeoutMs]
 */
export async function waitForIframeLX(iframe, timeoutMs = 20000) {
    const t0 = Date.now();
    let last = 'no-window';
    while (Date.now() - t0 < timeoutMs) {
        try {
            const win = iframe.contentWindow;
            const doc = iframe.contentDocument;
            if (!win || !doc) {
                last = 'no-contentDocument';
            } else if (!win.LX) {
                last = 'no-LX';
            } else if (!win.LX.TestAPI) {
                last = 'no-TestAPI（需要 app.html?test=1）';
            } else if (typeof win.LX.TestAPI.probeUi !== 'function') {
                last = 'TestAPI.probeUi 缺失（模块半载或非 test 模式）';
            } else if (!doc.querySelector('#app')) {
                last = 'no-#app';
            } else if (!doc.querySelector('#lx-main')) {
                // #lx-main = 应用主内容区 DOM id（lx- 前缀 + main），不是仓库目录名
                last = '主内容区 #lx-main 未挂载（initUI 未完成）'
            } else {
                return win.LX;
            }
        } catch (_) {
            last = 'cross-origin-transient';
        }
        await wait(50);
    }
    const src = iframe.getAttribute('src') || '';
    throw new Error(`ensureAppIframe: iframe 未就绪 (${last}) src=${src}`);
}

/**
 * 展开 test.html「应用预览」，滚入视口，并挂上 LIVE 高亮。
 */
export function revealAppPreviewForSar() {
    const panel = document.getElementById('appPreviewPanel');
    if (panel) {
        panel.classList.remove('is-collapsed');
        panel.classList.add('app-preview--sar-live');
        const twist = document.getElementById('appPreviewTwist');
        if (twist) twist.textContent = '▾';
        const head = document.getElementById('appPreviewToggle');
        if (head) head.setAttribute('aria-expanded', 'true');
        try {
            panel.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        } catch (_) { /* ignore */ }
    }
    const meta = document.getElementById('appPreviewMeta');
    if (meta) meta.textContent = 'SAR LIVE · 正在驱动本预览 iframe（非屏外隐藏框）';
    ensurePreviewHud();
}

/** 父页 HUD：即使用户看不清 iframe 内像素，也能看见 hash/进度在变 */
function ensurePreviewHud() {
    let hud = document.getElementById('appPreviewSarHud');
    if (hud) return hud;
    const body = document.querySelector('#appPreviewPanel .app-preview__body');
    if (!body) return null;
    hud = document.createElement('div');
    hud.id = 'appPreviewSarHud';
    hud.setAttribute('aria-live', 'polite');
    hud.style.cssText = [
        'margin:0 0 10px',
        'padding:10px 12px',
        'border-radius:8px',
        'border:2px solid #34d399',
        'background:#064e3b',
        'color:#ecfdf5',
        'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
        'white-space:pre-wrap',
        'word-break:break-all',
    ].join(';');
    hud.textContent = 'SAR HUD：等待第一次操作…';
    const frame = document.getElementById('appPreview');
    if (frame && frame.parentNode === body) {
        body.insertBefore(hud, frame);
    } else {
        body.insertBefore(hud, body.firstChild);
    }
    return hud;
}

/**
 * 把「正在驱动的 iframe」状态刷到预览区 HUD（证明打的就是你看见的框）。
 * @param {HTMLIFrameElement} iframe
 * @param {string} [action]
 */
export function syncPreviewHud(iframe, action = '') {
    if (!iframe || iframe.id !== 'appPreview') {
        const hud = document.getElementById('appPreviewSarHud');
        if (hud) {
            hud.style.borderColor = '#f87171';
            hud.style.background = '#7f1d1d';
            hud.textContent = `SAR 警告：当前驱动的是 ${iframe?.id || 'null'}，不是 #appPreview！`;
        }
        return;
    }
    // 只保证展开，避免每次 collect 都 scrollIntoView 抢焦点
    const panel = document.getElementById('appPreviewPanel');
    if (panel) {
        panel.classList.remove('is-collapsed');
        panel.classList.add('app-preview--sar-live');
    }
    const hud = ensurePreviewHud();
    const hashLabel = document.getElementById('previewHashLabel');
    let hash = '';
    let progress = '';
    let title = '';
    let mainHint = '';
    try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        hash = win?.location?.hash || '';
        progress = (doc?.querySelector?.('.lx-progress-text')?.textContent || '').trim();
        title = (doc?.querySelector?.('.lx-topbar__title-text')?.textContent || '').trim();
        const main = doc?.querySelector?.('#lx-main');
        mainHint = (main?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    } catch (_) { /* ignore */ }
    if (hashLabel) hashLabel.textContent = `hash: ${hash || '—'} · ${progress || '无进度'}`;
    if (hud) {
        hud.style.borderColor = '#34d399';
        hud.style.background = '#064e3b';
        hud.textContent = [
            `iframe#${iframe.id} ← 就是下面这个框`,
            `action: ${action || '—'}`,
            `hash: ${hash || '—'}`,
            `progress: ${progress || '—'}`,
            `lib: ${title || '—'}`,
            `main: ${mainHint || '—'}`,
        ].join('\n');
    }
    // 闪一下边框，方便肉眼确认「刚动过」
    try {
        iframe.style.outline = '3px solid #34d399';
        iframe.style.outlineOffset = '2px';
        clearTimeout(syncPreviewHud._t);
        syncPreviewHud._t = setTimeout(() => {
            try { iframe.style.outline = ''; } catch (_) { /* ignore */ }
        }, 180);
    } catch (_) { /* ignore */ }
    if (typeof window !== 'undefined') {
        window.__LX_SAR_IFRAME__ = { id: iframe.id, src: iframe.getAttribute('src'), hash, progress };
    }
}

/**
 * 人眼观察节奏：手动打开 test.html 时稍慢；autorun/无头保持快。
 */
export function sarWatchPace() {
    if (!document.getElementById('appPreviewPanel')) return 25;
    try {
        if (new URLSearchParams(location.search).get('autorun')) return 25;
    } catch (_) { /* ignore */ }
    return 160;
}

/**
 * 加载 `app.html?test=1` 供 SAR 采集。
 * test.html 下**强制**使用可见 `#appPreview`。
 * @param {{ forceReload?: boolean, src?: string }} [opts]
 * @returns {Promise<HTMLIFrameElement>}
 */
export async function ensureAppIframe(opts = {}) {
    const hasPreviewUi = !!document.getElementById('appPreviewPanel');
    revealAppPreviewForSar();

    // 有预览 UI 时卸掉旧隐藏框，避免双开抢存储 / 测错窗
    const orphan = document.getElementById(IFRAME_ID);
    if (hasPreviewUi && orphan) {
        try { orphan.remove(); } catch (_) { /* ignore */ }
    }

    let iframe = hasPreviewUi
        ? document.getElementById('appPreview')
        : (document.getElementById(IFRAME_ID) || null);

    if (hasPreviewUi && !iframe) {
        throw new Error('ensureAppIframe: test.html 缺少 #appPreview');
    }
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = IFRAME_ID;
        iframe.title = 'lx app iframe harness';
        iframe.setAttribute('data-lx-iframe-harness', '1');
        iframe.style.cssText = 'position:fixed;width:390px;height:720px;left:-12000px;top:0;border:0;opacity:0;pointer-events:none;';
        document.body.appendChild(iframe);
    }

    if (iframe.id === 'appPreview') {
        // 只清屏外定位，保留 CSS 类控制的宽高
        iframe.style.position = '';
        iframe.style.left = '';
        iframe.style.top = '';
        iframe.style.opacity = '1';
        iframe.style.pointerEvents = 'auto';
        iframe.setAttribute('data-lx-iframe-harness', '1');
    }

    const tryReady = async (force) => {
        const src = opts.src || appSrc({ bust: !!force });
        const cur = iframe.getAttribute('src') || '';
        const hasTestFlag = cur.includes('test=1');
        const alive = (() => {
            try {
                const api = iframe.contentWindow?.LX?.TestAPI;
                return !!(
                    api
                    && typeof api.probeUi === 'function'
                    && iframe.contentDocument?.querySelector('#lx-main')
                );
            } catch (_) {
                return false;
            }
        })();
        const needLoad = force
            || opts.forceReload
            || !alive
            || !cur
            || cur === 'about:blank'
            || !cur.includes('app.html')
            || !hasTestFlag;

        if (needLoad) {
            await loadIframe(iframe, src);
        } else {
            await waitForIframeLX(iframe);
        }
        installIframeTestHooks(iframe);
        syncPreviewHud(iframe, needLoad ? 'load' : 'reuse');
    };

    try {
        await tryReady(false);
    } catch (e1) {
        // 同 src 不触发 load / 半残状态：强制 blank + cache-bust 再来一次
        try {
            await tryReady(true);
        } catch (e2) {
            const msg = (e2 && e2.message) || String(e2);
            const msg1 = (e1 && e1.message) || String(e1);
            throw new Error(`${msg} | 首次: ${msg1}`);
        }
    }
    return iframe;
}

/**
 * 先 about:blank 再赋 src，避免「同 URL 不触发 load」导致假就绪。
 * @param {HTMLIFrameElement} iframe
 * @param {string} src
 */
export async function loadIframe(iframe, src) {
    const waitLoad = (timeoutMs, label) => new Promise((resolve, reject) => {
        let settled = false;
        const finish = (err) => {
            if (settled) return;
            settled = true;
            iframe.removeEventListener('load', onLoad);
            clearTimeout(timer);
            if (err) reject(err);
            else resolve();
        };
        const onLoad = () => finish(null);
        const timer = setTimeout(() => finish(new Error(`iframe load timeout (${label}): ${src}`)), timeoutMs);
        iframe.addEventListener('load', onLoad);
    });

    // 1) 卸掉旧文档
    const blankWait = waitLoad(8000, 'blank');
    iframe.setAttribute('src', 'about:blank');
    try {
        await blankWait;
    } catch (_) { /* 部分浏览器对 about:blank 不派 load，忽略 */ }
    await wait(30);

    // 2) 加载真入口
    const appWait = waitLoad(25000, 'app');
    iframe.setAttribute('src', src);
    await appWait;

    await waitForIframeLX(iframe);
    installIframeTestHooks(iframe);
}

function installIframeTestHooks(iframe) {
    try {
        const win = iframe.contentWindow;
        if (!win) return;
        win.confirm = () => true;
        win.prompt = (_m, def) => (def == null ? '' : String(def));
        if (win.LX?.TestAPI?._enableAutoConfirm) {
            win.LX.TestAPI._enableAutoConfirm();
        }
    } catch (_) { /* ignore */ }
}

/**
 * 在 iframe 的 LX 上 reset + 建库。
 * 默认 **不** reload（靠 API 事件 + navigate 刷新 UI，避免矩阵 30+ case 超时）；
 * `opts.reload=true` 时整页重载以从 storage 重水合。
 * @param {(LX: object, iframe: HTMLIFrameElement) => (void|Promise<void>)} seedFn
 * @param {{ reload?: boolean, hash?: string }} [opts]
 */
export async function resetAndSeedInIframe(seedFn, opts = {}) {
    const reload = opts.reload === true;
    const iframe = await ensureAppIframe({ forceReload: false });
    const win = iframe.contentWindow;
    const LX = win.LX;

    // 父页也 reset：共享 localStorage，避免父页内存/存储分叉影响后续 mountShell 用例
    try {
        if (window.LX?.TestAPI) {
            window.LX.TestAPI._enableAutoConfirm();
            window.LX.TestAPI.reset();
        }
    } catch (_) { /* ignore */ }

    installIframeTestHooks(iframe);
    LX.TestAPI.reset();

    try {
        const sess = await importIframeModule(iframe, 'src/render/session/index.js');
        sess.__resetUiSessionForTest?.();
    } catch (_) { /* ignore */ }

    if (seedFn) await seedFn(LX, iframe);

    const hash = opts.hash || '#/study';
    const target = hash.startsWith('#') ? hash : `#${hash}`;

    if (reload) {
        await loadIframe(iframe, APP_SRC);
        await waitForIframeLX(iframe);
    }

    // 先离开再进入，强制路由 remount 页面（reset 后 DOM 可能仍是旧页）
    if ((win.location.hash || '') === target) {
        win.location.hash = '#/';
        await wait(20);
    }
    navigateIframe(iframe, target);
    await wait(sarWatchPace());
    syncPreviewHud(iframe, `seed→${target}`);
    return iframe;
}

/**
 * @param {HTMLIFrameElement} iframe
 * @param {string} hash 如 '#/study' / '#/wrong'
 */
export function navigateIframe(iframe, hash) {
    const win = iframe.contentWindow;
    if (!win) throw new Error('navigateIframe: no contentWindow');
    const target = hash.startsWith('#') ? hash : `#${hash}`;
    if (win.location.hash === target) {
        win.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
        win.location.hash = target;
    }
    syncPreviewHud(iframe, `navigate ${target}`);
}

/**
 * @param {HTMLIFrameElement} iframe
 * @returns {HTMLElement}
 */
export function iframeAppRoot(iframe) {
    const app = iframe.contentDocument?.querySelector('#app');
    if (!app) throw new Error('iframeAppRoot: 缺少 #app');
    return /** @type {HTMLElement} */ (app);
}

/**
 * 对 iframe 内整页 #app 采集（优先 LX.TestAPI.probeUi）。
 * @param {HTMLIFrameElement} iframe
 */
export async function collectAppUiState(iframe, opts = {}) {
    const win = iframe?.contentWindow;
    const LX = win?.LX;
    if (!LX) throw new Error('collectAppUiState: iframe LX 未就绪');
    if (typeof LX.TestAPI?.probeUi === 'function') {
        const st = await LX.TestAPI.probeUi();
        syncPreviewHud(iframe, 'collect');
        return st;
    }
    // 半残 iframe（有 LX 无 probeUi）：强制重载一次再采
    if (!opts._retried) {
        await ensureAppIframe({ forceReload: true });
        return collectAppUiState(iframe, { _retried: true });
    }
    let href = '';
    let search = '';
    try {
        href = String(win?.location?.href || '');
        search = String(win?.location?.search || '');
    } catch (_) { /* ignore */ }
    const keys = LX.TestAPI ? Object.keys(LX.TestAPI).join(',') : '(no TestAPI)';
    throw new Error(
        `collectAppUiState: 需要 app.html?test=1 挂载 TestAPI.probeUi`
        + ` | src=${iframe?.getAttribute?.('src') || ''}`
        + ` | href=${href}`
        + ` | search=${search}`
        + ` | _isTestMode=${!!LX._isTestMode}`
        + ` | testKeys=${keys}`
    );
}

/**
 * 精确点「我已掌握」按钮
 * @param {ParentNode} root
 */
export function clickMasteredButton(root) {
    const btn = [...root.querySelectorAll('button')]
        .find((b) => (b.textContent || '').trim().includes('我已掌握'));
    if (!btn) throw new Error('clickMasteredButton: 未找到「我已掌握」');
    btn.click();
}

/**
 * iframe 内打开抽屉（点顶栏菜单）
 * @param {HTMLIFrameElement} iframe
 */
export async function openIframeDrawer(iframe) {
    const root = iframeAppRoot(iframe);
    clickLabel(root, '打开菜单');
    await wait(30);
}

/**
 * 在 iframe 窗动态 import 同源模块（相对 app.html）
 * @param {HTMLIFrameElement} iframe
 * @param {string} relPath 如 'src/render/confirm.js'
 */
export async function importIframeModule(iframe, relPath) {
    const win = iframe.contentWindow;
    if (!win) throw new Error('importIframeModule: no contentWindow');
    const url = new URL(relPath, win.location.href).href;
    return (0, win.eval)(`import(${JSON.stringify(url)})`);
}

/**
 * 在 iframe 窗注入 confirm 返回值（优先 appConfirm 钩子，并钉死 window.confirm）
 * @param {HTMLIFrameElement} iframe
 * @param {boolean|((msg:string)=>boolean)} value
 */
export async function setIframeConfirm(iframe, value) {
    const win = iframe.contentWindow;
    const fn = typeof value === 'function' ? value : () => !!value;
    const prevConfirm = win.confirm;
    win.confirm = (msg) => !!fn(String(msg ?? ''));
    let restoreHook = () => {};
    try {
        const mod = await importIframeModule(iframe, 'src/render/confirm.js');
        mod.__setConfirmForTest(fn);
        restoreHook = () => mod.__setConfirmForTest(null);
    } catch (_) {
        // window.confirm 已覆盖 appConfirm 回落路径
    }
    return () => {
        win.confirm = prevConfirm;
        restoreHook();
    };
}

/**
 * 在 iframe 窗注入 prompt 返回值
 * @param {HTMLIFrameElement} iframe
 * @param {string|null|((msg:string, def?:string)=>string|null)} value
 */
export async function setIframePrompt(iframe, value) {
    const win = iframe.contentWindow;
    const fn = typeof value === 'function'
        ? value
        : () => (value == null ? null : String(value));
    const prevPrompt = win.prompt;
    win.prompt = (msg, def) => {
        const r = fn(String(msg ?? ''), def == null ? '' : String(def));
        return r == null ? null : String(r);
    };
    let restoreHook = () => {};
    try {
        const mod = await importIframeModule(iframe, 'src/render/prompt.js');
        mod.__setPromptForTest(fn);
        restoreHook = () => mod.__setPromptForTest(null);
    } catch (_) { /* window.prompt 回落 */ }
    return () => {
        win.prompt = prevPrompt;
        restoreHook();
    };
}

export function clickIframeText(iframe, text) {
    clickText(iframeAppRoot(iframe), text);
    syncPreviewHud(iframe, `clickText:${text}`);
}

export function clickIframeLabel(iframe, label) {
    clickLabel(iframeAppRoot(iframe), label);
    syncPreviewHud(iframe, `clickLabel:${label}`);
}

/**
 * @param {HTMLIFrameElement} iframe
 * @param {string|RegExp} needle hash 片段或完整 '#/xxx'
 */
export function assertIframeHash(iframe, needle) {
    const h = iframe.contentWindow?.location?.hash || '';
    const ok = typeof needle === 'string'
        ? (h === needle || h.includes(needle.replace(/^#/, '')))
        : needle.test(h);
    if (!ok) throw new Error(`iframe hash 期望 ${needle}，实际=${h}`);
}
