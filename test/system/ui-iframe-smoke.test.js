/**
 * iframe 整页协议冒烟：真入口 app.html?test=1 → 采 iframe 内 #app
 * @module test/system/ui-iframe-smoke.test
 */
import { describe, it } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import {
    resetAndSeedInIframe,
    collectAppUiState,
    navigateIframe,
    openIframeDrawer,
    clickIframeText,
    clickIframeLabel,
    clickMasteredButton,
    iframeAppRoot,
    assertIframeHash,
    syncPreviewHud,
    sarWatchPace,
} from './app-iframe-harness.js';
import { wait } from '../ui/dom-harness.js';

const QS = [
    { id: 1, type: 'single', question: '烟1', options: ['对', '错'], answer: 'A', category: 'A' },
    { id: 2, type: 'single', question: '烟2', options: ['对', '错'], answer: 'A', category: 'A' },
    { id: 3, type: 'single', question: '烟3', options: ['对', '错'], answer: 'A', category: 'A' },
];

describe('系统：iframe app.html 整页冒烟', () => {
    it('IFRAME-SMOKE-RESET：重置进度 → 顶栏 progressText 含 0/', async () => {
        const iframe = await resetAndSeedInIframe((LX) => {
            const r = LX.LibraryAPI.create('iframe烟重置', QS);
            if (!r.ok) throw new Error(r.error?.message || 'create');
            LX.LibraryAPI.switch(r.data.id);
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(1).data, 'mastered');
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(2).data, 'mastered');
        }, { hash: '#/study' });
        navigateIframe(iframe, '#/study');
        await wait(35);
        let st = await collectAppUiState(iframe);
        assertTrue((st.chrome.progressText || '').includes('2/'), st.chrome.progressText);
        // 证明采的是 iframe 整页：#app 内必有顶栏进度
        assertTrue(!!iframeAppRoot(iframe).querySelector('.lx-progress-text'));
        assertEqual(st.meta.hash.includes('study'), true);

        await openIframeDrawer(iframe);
        clickIframeText(iframe, '重置学习进度');
        await wait(25);
        st = await collectAppUiState(iframe);
        assertTrue((st.chrome.progressText || '').includes('0/'), `期望 0/N，实际=${st.chrome.progressText}`);
        assertEqual(st.domain.progress.mastered, 0);
    });

    it('IFRAME-SMOKE-WRONG-CELEBRATE：错题清空 → .lx-celebrate', async () => {
        const iframe = await resetAndSeedInIframe((LX) => {
            const r = LX.LibraryAPI.create('iframe烟错题', [
                { id: 1, type: 'single', question: '错烟', options: ['对', '错'], answer: 'A', category: 'W' },
            ]);
            LX.LibraryAPI.switch(r.data.id);
            LX.QuestionAPI.answer(1, 'B');
        }, { hash: '#/wrong' });
        navigateIframe(iframe, '#/wrong');
        await wait(35);
        const root = iframeAppRoot(iframe);
        clickMasteredButton(root);
        await wait(35);
        const st = await collectAppUiState(iframe);
        assertEqual(st.page.celebrateVisible, true);
        assertTrue(!!root.querySelector('.lx-celebrate'), 'DOM 应有 .lx-celebrate');
        assertEqual(st.chrome.wrongBadge, 0);
    });

    it('IFRAME-SMOKE-BOTTOMBAR-MASTERED：底栏掌握同步 progressText', async () => {
        const iframe = await resetAndSeedInIframe((LX) => {
            const r = LX.LibraryAPI.create('iframe烟掌握', QS);
            LX.LibraryAPI.switch(r.data.id);
        }, { hash: '#/study' });
        navigateIframe(iframe, '#/study');
        await wait(sarWatchPace());
        const before = await collectAppUiState(iframe);
        clickIframeLabel(iframe, '标记为已掌握');
        await wait(sarWatchPace());
        syncPreviewHud(iframe, 'smoke:mastered');
        const after = await collectAppUiState(iframe);
        assertEqual(after.domain.progress.currentStatus, 'mastered');
        assertTrue(
            (after.chrome.progressText || '').includes(`${after.domain.progress.mastered}/`),
            after.chrome.progressText,
        );
        assertTrue(after.domain.progress.mastered >= before.domain.progress.mastered + 1
            || after.chrome.bottombar.masteredPressed === true);
    });

    it('IFRAME-SMOKE-HASH：navigateIframe 驱动真路由', async () => {
        const iframe = await resetAndSeedInIframe((LX) => {
            const r = LX.LibraryAPI.create('iframe烟路由', QS);
            LX.LibraryAPI.switch(r.data.id);
        }, { hash: '#/study' });
        navigateIframe(iframe, '#/browse');
        await wait(25);
        assertIframeHash(iframe, 'browse');
        const st = await collectAppUiState(iframe);
        assertTrue((st.meta.hash || '').includes('browse'));
    });

    it('IFRAME-SMOKE-PROBE：TestAPI.probeUi 与 collectAppUiState 同源', async () => {
        const iframe = await resetAndSeedInIframe((LX) => {
            const r = LX.LibraryAPI.create('iframe烟probe', QS);
            LX.LibraryAPI.switch(r.data.id);
        }, { hash: '#/study' });
        navigateIframe(iframe, '#/study');
        await wait(25);
        const a = await collectAppUiState(iframe);
        const b = await iframe.contentWindow.LX.TestAPI.probeUi();
        assertEqual(a.chrome.progressText, b.chrome.progressText);
        assertEqual(a.domain.questionCount, b.domain.questionCount);
        assertTrue(a.page.hasProgressText === true);
    });
}, { layer: 'system', tags: ['iframe', 'ui-state', 'smoke'] });
