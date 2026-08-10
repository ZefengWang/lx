import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createHomePage } from '../../../src/render/pages/home.js';
import {
    mountPage, clickText, assertTextIncludes, preserveHash, installNavigateSpy, assertNavigatedTo, clearNavigateLog,
} from '../dom-harness.js';

/**
 * SAR 最低矩阵已覆盖：开始学习/帮助成功导航；切库；无题库空态对照。
 * 上传文件取消/失败见 settings.buttons + ui-sar-matrix。
 */
describe('UI 按钮：首页 home', () => {
    let LX;
    let mounted;
    let restoreHash;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        restoreHash = preserveHash();
        createAndSwitchLibrary('首页测库', [
            { id: 1, type: 'single', question: '首页题', options: ['A', 'B'], answer: 'A', category: 'A' },
        ]);
        mounted = mountPage(createHomePage);
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
    });

    it('渲染题库名与「开始学习」按钮', () => {
        assertTextIncludes(mounted.root, '首页测库');
        assertTextIncludes(mounted.root, '开始学习');
        assertTextIncludes(mounted.root, '使用帮助');
    });

    it('点击「开始学习」→ navigate study', () => {
        clickText(mounted.root, '开始学习');
        assertNavigatedTo('study');
    });

    it('点击「使用帮助」→ navigate help', () => {
        clickText(mounted.root, '使用帮助');
        assertNavigatedTo('help');
    });

    it('点击题库列表项 → switch + navigate study', () => {
        const lib2 = LX.LibraryAPI.create('第二库', [
            { id: 1, type: 'essay', question: 'x', answer: '', category: 'A' },
        ]);
        assertTrue(lib2.ok);
        // 重新渲染以显示两个库
        mounted.destroy();
        mounted = mountPage(createHomePage);
        clickText(mounted.root, '第二库');
        assertEqual(LX.LibraryAPI.current().data, lib2.data.id);
        assertNavigatedTo('study');
    });

    it('S=无题库 A=挂载 → R=空态可点上传/引导（不崩溃）', async () => {
        await resetStateBeforeEach();
        LX = getLX();
        mounted.destroy();
        mounted = mountPage(createHomePage);
        assertTextIncludes(mounted.root, /题库|上传|开始|帮助|空/);
        assertTrue(mounted.root.isConnected);
    });

    it('S=无题库 A=挂载 → R=显示「加载示例题库」按钮', async () => {
        await resetStateBeforeEach();
        LX = getLX();
        mounted.destroy();
        mounted = mountPage(createHomePage);
        assertTextIncludes(mounted.root, '加载示例题库');
        assertTrue(!!mounted.root.querySelector('[data-testid="load-default-library"]'));
    });

    it('S=无题库 A=点击「加载示例题库」→ R=创建题库 + navigate study', async () => {
        await resetStateBeforeEach();
        LX = getLX();
        mounted.destroy();
        mounted = mountPage(createHomePage);
        clearNavigateLog();

        clickText(mounted.root, '加载示例题库');

        // 题库应被创建并 switch
        const list = LX.LibraryAPI.list().data;
        assertEqual(list.length, 1, '应创建 1 个题库');
        assertEqual(list[0].name, '通识综合示例题库');
        assertEqual(LX.LibraryAPI.current().data, list[0].id, '应已 switch');
        assertEqual(list[0].questionCount, 50);
        assertNavigatedTo('study');
    });

    it('S=有题库 A=挂载 → R=不显示「加载示例题库」按钮（非空态无此入口）', () => {
        // beforeEach 已 createAndSwitchLibrary，处于非空态
        assertTrue(!mounted.root.querySelector('[data-testid="load-default-library"]'),
            '非空状态不应显示加载示例题库按钮');
    });
}, { layer: 'ui', tags: ['buttons', 'home', 'sar'] });
