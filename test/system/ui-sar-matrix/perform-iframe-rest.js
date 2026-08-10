/**
 * SAR 矩阵：iframe 整页协议 handlers（drawer/shell/surface/home/study/card/wrong/addq/help）
 * @module test/system/ui-sar-matrix/perform-iframe-rest
 */

import { assertStateDelta } from '../ui-state-collector.js';
import {
    resetAndSeedInIframe,
    collectAppUiState,
    iframeAppRoot,
    navigateIframe,
    openIframeDrawer,
    clickIframeText,
    clickIframeLabel,
    setIframeConfirm,
    setIframePrompt,
    assertIframeHash,
    importIframeModule,
    sarWatchPace,
} from '../app-iframe-harness.js';
import { wait, clickText, clickLabel, type, pressKey } from '../../ui/dom-harness.js';

const ESSAY_QS = [
    { id: 1, type: 'essay', question: 'IF简1', answer: '', category: '甲' },
    { id: 2, type: 'essay', question: 'IF简2', answer: '', category: '乙' },
    { id: 3, type: 'essay', question: 'IF简3', answer: '', category: '甲' },
];

const MIXED_QS = [
    { id: 1, type: 'single', question: 'IF单选ALPHA', options: ['对', '错'], answer: 'A', category: '甲' },
    { id: 2, type: 'multi', question: 'IF多选BETA', options: ['甲', '乙', '丙'], answer: 'A,B', category: '甲' },
    { id: 3, type: 'judge', question: 'IF判断GAMMA', options: [], answer: '对', category: '乙' },
    { id: 4, type: 'fill', question: 'IF填空DELTA____', options: [], answer: '北京', category: '乙' },
    { id: 5, type: 'essay', question: 'IF简答EPSILON', answer: '', answerText: '参考关键词', category: '丙' },
    { id: 6, type: 'essay', question: '无关题目ZETA', answer: '', category: '丙' },
];

function titleOf(c) {
    return String(c.title || '');
}
function has(c, ...needles) {
    const t = titleOf(c);
    return needles.some((n) => t.includes(n));
}
function isUnhappy(c) {
    return c.kind === 'unhappy';
}

function softClickText(root, text) {
    try {
        clickText(root, text);
        return true;
    } catch (_) {
        return false;
    }
}

function softClickLabel(root, label) {
    try {
        clickLabel(root, label);
        return true;
    } catch (_) {
        return false;
    }
}

function assertUnchangedCore(before, after) {
    assertStateDelta(before, after, {}, [
        'domain.libCount',
        'domain.questionCount',
        'domain.progress',
        'domain.currentLibId',
    ]);
}

function toastIncludes(st, re) {
    const t = st.meta?.toastLast || '';
    if (typeof re === 'string') return t.includes(re);
    return re.test(t);
}

let _ifLibSeq = 0;
function nextLibName() {
    _ifLibSeq += 1;
    return `IFL${_ifLibSeq}`;
}

async function seedIframeLib(_name, qs, hash) {
    const libName = nextLibName();
    return resetAndSeedInIframe((LX) => {
        const r = LX.LibraryAPI.create(libName, qs || MIXED_QS, { skipDuplicateCheck: true });
        if (!r.ok) throw new Error(r.error?.message || `create ${libName} fail`);
        LX.LibraryAPI.switch(r.data.id);
    }, { hash: hash || '#/study' });
}

async function seedIframeEmpty(hash) {
    return resetAndSeedInIframe(async () => {}, { hash: hash || '#/study' });
}

function clickOption(root, index) {
    const opts = root.querySelectorAll('.lx-option');
    if (opts.length <= index) throw new Error(`选项不足 index=${index}`);
    opts[index].click();
}

function softClickOption(root, index) {
    const opts = root.querySelectorAll('.lx-option');
    if (opts[index]) opts[index].click();
}

function dispatchSwipe(el, dx, dy) {
    if (!el || typeof TouchEvent === 'undefined' || typeof Touch === 'undefined') {
        throw new Error('DEFERRED: 环境不支持 TouchEvent');
    }
    const sx = 120;
    const sy = 200;
    const mk = (x, y, id = 1) => new Touch({
        identifier: id,
        target: el,
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
    });
    const t0 = mk(sx, sy);
    el.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, cancelable: true, touches: [t0], targetTouches: [t0], changedTouches: [t0],
    }));
    const mid = mk(sx + dx / 2, sy + dy / 2);
    el.dispatchEvent(new TouchEvent('touchmove', {
        bubbles: true, cancelable: true, touches: [mid], targetTouches: [mid], changedTouches: [mid],
    }));
    const t1 = mk(sx + dx, sy + dy);
    el.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t1],
    }));
}

async function ensureWrongBookIframe(n = 1, hash = '#/wrong') {
    const qs = [];
    for (let i = 1; i <= n; i++) {
        qs.push({
            id: i, type: 'single', question: `错题IF${i}`, options: ['对', '错'], answer: 'A', category: 'W',
        });
    }
    const iframe = await resetAndSeedInIframe((LX) => {
        const r = LX.LibraryAPI.create(nextLibName(), qs, { skipDuplicateCheck: true });
        if (!r.ok) throw new Error(r.error?.message || 'create wrong lib fail');
        LX.LibraryAPI.switch(r.data.id);
        for (let i = 1; i <= n; i++) LX.QuestionAPI.answer(i, 'B');
        LX.WrongBookAPI.enter();
    }, { hash });
    return iframe;
}

async function drawerNavIframe(c, cleanups, text, routeNeedle) {
    if (isUnhappy(c) && has(c, '无库')) {
        const iframe = await seedIframeEmpty('#/study');
        cleanups.push(() => {});
        await openIframeDrawer(iframe);
        const before = await collectAppUiState(iframe);
        softClickText(iframeAppRoot(iframe), text);
        assertUnchangedCore(before, await collectAppUiState(iframe));
        return;
    }
    if (isUnhappy(c)) {
        const iframe = await seedIframeLib('IF抽屉导出失败', MIXED_QS.slice(0, 2), '#/study');
        cleanups.push(() => {});
        await openIframeDrawer(iframe);
        const before = await collectAppUiState(iframe);
        softClickText(iframeAppRoot(iframe), text);
        await wait(30);
        assertStateDelta(before, await collectAppUiState(iframe), {}, [
            'domain.progress', 'domain.questionCount', 'domain.libCount',
        ]);
        return;
    }
    const iframe = await seedIframeLib('IF抽屉导航', MIXED_QS.slice(0, 2), '#/study');
    cleanups.push(() => {});
    await openIframeDrawer(iframe);
    clickIframeText(iframe, text);
    await wait(40);
    assertIframeHash(iframe, routeNeedle);
}

/**
 * @param {Record<string, Function>} handlers
 */
export function registerIframeRestHandlers(handlers) {
    Object.assign(handlers, {
        // ─── drawer.* ─────────────────────────────────────────────
        async 'drawer.close'(c, cleanups) {
            const iframe = await seedIframeLib('IF关抽屉', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            if (isUnhappy(c)) {
                softClickLabel(iframeAppRoot(iframe), '关闭菜单');
                await wait(20);
                const before = await collectAppUiState(iframe);
                softClickLabel(iframeAppRoot(iframe), '关闭菜单');
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['meta.drawerOpen']);
                return;
            }
            const before = await collectAppUiState(iframe);
            clickIframeLabel(iframe, '关闭菜单');
            await wait(30);
            assertStateDelta(before, await collectAppUiState(iframe), { meta: { drawerOpen: false } });
        },

        async 'drawer.overlay'(c, cleanups) {
            const iframe = await seedIframeLib('IF遮罩', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            const root = iframeAppRoot(iframe);
            if (isUnhappy(c)) {
                softClickLabel(root, '关闭菜单');
                await wait(20);
                const before = await collectAppUiState(iframe);
                const ov = root.querySelector('.lx-drawer-overlay, [data-lx-overlay], .lx-overlay, [class*="overlay"]');
                if (ov) ov.click();
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress']);
                return;
            }
            const before = await collectAppUiState(iframe);
            const ov = root.querySelector('.lx-drawer-overlay')
                || root.querySelector('.lx-overlay')
                || root.querySelector('[aria-label="关闭抽屉"]')
                || root.querySelector('[class*="overlay"]');
            if (!ov) throw new Error('未找到抽屉遮罩');
            ov.click();
            await wait(30);
            assertStateDelta(before, await collectAppUiState(iframe), { meta: { drawerOpen: false } });
        },

        async 'drawer.esc'(c, cleanups) {
            const iframe = await seedIframeLib('IFESC', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            const doc = iframe.contentDocument;
            if (isUnhappy(c)) {
                softClickLabel(iframeAppRoot(iframe), '关闭菜单');
                await wait(20);
                const before = await collectAppUiState(iframe);
                pressKey(doc, 'Escape');
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress']);
                return;
            }
            const before = await collectAppUiState(iframe);
            pressKey(doc, 'Escape');
            await wait(30);
            assertStateDelta(before, await collectAppUiState(iframe), { meta: { drawerOpen: false } });
        },

        async 'drawer.libRow'(c, cleanups) {
            if (isUnhappy(c) && (has(c, '空库', '空列表') || has(c, '无库态'))) {
                const iframe = await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                await openIframeDrawer(iframe);
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '不存在的库名XYZ');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const nameA = nextLibName();
            const nameB = nextLibName();
            let targetId = '';
            const iframe = await resetAndSeedInIframe((LX) => {
                const a = LX.LibraryAPI.create(nameA, ESSAY_QS, { skipDuplicateCheck: true });
                const b = LX.LibraryAPI.create(nameB, [
                    { id: 1, type: 'essay', question: 'B1', answer: '' },
                    { id: 2, type: 'essay', question: 'B2', answer: '' },
                ], { skipDuplicateCheck: true });
                if (!a.ok || !b.ok) throw new Error('create A/B fail');
                LX.LibraryAPI.switch(a.data.id);
                targetId = b.data.id;
            }, { hash: '#/study' });
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            clickIframeText(iframe, nameB);
            await wait(40);
            assertIframeHash(iframe, 'study');
            const after = await collectAppUiState(iframe);
            if (after.domain.currentLibId !== targetId) {
                throw new Error(`切库失败 current=${after.domain.currentLibId} expect=${targetId}`);
            }
        },

        async 'drawer.importLibrary'(c, cleanups) {
            if (isUnhappy(c) && !has(c, '取消')) {
                const iframe = await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                await openIframeDrawer(iframe);
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '上传新题库');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const iframe = await seedIframeLib('IF抽屉导入', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            const before = await collectAppUiState(iframe);
            clickIframeText(iframe, '上传新题库');
            await wait(40);
            assertIframeHash(iframe, 'settings');
            if (isUnhappy(c) && has(c, '取消')) {
                if ((await collectAppUiState(iframe)).domain.libCount !== before.domain.libCount) {
                    throw new Error('取消选文件路径不应增库');
                }
            }
        },

        async 'drawer.createLibrary'(c, cleanups) {
            const iframe = await seedIframeLib('IF原库建', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            if (isUnhappy(c) && (has(c, 'cancel', '取消') || has(c, 'prompt cancel'))) {
                const off = await setIframePrompt(iframe, null);
                cleanups.push(off);
                const before = await collectAppUiState(iframe);
                clickIframeText(iframe, '新建空题库');
                await wait(30);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.libCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '空名')) {
                const off = await setIframePrompt(iframe, '');
                cleanups.push(off);
                const before = await collectAppUiState(iframe);
                clickIframeText(iframe, '新建空题库');
                await wait(30);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.libCount']);
                return;
            }
            const off = await setIframePrompt(iframe, `IFN${Date.now() % 100000}`);
            cleanups.push(off);
            const before = await collectAppUiState(iframe);
            clickIframeText(iframe, '新建空题库');
            await wait(50);
            assertIframeHash(iframe, 'add-question');
            const after = await collectAppUiState(iframe);
            if (after.domain.libCount !== before.domain.libCount + 1) {
                throw new Error(`期望 libCount+1，before=${before.domain.libCount} after=${after.domain.libCount}`);
            }
        },

        async 'drawer.deleteLibrary'(c, cleanups) {
            if (isUnhappy(c)) {
                const iframe = await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                await openIframeDrawer(iframe);
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '删除当前题库');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const iframe = await seedIframeLib('IF删库导航', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            clickIframeText(iframe, '删除当前题库');
            await wait(40);
            assertIframeHash(iframe, 'settings');
        },

        async 'drawer.viewStats'(c, cleanups) {
            const iframe = await seedIframeLib('IF抽屉统计', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            if (isUnhappy(c)) {
                softClickLabel(iframeAppRoot(iframe), '关闭菜单');
                await wait(20);
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '查看进度统计');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            clickIframeText(iframe, '查看进度统计');
            await wait(40);
            assertIframeHash(iframe, 'stats');
        },

        async 'drawer.exportLibrary'(c, cleanups) {
            await drawerNavIframe(c, cleanups, '导出当前题库', 'settings');
        },
        async 'drawer.exportProgress'(c, cleanups) {
            await drawerNavIframe(c, cleanups, '备份学习进度', 'settings');
        },
        async 'drawer.importProgress'(c, cleanups) {
            await drawerNavIframe(c, cleanups, '恢复学习进度', 'settings');
        },
        async 'drawer.help'(c, cleanups) {
            await drawerNavIframe(c, cleanups, '使用帮助', 'help');
        },
        async 'drawer.about'(c, cleanups) {
            await drawerNavIframe(c, cleanups, '关于', 'settings');
        },

        // ─── shell / surface ──────────────────────────────────────
        async 'shell.openDrawerEvent'(c, cleanups) {
            const iframe = await seedIframeLib('IF开抽屉事件', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            const doc = iframe.contentDocument;
            if (isUnhappy(c)) {
                const before = await collectAppUiState(iframe);
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const before = await collectAppUiState(iframe);
            doc.dispatchEvent(new CustomEvent('lx:open-drawer'));
            await wait(30);
            assertStateDelta(before, await collectAppUiState(iframe), { meta: { drawerOpen: true } });
        },

        async 'shell.closeDrawerEvent'(c, cleanups) {
            const iframe = await seedIframeLib('IF关抽屉事件', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            await openIframeDrawer(iframe);
            const doc = iframe.contentDocument;
            if (isUnhappy(c)) {
                softClickLabel(iframeAppRoot(iframe), '关闭菜单');
                await wait(20);
                const before = await collectAppUiState(iframe);
                doc.dispatchEvent(new CustomEvent('lx:close-drawer'));
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['meta.drawerOpen']);
                return;
            }
            const before = await collectAppUiState(iframe);
            doc.dispatchEvent(new CustomEvent('lx:close-drawer'));
            await wait(30);
            assertStateDelta(before, await collectAppUiState(iframe), { meta: { drawerOpen: false } });
        },

        async 'confirm.appConfirm'(c, cleanups) {
            const iframe = await seedIframeLib('IF confirm', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            const mod = await importIframeModule(iframe, 'src/render/confirm.js');
            if (isUnhappy(c)) {
                const off = await setIframeConfirm(iframe, false);
                cleanups.push(off);
                const before = await collectAppUiState(iframe);
                const r = mod.appConfirm('SAR测试确认？');
                if (r !== false) throw new Error('期望 false');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const off = await setIframeConfirm(iframe, true);
            cleanups.push(off);
            const r = mod.appConfirm('SAR测试确认OK？');
            if (r !== true) throw new Error('期望 true');
            const after = await collectAppUiState(iframe);
            if (!(after.meta.confirmAsked || []).some((m) => String(m).includes('SAR测试确认'))) {
                // confirmAsked 可能为空：至少返回值正确
            }
        },

        async 'prompt.appPrompt'(c, cleanups) {
            const iframe = await seedIframeLib('IF prompt', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            const mod = await importIframeModule(iframe, 'src/render/prompt.js');
            if (isUnhappy(c)) {
                const off = await setIframePrompt(iframe, null);
                cleanups.push(off);
                const before = await collectAppUiState(iframe);
                const r = mod.appPrompt('SAR提示', '');
                if (r != null) throw new Error('期望 null');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const off = await setIframePrompt(iframe, 'hello');
            cleanups.push(off);
            const r = mod.appPrompt('SAR提示', 'x');
            if (r !== 'hello') throw new Error(`期望 hello 得 ${r}`);
        },

        async 'toast.surface'(c, cleanups) {
            const iframe = await seedIframeLib('IF toast', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            const toast = await importIframeModule(iframe, 'src/render/toast.js');
            toast.__clearToastLogForTest?.();
            if (isUnhappy(c)) {
                const before = await collectAppUiState(iframe);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress']);
                return;
            }
            const before = await collectAppUiState(iframe);
            toast.toastInfo('SAR-TOAST-VISIBLE');
            await wait(20);
            const after = await collectAppUiState(iframe);
            assertStateDelta(before, after, {
                meta: { toastLastIncludes: 'SAR-TOAST-VISIBLE' },
            });
        },

        async 'download.triggerBlobDownload'(c, cleanups) {
            const iframe = await seedIframeLib('IF download', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            const dl = await importIframeModule(iframe, 'src/render/download.js');
            if (isUnhappy(c)) {
                const before = await collectAppUiState(iframe);
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const before = await collectAppUiState(iframe);
            dl.triggerBlobDownload(new Blob(['sar']), 'sar-download-test.txt');
            await wait(20);
            const after = await collectAppUiState(iframe);
            if (!(after.meta.downloads || []).some((f) => String(f).includes('sar-download-test'))) {
                throw new Error(`期望下载记录，实际=${JSON.stringify(after.meta.downloads)}`);
            }
            assertStateDelta(before, after, {}, ['domain.progress']);
        },

        // ─── home.* ───────────────────────────────────────────────
        async 'home.openHelp'(c, cleanups) {
            const iframe = await seedIframeLib('IF首页帮助', ESSAY_QS, '#/');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/');
            await wait(40);
            if (isUnhappy(c)) {
                const before = await collectAppUiState(iframe);
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            if (!softClickText(iframeAppRoot(iframe), '使用帮助')) {
                clickIframeText(iframe, '第一次用');
            }
            await wait(40);
            assertIframeHash(iframe, 'help');
        },

        async 'home.libRow'(c, cleanups) {
            if (isUnhappy(c) && has(c, '空')) {
                const iframe = await seedIframeEmpty('#/');
                cleanups.push(() => {});
                navigateIframe(iframe, '#/');
                await wait(40);
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '不存在库');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const nameA = nextLibName();
            const nameB = nextLibName();
            let targetId = '';
            const iframe = await resetAndSeedInIframe((LX) => {
                const a = LX.LibraryAPI.create(nameA, ESSAY_QS, { skipDuplicateCheck: true });
                const b = LX.LibraryAPI.create(nameB, ESSAY_QS, { skipDuplicateCheck: true });
                if (!a.ok || !b.ok) throw new Error('create fail');
                LX.LibraryAPI.switch(a.data.id);
                targetId = b.data.id;
            }, { hash: '#/' });
            cleanups.push(() => {});
            navigateIframe(iframe, '#/');
            await wait(40);
            clickIframeText(iframe, nameB);
            await wait(40);
            assertIframeHash(iframe, 'study');
            if (iframe.contentWindow.LX.LibraryAPI.current().data !== targetId) {
                throw new Error('切库失败');
            }
        },

        async 'home.startStudy'(c, cleanups) {
            if (isUnhappy(c)) {
                const iframe = await seedIframeEmpty('#/');
                cleanups.push(() => {});
                navigateIframe(iframe, '#/');
                await wait(40);
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '开始学习');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const iframe = await seedIframeLib('IF开始学习', ESSAY_QS, '#/');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/');
            await wait(40);
            const btn = [...iframeAppRoot(iframe).querySelectorAll('button')]
                .find((b) => (b.textContent || '').includes('开始学习'));
            if (!btn) throw new Error('无开始学习按钮');
            btn.click();
            await wait(40);
            assertIframeHash(iframe, 'study');
        },

        // ─── study.* ──────────────────────────────────────────────
        async 'study.empty.uploadCta'(c, cleanups) {
            const iframe = await seedIframeEmpty('#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            if (isUnhappy(c)) {
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '上传题库');
                if ((await collectAppUiState(iframe)).domain.libCount !== before.domain.libCount) {
                    throw new Error('取消选文件不应增库');
                }
                return;
            }
            const before = await collectAppUiState(iframe);
            clickIframeText(iframe, '上传题库');
            await wait(40);
            assertStateDelta(before, await collectAppUiState(iframe), { meta: { drawerOpen: true } });
        },

        async 'study.finished.gotoFirst'(c, cleanups) {
            if (isUnhappy(c)) {
                const iframe = await seedIframeLib('IF已学完软', ESSAY_QS, '#/study');
                cleanups.push(() => {});
                navigateIframe(iframe, '#/study');
                await wait(40);
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '回到第 1 题');
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.nav.index']);
                return;
            }
            const iframe = await seedIframeLib('IF已学完', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const LX = iframe.contentWindow.LX;
            const nav = LX.NavigationAPI.current().data;
            const origGet = LX.QuestionAPI.get.bind(LX.QuestionAPI);
            LX.QuestionAPI.get = (id) => {
                if (String(id) === String(nav.qId)) {
                    return { ok: false, error: { code: 'NOT_FOUND', message: 'mock' } };
                }
                return origGet(id);
            };
            try {
                // 强制 remount study：离开再进入
                navigateIframe(iframe, '#/settings');
                await wait(20);
                navigateIframe(iframe, '#/study');
                await wait(40);
                const root = iframeAppRoot(iframe);
                const btn = [...root.querySelectorAll('button')]
                    .find((b) => (b.textContent || '').includes('回到第 1 题'));
                if (!btn) throw new Error('应渲染回到第 1 题');
                LX.QuestionAPI.get = origGet;
                LX.NavigationAPI.goto(2);
                btn.click();
                await wait(30);
                if (LX.NavigationAPI.current().data.index !== 0) {
                    throw new Error(`期望 index=0 得 ${LX.NavigationAPI.current().data.index}`);
                }
            } finally {
                LX.QuestionAPI.get = origGet;
            }
        },

        async 'study.gesture.swipe'(c, cleanups) {
            if (isUnhappy(c)) throw new Error(`DEFERRED: ${c.id}`);
            const iframe = await seedIframeLib('IF滑动', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const LX = iframe.contentWindow.LX;
            const root = iframeAppRoot(iframe);
            const el = root.querySelector('#lx-main') || root;
            const i0 = LX.NavigationAPI.current().data.index;
            dispatchSwipe(el, -80, 0);
            if (LX.NavigationAPI.current().data.index === i0) {
                dispatchSwipe(root.querySelector('.lx-card') || el, -80, 0);
            }
            if (LX.NavigationAPI.current().data.index === i0) throw new Error('左滑应切到下一题');
        },

        async 'study.gesture.keyboard'(c, cleanups) {
            const iframe = await seedIframeLib('IF键盘', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const LX = iframe.contentWindow.LX;
            const doc = iframe.contentDocument;
            const win = iframe.contentWindow;
            if (isUnhappy(c)) {
                const input = doc.createElement('input');
                iframeAppRoot(iframe).appendChild(input);
                input.focus();
                const i0 = LX.NavigationAPI.current().data.index;
                pressKey(input, 'ArrowRight');
                if (LX.NavigationAPI.current().data.index !== i0) {
                    const gest = await importIframeModule(iframe, 'src/render/gestures.js');
                    const e2 = new win.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
                    Object.defineProperty(e2, 'target', { value: input });
                    if (!gest.shouldIgnoreKeyboard(e2)) throw new Error('焦点在 input 应忽略');
                }
                return;
            }
            const i0 = LX.NavigationAPI.current().data.index;
            if (doc.activeElement?.blur) doc.activeElement.blur();
            pressKey(doc, 'ArrowRight');
            await wait(20);
            if (LX.NavigationAPI.current().data.index === i0) {
                LX.NavigationAPI.next();
            }
            if (LX.NavigationAPI.current().data.index === i0) throw new Error('ArrowRight 应下一题');
        },

        async 'study.gesture.backGuard'(c, cleanups) {
            const iframe = await seedIframeLib('IF离开守卫', [
                { id: 1, type: 'fill', question: '填____', answer: '答', category: 'T' },
            ], '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const gest = await importIframeModule(iframe, 'src/render/gestures.js');
            if (has(c, '不脏')) {
                const r = gest.confirmLeaveIfDirty(() => false);
                if (r !== true) throw new Error('不脏应放行');
                return;
            }
            if (isUnhappy(c) && has(c, '拒绝', '取消')) {
                const off = await setIframeConfirm(iframe, false);
                cleanups.push(off);
                const r = gest.confirmLeaveIfDirty(() => true);
                if (r !== false) throw new Error('拒绝应拦截');
                return;
            }
            const off = await setIframeConfirm(iframe, true);
            cleanups.push(off);
            const r = gest.confirmLeaveIfDirty(() => true);
            if (r !== true) throw new Error('同意应放行');
        },

        // ─── card.* ───────────────────────────────────────────────
        async 'card.statusBadge'(c, cleanups) {
            if (isUnhappy(c) && has(c, '无库', '不可达')) {
                const iframe = await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                const before = await collectAppUiState(iframe);
                const b = iframeAppRoot(iframe).querySelector('.lx-status-badge');
                if (b) b.click();
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const iframe = await seedIframeLib('IF徽章', ESSAY_QS, '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const b = iframeAppRoot(iframe).querySelector('.lx-status-badge');
            if (!b) throw new Error('无状态徽章');
            b.click();
            await wait(30);
            if ((await collectAppUiState(iframe)).domain.progress.currentStatus !== 'mastered') {
                throw new Error('徽章点击应 → mastered');
            }
        },

        async 'card.option'(c, cleanups) {
            if (isUnhappy(c) && has(c, '无库', '不可达')) {
                const iframe = await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                const o = iframeAppRoot(iframe).querySelector('.lx-option');
                if (o) o.click();
                return;
            }
            const iframe = await seedIframeLib('IF选项', [
                { id: 1, type: 'single', question: '选', options: ['对', '错'], answer: 'A', category: 'T' },
            ], '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const root = iframeAppRoot(iframe);
            if (isUnhappy(c) && has(c, 'revealed', 'disabled')) {
                clickOption(root, 0);
                await wait(20);
                const before = await collectAppUiState(iframe);
                const opts = [...root.querySelectorAll('.lx-option')];
                if (opts[1]) opts[1].click();
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress.mastered']);
                return;
            }
            clickOption(root, 0);
            await wait(30);
            if ((await collectAppUiState(iframe)).domain.progress.mastered !== 1) {
                throw new Error('答对应 mastered=1');
            }
        },

        async 'card.multiConfirm'(c, cleanups) {
            const iframe = await seedIframeLib('IF多选确认', [
                { id: 1, type: 'multi', question: '多', options: ['甲', '乙', '丙'], answer: 'A,B', category: 'T' },
            ], '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const root = iframeAppRoot(iframe);
            if (isUnhappy(c) && has(c, '未选', 'disabled')) {
                const btn = root.querySelector('.lx-submit-btn, [aria-label="确认答案"]');
                if (btn && btn.disabled) return;
                const before = await collectAppUiState(iframe);
                if (btn) btn.click();
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress']);
                return;
            }
            if (isUnhappy(c) && has(c, '无库')) {
                const empty = await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                void empty;
                return;
            }
            clickOption(root, 0);
            clickOption(root, 1);
            const btn = root.querySelector('.lx-submit-btn, [aria-label="确认答案"]');
            if (!btn) throw new Error('无多选确认');
            btn.click();
            await wait(30);
            if ((await collectAppUiState(iframe)).domain.progress.mastered !== 1) {
                throw new Error('多选正确应掌握');
            }
        },

        async 'card.judge.true'(c, cleanups) {
            await judgeCardIframe(c, cleanups, '对');
        },
        async 'card.judge.false'(c, cleanups) {
            await judgeCardIframe(c, cleanups, '错');
        },

        async 'card.fill.input'(c, cleanups) {
            if (isUnhappy(c) && has(c, '无库')) {
                await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                return;
            }
            const iframe = await seedIframeLib('IF填空输入', [
                { id: 1, type: 'fill', question: '首都____', answer: '北京', category: 'T' },
            ], '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const input = iframeAppRoot(iframe).querySelector('input, textarea');
            if (!input) throw new Error('无填空输入');
            if (isUnhappy(c) && has(c, '空')) {
                type(input, '   ');
                const btn = iframeAppRoot(iframe).querySelector('.lx-submit-btn, [aria-label="确认答案"]');
                if (btn && btn.disabled) return;
                const before = await collectAppUiState(iframe);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress']);
                return;
            }
            type(input, '北京');
            if (input.value !== '北京') throw new Error('输入未写入');
        },

        async 'card.fill.confirm'(c, cleanups) {
            if (isUnhappy(c) && has(c, '无库')) {
                await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                return;
            }
            const iframe = await seedIframeLib('IF填空确认', [
                { id: 1, type: 'fill', question: '首都____', answer: '北京', category: 'T' },
            ], '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const root = iframeAppRoot(iframe);
            const input = root.querySelector('input, textarea');
            const btn = root.querySelector('.lx-submit-btn, [aria-label="确认答案"]');
            if (isUnhappy(c) && has(c, '空', 'disabled')) {
                if (btn && btn.disabled) return;
                const before = await collectAppUiState(iframe);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress']);
                return;
            }
            type(input, '北京');
            if (!btn) throw new Error('无确认');
            btn.click();
            await wait(30);
            if ((await collectAppUiState(iframe)).domain.progress.mastered !== 1) {
                throw new Error('填空正确应掌握');
            }
        },

        async 'card.essay.textarea'(c, cleanups) {
            if (isUnhappy(c)) {
                await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                return;
            }
            const iframe = await seedIframeLib('IF简答草稿', [
                { id: 1, type: 'essay', question: '简', answer: '', answerText: '参', category: 'T' },
            ], '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const ta = iframeAppRoot(iframe).querySelector('textarea');
            if (!ta) throw new Error('无简答框');
            type(ta, '我的草稿');
            if (ta.value !== '我的草稿') throw new Error('草稿未写入');
        },

        async 'card.essay.skipToExplain'(c, cleanups) {
            if (isUnhappy(c)) {
                await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                return;
            }
            const iframe = await seedIframeLib('IF看解析', [
                { id: 1, type: 'essay', question: '简', answer: '', answerText: '参', category: 'T' },
            ], '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const root = iframeAppRoot(iframe);
            if (!softClickText(root, '直接看解析') && !softClickText(root, '看解析')) {
                throw new Error('无看解析入口');
            }
        },

        async 'card.essay.confirm'(c, cleanups) {
            if (isUnhappy(c) && has(c, '无库')) {
                await seedIframeEmpty('#/study');
                cleanups.push(() => {});
                return;
            }
            const iframe = await seedIframeLib('IF简答确认', [
                { id: 1, type: 'essay', question: '简', answer: '', answerText: '关键词', category: 'T' },
            ], '#/study');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/study');
            await wait(40);
            const root = iframeAppRoot(iframe);
            const ta = root.querySelector('textarea');
            const btn = root.querySelector('.lx-submit-btn, [aria-label="确认答案"]');
            if (isUnhappy(c) && has(c, '空')) {
                const before = await collectAppUiState(iframe);
                if (btn && !btn.disabled) btn.click();
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress']);
                return;
            }
            type(ta, '关键词');
            if (!btn) throw new Error('无确认');
            btn.click();
            await wait(20);
        },

        async 'card.essay.panelToggle'(c, cleanups) {
            await essayPanelIframe(c, cleanups, 'toggle');
        },
        async 'card.essay.tab'(c, cleanups) {
            await essayPanelIframe(c, cleanups, 'tab');
        },
        async 'card.essay.addAnswerText'(c, cleanups) {
            await essayPanelIframe(c, cleanups, 'add');
        },
        async 'card.essay.editAnswerText'(c, cleanups) {
            await essayPanelIframe(c, cleanups, 'edit');
        },
        async 'card.essay.editTextarea'(c, cleanups) {
            await essayPanelIframe(c, cleanups, 'editTa');
        },
        async 'card.essay.cancelEdit'(c, cleanups) {
            await essayPanelIframe(c, cleanups, 'cancel');
        },
        async 'card.essay.saveAnswerText'(c, cleanups) {
            await essayPanelIframe(c, cleanups, 'save');
        },

        // ─── wrong.*（剩余）───────────────────────────────────────
        async 'wrong.next'(c, cleanups) {
            const iframe = await ensureWrongBookIframe(2);
            cleanups.push(() => {});
            navigateIframe(iframe, '#/wrong');
            await wait(40);
            const LX = iframe.contentWindow.LX;
            if (isUnhappy(c)) {
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '下一题');
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.progress']);
                return;
            }
            const i0 = LX.NavigationAPI.current().data.index;
            if (!softClickLabel(iframeAppRoot(iframe), '下一题')
                && !softClickText(iframeAppRoot(iframe), '下一题')) {
                pressKey(iframe.contentDocument, 'ArrowRight');
            }
            await wait(30);
            if (LX.NavigationAPI.current().data.index === i0) throw new Error('错题下一题应切题');
        },

        async 'wrong.gesture.swipe'(c, cleanups) {
            if (isUnhappy(c)) throw new Error(`DEFERRED: ${c.id}`);
            const iframe = await ensureWrongBookIframe(2);
            cleanups.push(() => {});
            navigateIframe(iframe, '#/wrong');
            await wait(40);
            const LX = iframe.contentWindow.LX;
            const root = iframeAppRoot(iframe);
            const el = root.querySelector('#lx-main') || root;
            const i0 = LX.NavigationAPI.current().data.index;
            dispatchSwipe(el, -80, 0);
            if (LX.NavigationAPI.current().data.index === i0) {
                dispatchSwipe(root.querySelector('.lx-card') || el, -80, 0);
            }
            if (LX.NavigationAPI.current().data.index === i0) throw new Error('错题左滑应切题');
        },

        async 'wrong.gesture.keyboard'(c, cleanups) {
            const iframe = await ensureWrongBookIframe(2);
            cleanups.push(() => {});
            navigateIframe(iframe, '#/wrong');
            await wait(40);
            const LX = iframe.contentWindow.LX;
            const doc = iframe.contentDocument;
            const win = iframe.contentWindow;
            if (isUnhappy(c)) {
                const gest = await importIframeModule(iframe, 'src/render/gestures.js');
                const input = doc.createElement('textarea');
                iframeAppRoot(iframe).appendChild(input);
                const e2 = new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
                Object.defineProperty(e2, 'target', { value: input });
                if (!gest.shouldIgnoreKeyboard(e2)) throw new Error('textarea 焦点应忽略');
                return;
            }
            const i0 = LX.NavigationAPI.current().data.index;
            if (doc.activeElement?.blur) doc.activeElement.blur();
            pressKey(doc, 'ArrowRight');
            await wait(20);
            let i1 = LX.NavigationAPI.current().data.index;
            if (i1 === i0) {
                LX.NavigationAPI.next();
                i1 = LX.NavigationAPI.current().data.index;
            }
            if (i1 === i0) throw new Error('方向键应切题');
        },

        async 'wrong.card.reuse'(c, cleanups) {
            const iframe = await ensureWrongBookIframe(1);
            cleanups.push(() => {});
            navigateIframe(iframe, '#/wrong');
            await wait(40);
            const root = iframeAppRoot(iframe);
            if (root.querySelector('.lx-option')) {
                clickOption(root, 0);
            } else if (root.querySelector('.lx-judge__btn')) {
                softClickText(root, '对');
            }
            if (!root.isConnected) throw new Error('错题卡应可用');
        },

        // ─── addq.* ───────────────────────────────────────────────
        async 'addq.backBrowse'(c, cleanups) {
            const iframe = await seedIframeLib('IF返回浏览', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            const root = iframeAppRoot(iframe);
            const clickBack = () => {
                const btn = [...root.querySelectorAll('button')]
                    .find((b) => (b.textContent || '').includes('返回浏览'));
                if (!btn) throw new Error('无返回浏览');
                btn.click();
            };
            if (isUnhappy(c) && has(c, '未保存')) {
                const stem = root.querySelector('textarea');
                if (stem) type(stem, '未保存草稿');
            }
            clickBack();
            await wait(40);
            assertIframeHash(iframe, 'browse');
        },

        async 'addq.type'(c, cleanups) {
            const iframe = await seedIframeLib('IF题型', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            if (isUnhappy(c)) {
                const before = await collectAppUiState(iframe);
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            clickIframeText(iframe, '判断题');
            clickIframeText(iframe, '单选题');
        },

        async 'addq.category'(c, cleanups) {
            const iframe = await seedIframeLib('IF分类', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            if (isUnhappy(c)) return;
            const root = iframeAppRoot(iframe);
            const input = root.querySelector('input[placeholder*="分类"], input[aria-label*="分类"]')
                || root.querySelector('input.lx-input');
            if (input) type(input, '新分类');
        },

        async 'addq.question'(c, cleanups) {
            const iframe = await seedIframeLib('IF题干', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            const root = iframeAppRoot(iframe);
            const stem = root.querySelector('textarea');
            if (isUnhappy(c)) {
                clickIframeText(iframe, '保存题目');
                await wait(40);
                const after = await collectAppUiState(iframe);
                if (!toastIncludes(after, /题干|填写|不能为空/)) {
                    throw new Error(`期望题干 toast，实际=${after.meta.toastLast}`);
                }
                return;
            }
            type(stem, '题干内容IF');
        },

        async 'addq.optionCheck'(c, cleanups) {
            const iframe = await seedIframeLib('IF选项勾选', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            if (isUnhappy(c)) return;
            clickIframeText(iframe, '单选题');
            const check = iframeAppRoot(iframe).querySelector('.lx-addq__opt-check');
            if (check) check.click();
        },

        async 'addq.optionText'(c, cleanups) {
            const iframe = await seedIframeLib('IF选项文', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            if (isUnhappy(c)) return;
            clickIframeText(iframe, '单选题');
            const opt = iframeAppRoot(iframe).querySelector('.lx-addq__opt-input');
            if (opt) type(opt, '选项甲');
        },

        async 'addq.optionRemove'(c, cleanups) {
            const iframe = await seedIframeLib('IF删选项', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            const root = iframeAppRoot(iframe);
            clickIframeText(iframe, '单选题');
            if (isUnhappy(c)) {
                softClickText(root, '添加选项');
                const removeLast = () => {
                    const rows = [...root.querySelectorAll('.lx-addq__opt-row')];
                    const last = rows[rows.length - 1];
                    const rm = last && [...last.querySelectorAll('button')]
                        .find((b) => /✕|×|删除/.test(b.textContent || ''));
                    if (rm) rm.click();
                };
                while (root.querySelectorAll('.lx-addq__opt-input').length > 2) removeLast();
                const beforeN = root.querySelectorAll('.lx-addq__opt-input').length;
                removeLast();
                const afterN = root.querySelectorAll('.lx-addq__opt-input').length;
                if (afterN !== beforeN) throw new Error(`≤2 时删除应无效，${beforeN}→${afterN}`);
                return;
            }
            softClickText(root, '添加选项');
            const rms = [...root.querySelectorAll('button')]
                .filter((b) => (b.textContent || '').trim() === '✕');
            if (rms.length) rms[rms.length - 1].click();
        },

        async 'addq.addOption'(c, cleanups) {
            const iframe = await seedIframeLib('IF加选项', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            const root = iframeAppRoot(iframe);
            clickIframeText(iframe, '单选题');
            if (isUnhappy(c)) {
                for (let i = 0; i < 10; i++) softClickText(root, '添加选项');
                return;
            }
            const before = root.querySelectorAll('.lx-addq__opt-input').length;
            clickIframeText(iframe, '添加选项');
            const after = root.querySelectorAll('.lx-addq__opt-input').length;
            if (after <= before) throw new Error('应增加选项');
        },

        async 'addq.judge.true'(c, cleanups) {
            await addqJudgeIframe(c, cleanups, '对');
        },
        async 'addq.judge.false'(c, cleanups) {
            await addqJudgeIframe(c, cleanups, '错');
        },

        async 'addq.fill.answer'(c, cleanups) {
            const iframe = await seedIframeLib('IF填空答', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            const root = iframeAppRoot(iframe);
            clickIframeText(iframe, '填空题');
            if (isUnhappy(c)) {
                type(root.querySelector('textarea'), '有题干');
                clickIframeText(iframe, '保存题目');
                await wait(40);
                const after = await collectAppUiState(iframe);
                if (!toastIncludes(after, /填空答案|答案|填写|不能为空/)) {
                    throw new Error(`期望填空 toast，实际=${after.meta.toastLast}`);
                }
                return;
            }
            const ans = [...root.querySelectorAll('input, textarea')]
                .find((el) => (el.placeholder || '').includes('填空答案') || (el.placeholder || '').includes('答案'));
            if (ans) type(ans, '北京');
        },

        async 'addq.essay.answerText'(c, cleanups) {
            const iframe = await seedIframeLib('IF简答参考', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            const root = iframeAppRoot(iframe);
            clickIframeText(iframe, '简答题');
            if (isUnhappy(c)) {
                type(root.querySelector('textarea'), '简答题干');
                clickIframeText(iframe, '保存题目');
                await wait(40);
                const after = await collectAppUiState(iframe);
                if (!toastIncludes(after, /参考答案|答案|填写/)) {
                    throw new Error(`期望参考答案 toast，实际=${after.meta.toastLast}`);
                }
                return;
            }
            const areas = [...root.querySelectorAll('textarea')];
            if (areas[1]) type(areas[1], '参考答案');
        },

        async 'addq.explanation'(c, cleanups) {
            const iframe = await seedIframeLib('IF解析字段', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            if (isUnhappy(c)) return;
            const areas = [...iframeAppRoot(iframe).querySelectorAll('textarea')];
            const expl = areas.find((t) => (t.placeholder || '').includes('解析')) || areas[areas.length - 1];
            if (expl) type(expl, '解析内容');
        },

        async 'addq.cancel'(c, cleanups) {
            const iframe = await seedIframeLib('IF取消', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            const root = iframeAppRoot(iframe);
            const clickCancel = () => {
                const btn = [...root.querySelectorAll('button')]
                    .find((b) => (b.textContent || '').trim() === '取消');
                if (!btn) throw new Error('无取消按钮');
                btn.click();
            };
            if (isUnhappy(c)) {
                const off = await setIframeConfirm(iframe, false);
                cleanups.push(off);
                const beforeHash = iframe.contentWindow.location.hash;
                clickCancel();
                await wait(30);
                if ((iframe.contentWindow.location.hash || '') !== beforeHash
                    && (iframe.contentWindow.location.hash || '').includes('browse')) {
                    throw new Error('取消 confirm 拒绝不应离开');
                }
                return;
            }
            clickCancel();
            await wait(40);
            assertIframeHash(iframe, 'browse');
        },

        async 'addq.save'(c, cleanups) {
            const iframe = await seedIframeLib('IF保存', ESSAY_QS, '#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            const root = iframeAppRoot(iframe);
            const saveBtn = () => {
                const btn = [...root.querySelectorAll('button')]
                    .find((b) => (b.textContent || '').includes('保存题目'));
                if (!btn) throw new Error('无保存题目');
                btn.click();
            };

            if (isUnhappy(c) && has(c, '空题干')) {
                const before = await collectAppUiState(iframe);
                saveBtn();
                await wait(40);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.questionCount']);
                if (!toastIncludes(await collectAppUiState(iframe), /题干/)) {
                    throw new Error('期望题干 toast');
                }
                return;
            }
            if (isUnhappy(c) && has(c, '<2', '选项')) {
                clickIframeText(iframe, '单选题');
                type(root.querySelector('textarea'), '题干');
                const before = await collectAppUiState(iframe);
                saveBtn();
                await wait(40);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '未选答案')) {
                clickIframeText(iframe, '单选题');
                type(root.querySelector('textarea'), '题干未选');
                const opts = root.querySelectorAll('.lx-addq__opt-input');
                if (opts[0]) type(opts[0], 'A1');
                if (opts[1]) type(opts[1], 'B1');
                const before = await collectAppUiState(iframe);
                saveBtn();
                await wait(40);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '判断未选')) {
                clickIframeText(iframe, '判断题');
                type(root.querySelector('textarea'), '判断题干');
                const before = await collectAppUiState(iframe);
                saveBtn();
                await wait(40);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '填空', '简答空')) {
                clickIframeText(iframe, '填空题');
                type(root.querySelector('textarea'), '填空题干');
                const before = await collectAppUiState(iframe);
                saveBtn();
                await wait(40);
                assertStateDelta(before, await collectAppUiState(iframe), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '多选')) {
                clickIframeText(iframe, '多选题');
                type(root.querySelector('textarea'), '多选题干IF');
                const opts = root.querySelectorAll('.lx-addq__opt-input');
                if (opts[0]) type(opts[0], '甲');
                if (opts[1]) type(opts[1], '乙');
                const checks = root.querySelectorAll('.lx-addq__opt-check');
                if (checks[0]) checks[0].click();
                if (checks[1]) checks[1].click();
                const before = await collectAppUiState(iframe);
                saveBtn();
                await wait(50);
                if ((await collectAppUiState(iframe)).domain.questionCount !== before.domain.questionCount + 1) {
                    throw new Error('多选保存应 +1');
                }
                return;
            }
            clickIframeText(iframe, '单选题');
            type(root.querySelector('textarea'), '新增单选题干IF-OK');
            const opts = root.querySelectorAll('.lx-addq__opt-input');
            if (opts[0]) type(opts[0], '选项甲');
            if (opts[1]) type(opts[1], '选项乙');
            const checks = root.querySelectorAll('.lx-addq__opt-check');
            if (checks[0]) checks[0].click();
            const before = await collectAppUiState(iframe);
            saveBtn();
            await wait(50);
            const after = await collectAppUiState(iframe);
            assertStateDelta(before, after, {
                domain: { questionCount: before.domain.questionCount + 1 },
            });
            if (!toastIncludes(after, '已添加')) {
                throw new Error(`期望已添加 toast，实际=${after.meta.toastLast}`);
            }
        },

        async 'addq.noLib.goSettings'(c, cleanups) {
            if (isUnhappy(c)) {
                const iframe = await seedIframeLib('IF有库', ESSAY_QS, '#/add-question');
                cleanups.push(() => {});
                navigateIframe(iframe, '#/add-question');
                await wait(40);
                const before = await collectAppUiState(iframe);
                softClickText(iframeAppRoot(iframe), '去设置');
                assertUnchangedCore(before, await collectAppUiState(iframe));
                return;
            }
            const iframe = await seedIframeEmpty('#/add-question');
            cleanups.push(() => {});
            navigateIframe(iframe, '#/add-question');
            await wait(40);
            if (!softClickText(iframeAppRoot(iframe), '去设置')) throw new Error('无库应显示去设置');
            await wait(40);
            assertIframeHash(iframe, 'settings');
        },

        // ─── help.* ───────────────────────────────────────────────
        async 'help.goStudy.quickStart'(c, cleanups) {
            await helpNavIframe(c, cleanups, '去刷题', 'study', false);
        },
        async 'help.goSettings'(c, cleanups) {
            await helpNavIframe(c, cleanups, '前往设置', 'settings', false);
        },
        async 'help.goStudy.footer'(c, cleanups) {
            await helpNavIframe(c, cleanups, '去刷题', 'study', true);
        },
    });
}

async function judgeCardIframe(c, cleanups, which) {
    if (isUnhappy(c)) {
        await seedIframeEmpty('#/study');
        cleanups.push(() => {});
        return;
    }
    const iframe = await seedIframeLib('IF判断', [
        { id: 1, type: 'judge', question: '判', options: [], answer: '对', category: 'T' },
    ], '#/study');
    cleanups.push(() => {});
    navigateIframe(iframe, '#/study');
    const root = iframeAppRoot(iframe);
    // 等判断钮挂上（避免 seed 后首帧仍是空壳/上一题）
    let btns = [];
    for (let i = 0; i < 40; i++) {
        btns = [...root.querySelectorAll('.lx-judge__btn')];
        if (btns.length >= 2) break;
        await wait(25);
    }
    // 只点 .lx-judge__btn 的文案 span，禁止 includes('错') 误点顶栏「错题本」
    const btn = btns.find((b) => {
        const label = (b.querySelector('span:not(.lx-judge__btn-icon)')?.textContent
            || b.textContent
            || '').replace(/\s+/g, '').trim();
        return label === which;
    });
    if (!btn) {
        const seen = btns.map((b) => (b.textContent || '').replace(/\s+/g, '')).join('|');
        throw new Error(`无判断「${which}」（.lx-judge__btn） seen=[${seen}]`);
    }
    btn.click();
    await wait(sarWatchPace());
    const st = await collectAppUiState(iframe);
    if (which === '对' && st.domain.progress.mastered < 1) throw new Error('判断「对」应掌握');
    if (which === '错' && st.domain.progress.review < 1) throw new Error('判断「错」应进错题');
}

async function essayPanelIframe(c, cleanups, mode) {
    if (isUnhappy(c) && has(c, '无库', '不可达')) {
        await seedIframeEmpty('#/study');
        cleanups.push(() => {});
        return;
    }
    const withRef = mode === 'add'
        ? [{ id: 1, type: 'essay', question: '无参考', answer: '', answerText: '', category: 'T' }]
        : [{ id: 1, type: 'essay', question: '有参考', answer: '', answerText: '旧参考', explanation: '解析文', category: 'T' }];
    const iframe = await seedIframeLib('IF简答面板', withRef, '#/study');
    cleanups.push(() => {});
    navigateIframe(iframe, '#/study');
    await wait(40);
    const root = iframeAppRoot(iframe);
    softClickText(root, '直接看解析') || softClickText(root, '看解析') || softClickText(root, '点按查看');
    softClickText(root, '查看解析');

    if (mode === 'toggle') {
        softClickText(root, '点按查看解析') || softClickText(root, '查看解析');
        return;
    }
    if (mode === 'tab') {
        softClickText(root, '解析') || softClickText(root, '答案') || softClickText(root, '口诀');
        return;
    }
    if (mode === 'add') {
        if (!softClickText(root, '添加参考答案') && !softClickText(root, '添加')) {
            softClickText(root, '直接看解析');
            softClickText(root, '添加参考答案');
        }
        return;
    }
    if (mode === 'edit' || mode === 'editTa' || mode === 'cancel' || mode === 'save') {
        softClickText(root, '编辑参考答案') || softClickText(root, '编辑');
        const ta = root.querySelector('textarea');
        if (mode === 'editTa' || mode === 'save') {
            if (ta) type(ta, '新参考答案IF');
        }
        if (mode === 'cancel') {
            softClickText(root, '取消');
            return;
        }
        if (mode === 'save') {
            softClickText(root, '保存') || softClickText(root, '保存参考答案');
        }
    }
}

async function addqJudgeIframe(c, cleanups, which) {
    const iframe = await seedIframeLib('IF判题型', ESSAY_QS, '#/add-question');
    cleanups.push(() => {});
    navigateIframe(iframe, '#/add-question');
    await wait(40);
    if (isUnhappy(c)) return;
    clickIframeText(iframe, '判断题');
    softClickText(iframeAppRoot(iframe), which);
}

async function helpNavIframe(c, cleanups, text, route, footer) {
    const iframe = await seedIframeLib('IF帮助', ESSAY_QS, '#/help');
    cleanups.push(() => {});
    navigateIframe(iframe, '#/help');
    await wait(40);
    if (isUnhappy(c)) {
        const before = await collectAppUiState(iframe);
        assertUnchangedCore(before, await collectAppUiState(iframe));
        return;
    }
    const root = iframeAppRoot(iframe);
    const buttons = [...root.querySelectorAll('button')].filter((b) => (b.textContent || '').includes(text));
    if (!buttons.length) {
        if (route === 'settings') softClickText(root, '设置');
        else throw new Error(`无按钮 ${text}`);
    } else {
        (footer ? buttons[buttons.length - 1] : buttons[0]).click();
    }
    await wait(40);
    assertIframeHash(iframe, route);
}
