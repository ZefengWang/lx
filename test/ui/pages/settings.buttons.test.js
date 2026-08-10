import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue, assertOk } from '../../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createSettingsPage } from '../../../src/render/pages/settings.js';
import { setTheme, setMode } from '../../../src/render/theme.js';
import {
    mountPage, clickText, assertTextIncludes, preserveHash,
    assertNavigatedTo, clearNavigateLog,
    installToastSpy, assertToastIncludes, clearToastLog,
    installDownloadSpy, assertDownloaded, getDownloadLog,
    installConfirmSpy, assertConfirmAsked, getConfirmLog,
} from '../dom-harness.js';

function assignFile(input, file) {
    assertTrue(!!input, 'file input 为空');
    if (typeof DataTransfer === 'undefined') {
        throw new Error('当前浏览器不支持 DataTransfer，无法模拟选文件');
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function libFileInput(root) {
    return [...root.querySelectorAll('input[type="file"]')]
        .find((el) => (el.accept || '').includes('xlsx'));
}

function progressFileInput(root) {
    return [...root.querySelectorAll('input[type="file"]')]
        .find((el) => (el.accept || '') === '.json' || (el.accept || '') === '.json,application/json');
}

/**
 * SAR 最低矩阵已覆盖：主题/夜间、导出成败、重置取消、删库、切库、空 JSON 上传、恢复进度等。
 */
describe('UI 按钮：设置页 settings（SAR）', () => {
    let LX;
    let mounted;
    let restoreHash;
    let uninstallToast;
    let uninstallDownload;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        // 避免上一用例留下的主题/模式干扰断言
        setTheme('default');
        setMode('normal');
        restoreHash = preserveHash();
        uninstallToast = installToastSpy();
        uninstallDownload = installDownloadSpy();
        createAndSwitchLibrary('设置SAR库', [
            { id: 1, type: 'essay', question: '设置题', answer: '', category: 'A' },
        ]);
        mounted = mountPage(createSettingsPage);
        clearToastLog();
        clearNavigateLog();
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
        if (uninstallToast) uninstallToast();
        if (uninstallDownload) uninstallDownload();
    });

    it('S=有题库 A=查看使用帮助 → R=navigate help', () => {
        clickText(mounted.root, '查看使用帮助');
        assertNavigatedTo('help');
    });

    it('S=有题库 A=点主题「红」→ R=data-theme=red + toast', () => {
        const red = [...mounted.root.querySelectorAll('button[title]')]
            .find((b) => (b.getAttribute('title') || '').includes('红'));
        assertTrue(!!red, '应有主题色「红」');
        red.click();
        assertEqual(document.documentElement.getAttribute('data-theme'), 'red');
        assertToastIncludes('已切换主题');
    });

    it('S=显示模式普通 A=点夜间/护眼 → R=页面仍可用且有模式项', () => {
        clickText(mounted.root, /夜间|护眼|普通/);
        assertTrue(mounted.root.isConnected);
        assertTextIncludes(mounted.root, /夜间|护眼|普通/);
    });

    it('S=有题库 A=导出 JSON → R=download + toast 成功', () => {
        clickText(mounted.root, 'JSON');
        assertDownloaded('.json');
        assertToastIncludes('已导出');
        assertTrue(getDownloadLog()[0].size > 0);
    });

    it('S=有进度 A=备份进度 → R=download progress-backup', () => {
        const q = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q, 'mastered');
        mounted.destroy();
        mounted = mountPage(createSettingsPage);
        clearToastLog();
        clickText(mounted.root, '备份进度');
        assertDownloaded('progress-backup');
        assertToastIncludes('进度已备份');
    });

    it('S=有进度 + confirm 同意 A=重置进度 → R=状态清空 + toast', () => {
        const q = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q, 'review');
        mounted.destroy();
        mounted = mountPage(createSettingsPage);
        clearToastLog();
        clickText(mounted.root, '重置当前题库进度');
        assertConfirmAsked('重置');
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'none');
        assertToastIncludes('进度已重置');
    });

    it('S=有进度 + confirm 取消 A=重置 → R=状态不变', () => {
        const q = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q, 'mastered');
        const off = installConfirmSpy(false);
        mounted.destroy();
        mounted = mountPage(createSettingsPage);
        clickText(mounted.root, '重置当前题库进度');
        assertTrue(getConfirmLog().length >= 1);
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'mastered');
        off(); // 必须恢复为始终同意，禁止卸成 null
    });

    it('S=双库 A=删除「待删库」confirm 同意 → R=库减少 + toast', () => {
        const r = LX.LibraryAPI.create('待删库', [
            { id: 1, type: 'essay', question: 'x', answer: '' },
        ], { skipDuplicateCheck: true });
        assertOk(r);
        mounted.destroy();
        mounted = mountPage(createSettingsPage);
        clearToastLog();
        const before = LX.LibraryAPI.list().data.length;
        const row = [...mounted.root.querySelectorAll('.lx-list__item')]
            .find((el) => (el.textContent || '').includes('待删库'));
        assertTrue(!!row, '应渲染待删库行');
        const delBtn = [...row.querySelectorAll('button')]
            .find((b) => (b.textContent || '').trim() === '删除');
        assertTrue(!!delBtn, '应有删除按钮');
        delBtn.click();
        assertConfirmAsked('删除');
        const after = LX.LibraryAPI.list().data.length;
        assertEqual(after, before - 1);
        assertToastIncludes('已删除');
    });

    it('S=双库 A=点「切换」→ R=current 变更 + toast', () => {
        const r = LX.LibraryAPI.create('切换目标库', [
            { id: 1, type: 'essay', question: 'y', answer: '' },
        ], { skipDuplicateCheck: true });
        assertOk(r);
        mounted.destroy();
        mounted = mountPage(createSettingsPage);
        clearToastLog();
        const row = [...mounted.root.querySelectorAll('.lx-list__item')]
            .find((el) => (el.textContent || '').includes('切换目标库'));
        assertTrue(!!row, '应渲染切换目标库行');
        const sw = [...row.querySelectorAll('button')]
            .find((b) => (b.textContent || '').trim() === '切换');
        assertTrue(!!sw, '非当前库应有切换按钮');
        sw.click();
        assertEqual(LX.LibraryAPI.current().data, r.data.id);
        assertToastIncludes('已切换到');
    });

    it('S=有题库 A=导出 Excel → R=download .xlsx（无 SheetJS 则跳过）', () => {
        if (typeof window.XLSX === 'undefined') {
            assertTrue(true, 'SheetJS 未加载，跳过 Excel 导出断言');
            return;
        }
        clickText(mounted.root, 'Excel');
        assertDownloaded('.xlsx');
        assertToastIncludes('已导出');
    });

    it('S=有题库 A=导出 CSV（API 不支持）→ R=toast 失败', () => {
        clearToastLog();
        clickText(mounted.root, 'CSV');
        assertToastIncludes(/导出失败|不支持/);
    });

    it('S=有 SheetJS A=下载导入模板 → R=download template（无则跳过）', () => {
        if (typeof window.XLSX === 'undefined') {
            assertTrue(true, 'SheetJS 未加载，跳过模板下载断言');
            return;
        }
        clearToastLog();
        clickText(mounted.root, '下载导入模板');
        assertDownloaded('lx-template');
        assertToastIncludes('模板已下载');
    });

    it('S=显示模式 A=点夜间模式 → R=data-mode=night + toast', () => {
        clickText(mounted.root, '夜间模式');
        assertEqual(document.documentElement.getAttribute('data-mode'), 'night');
        assertToastIncludes(/切换|夜间/);
    });

    it('S=合法 JSON 文件 A=上传新题库 → R=导入成功 toast', async () => {
        const qs = [
            { id: 1, type: 'essay', question: '导入题干IMPORT99', answer: '', category: 'I' },
        ];
        const file = LX.TestAPI.mockFile(JSON.stringify(qs), '导入SAR库.json');
        assignFile(libFileInput(mounted.root), file);
        clearToastLog();
        await new Promise((r) => setTimeout(r, 200));
        assertToastIncludes(/成功导入|导入/);
        assertTrue(
            LX.QuestionAPI.search('IMPORT99').data.total >= 1
            || LX.LibraryAPI.list().data.some((l) => (l.name || '').includes('导入SAR')),
        );
    });

    it('S=空题目 JSON A=上传 → R=toast 没有题目', async () => {
        const file = LX.TestAPI.mockFile(JSON.stringify([]), '空库.json');
        assignFile(libFileInput(mounted.root), file);
        clearToastLog();
        await new Promise((r) => setTimeout(r, 200));
        assertToastIncludes(/没有题目|解析失败|检查格式/);
    });

    it('S=有备份 JSON A=恢复进度 → R=状态恢复 + toast', async () => {
        const q = LX.QuestionAPI.get(1).data;
        LX.ProgressAPI.setStatus(q, 'mastered');
        const exported = LX.ProgressAPI.export();
        assertOk(exported);
        LX.ProgressAPI.reset();
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'none');

        mounted.destroy();
        mounted = mountPage(createSettingsPage);
        const input = progressFileInput(mounted.root);
        assertTrue(!!input, '应有进度恢复 input');
        const file = LX.TestAPI.mockFile(exported.data, 'progress.json');
        assignFile(input, file);
        clearToastLog();
        await new Promise((r) => setTimeout(r, 200));
        assertToastIncludes('进度已恢复');
        assertEqual(LX.ProgressAPI.getStatus(q).data, 'mastered');
    });
}, { layer: 'ui', tags: ['buttons', 'settings', 'sar'] });
