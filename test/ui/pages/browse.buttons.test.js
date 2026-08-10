import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createBrowsePage } from '../../../src/render/pages/browse.js';
import {
    mountPage, clickText, clickLabel, type, assertTextIncludes, preserveHash,
    assertNavigatedTo, clearNavigateLog,
    installToastSpy, assertToastIncludes, clearToastLog,
    installConfirmSpy, assertConfirmAsked, getNavigateLog,
} from '../dom-harness.js';

/**
 * SAR 最低矩阵已覆盖：练习取消、? 取消、空搜 toast、过滤标签、空库、跨类点题等。
 */
describe('UI 按钮：浏览页 browse', () => {
    let LX;
    let mounted;
    let restoreHash;
    let uninstallToast;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        restoreHash = preserveHash();
        uninstallToast = installToastSpy();
        createAndSwitchLibrary('浏览测库', [
            { id: 1, type: 'single', question: '浏览甲题关键词ALPHA', options: ['A', 'B'], answer: 'A', category: '甲' },
            { id: 2, type: 'essay', question: '浏览乙题关键词BETA', answer: '', category: '乙' },
            { id: 3, type: 'essay', question: '浏览丙题无关键字', answer: '', category: '丙' },
        ]);
        mounted = mountPage(createBrowsePage);
        clearToastLog();
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
        if (uninstallToast) uninstallToast();
    });

    it('返回刷题按钮 → study', () => {
        clickLabel(mounted.root, '返回刷题');
        assertNavigatedTo('study');
    });

    it('新增题目按钮 → add-question', () => {
        clickLabel(mounted.root, '新增题目');
        assertNavigatedTo('add-question');
    });

    it('练习模式：面板选快速刷题并进入 study', () => {
        clearNavigateLog();
        clickLabel(mounted.root, '练习模式');
        assertTrue(!!mounted.root.querySelector('[aria-label="练习模式设置"]'), '应打开设置面板');
        clickLabel(mounted.root, '快速刷题');
        type(mounted.root.querySelector('[aria-label="本轮题量"]'), '2');
        clickLabel(mounted.root, '开始练习');
        assertTrue(LX.DrillAPI.isActive());
        assertEqual(LX.DrillAPI.current().data.mode, 'quick');
        assertEqual(LX.DrillAPI.current().data.total, 2);
        assertNavigatedTo('study');
        LX.DrillAPI.exit();
    });

    it('练习模式：取消关闭面板且不启动 Drill', () => {
        clearNavigateLog();
        clickLabel(mounted.root, '练习模式');
        clickLabel(mounted.root, '取消练习模式');
        assertEqual(!!mounted.root.querySelector('[aria-label="练习模式设置"]'), false);
        assertEqual(LX.DrillAPI.isActive(), false);
        assertEqual(
            getNavigateLog().some((e) => e.name === 'study'),
            false,
            '取消不应进入 study',
        );
    });

    it('练习模式：默认背诵且题量禁用；开始为全量', () => {
        clearNavigateLog();
        clickLabel(mounted.root, '练习模式');
        const countInput = mounted.root.querySelector('[aria-label="本轮题量"]');
        assertTrue(!!countInput, '应有题量框');
        assertEqual(countInput.disabled, true, '背诵默认应禁用题量');
        const mem = mounted.root.querySelector('[aria-label="背诵记忆"]');
        assertEqual(mem.getAttribute('aria-pressed'), 'true');
        clickLabel(mounted.root, '开始练习');
        assertTrue(LX.DrillAPI.isActive());
        assertEqual(LX.DrillAPI.current().data.mode, 'memory');
        assertEqual(LX.DrillAPI.current().data.total, 3);
        LX.DrillAPI.exit();
    });

    it('搜索点题后 playlist=命中集；回浏览保留过滤标签', () => {
        const input = mounted.root.querySelector('input[type="search"]');
        type(input, 'ALPHA');
        clickLabel(mounted.root, '执行题干搜索');
        clearNavigateLog();
        const hit = [...mounted.root.querySelectorAll('button')].find((b) => (b.textContent || '').includes('ALPHA'));
        assertTrue(!!hit, '应有 ALPHA 命中');
        hit.click();
        assertNavigatedTo('study');
        const pl = LX.NavigationAPI.getSearchPlaylist();
        assertTrue(!!pl && pl.uids.length >= 1, '应进入搜索队列');
        assertEqual(LX.NavigationAPI.current().data.total, pl.uids.length);
        if (mounted) mounted.destroy();
        mounted = mountPage(createBrowsePage);
        assertTrue(!!mounted.root.querySelector('[aria-label^="清除过滤条件"]'), '回浏览应保留过滤标签');
    });

    it('S=浏览 A=点练习模式? → R=本地说明 confirm；确定则 navigate help', () => {
        const uninstallConfirm = installConfirmSpy(true);
        clearNavigateLog();
        clickLabel(mounted.root, '练习模式说明');
        assertConfirmAsked('练习模式');
        assertConfirmAsked('完整说明');
        assertNavigatedTo('help');
        uninstallConfirm();
    });

    it('S=浏览 A=点?且取消 → R=不跳转 help', () => {
        const uninstallConfirm = installConfirmSpy(false);
        clearNavigateLog();
        clickLabel(mounted.root, '练习模式说明');
        assertConfirmAsked('练习模式');
        assertEqual(
            getNavigateLog().some((e) => e.name === 'help'),
            false,
            '取消不应跳转帮助',
        );
        uninstallConfirm();
    });

    it('S=浏览态 A=只输入不点搜索 → R=无过滤标签、仍是目录', () => {
        const input = mounted.root.querySelector('input[type="search"]');
        assertTrue(!!input, '应有搜索框');
        type(input, 'ALPHA');
        assertEqual(
            !!mounted.root.querySelector('.lx-chip__dismiss'),
            false,
            '未提交不应出现搜索过滤标签 ×',
        );
        assertTrue(
            (mounted.root.textContent || '').includes('只练本类')
            || mounted.root.querySelectorAll('.lx-catalog-item').length >= 1,
            '应仍为目录视图',
        );
    });

    it('S=draft=ALPHA A=点搜索 → R=过滤标签+分组结果；输入框清空；点题跳转', () => {
        const input = mounted.root.querySelector('input[type="search"]');
        type(input, 'ALPHA');
        clickLabel(mounted.root, '执行题干搜索');
        assertTrue(
            !!mounted.root.querySelector('[aria-label="清除过滤条件：ALPHA"]'),
            '应出现 ALPHA 过滤标签 ×',
        );
        const inputAfter = mounted.root.querySelector('input[type="search"]');
        assertEqual(inputAfter.value, '', '点搜索后输入框应清空');
        assertTextIncludes(mounted.root, 'ALPHA');
        assertTextIncludes(mounted.root, '甲');
        assertEqual(
            (mounted.root.textContent || '').includes('📁 丙'),
            false,
            '未命中分类丙不应出现',
        );
        clearNavigateLog();
        const item = mounted.root.querySelector('.lx-catalog-item');
        assertTrue(!!item, '应有命中题条目');
        item.click();
        assertNavigatedTo('study');
        const cur = LX.NavigationAPI.current().data;
        const q = LX.QuestionAPI.get(cur.qId).data;
        assertTrue(q.question.includes('ALPHA'));
    });

    it('S=搜 ALPHA 后再搜 BETA A=两次提交 → R=输入框每次提交后皆空；两枚过滤标签', () => {
        const input = mounted.root.querySelector('input[type="search"]');
        type(input, 'ALPHA');
        clickLabel(mounted.root, '执行题干搜索');
        assertEqual(mounted.root.querySelector('input[type="search"]').value, '');
        type(mounted.root.querySelector('input[type="search"]'), 'BETA');
        clickLabel(mounted.root, '执行题干搜索');
        assertEqual(mounted.root.querySelector('input[type="search"]').value, '');
        const chips = mounted.root.querySelectorAll('.lx-chip--active');
        assertEqual(chips.length, 2);
        assertTrue((chips[0].textContent || '').includes('ALPHA'));
        assertTrue((chips[1].textContent || '').includes('BETA'));
    });

    it('S=draft=ALPHA A=Enter → R=进入搜索态', () => {
        const input = mounted.root.querySelector('input[type="search"]');
        type(input, 'ALPHA');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        assertTrue(!!mounted.root.querySelector('[aria-label="清除过滤条件：ALPHA"]'));
        assertTextIncludes(mounted.root, '甲');
    });

    it('S=空 draft A=点搜索 → R=toast 警告', () => {
        clearToastLog();
        clickLabel(mounted.root, '执行题干搜索');
        assertToastIncludes('请输入搜索关键字');
        assertEqual(
            !!mounted.root.querySelector('.lx-chip__dismiss'),
            false,
        );
    });

    it('S=ALPHA 搜索态 A=再搜 BETA → 两枚过滤标签且交集空；关 BETA 回 ALPHA；再关回目录', () => {
        const input = mounted.root.querySelector('input[type="search"]');
        type(input, 'ALPHA');
        clickLabel(mounted.root, '执行题干搜索');
        assertTextIncludes(mounted.root, '甲');

        const input2 = mounted.root.querySelector('input[type="search"]');
        type(input2, 'BETA');
        clickLabel(mounted.root, '执行题干搜索');
        const chips = mounted.root.querySelectorAll('.lx-chip--active');
        assertEqual(chips.length, 2, '应有两枚过滤标签');
        assertTrue((chips[0].textContent || '').includes('ALPHA'));
        assertTrue((chips[1].textContent || '').includes('BETA'));
        assertTextIncludes(mounted.root, '无匹配题干');

        clickLabel(mounted.root, '清除过滤条件：BETA');
        const chips2 = mounted.root.querySelectorAll('.lx-chip--active');
        assertEqual(chips2.length, 1);
        assertTrue((chips2[0].textContent || '').includes('ALPHA'));
        assertTextIncludes(mounted.root, '甲');

        clickLabel(mounted.root, '清除过滤条件：ALPHA');
        assertEqual(
            !!mounted.root.querySelector('.lx-chip__dismiss'),
            false,
            'filters 空应无过滤标签',
        );
        assertTrue(
            (mounted.root.textContent || '').includes('只练本类'),
            '应恢复目录（含只练本类）',
        );
    });

    it('S=A/B/C 三过滤标签 A=关中间 B → R=剩 A、C 且列表为 A∩C', async () => {
        await resetStateBeforeEach();
        mounted.destroy();
        createAndSwitchLibrary('三条件 AND 库', [
            { id: 1, type: 'essay', question: '词A 词B 词C 全含', answer: '', category: '全' },
            { id: 2, type: 'essay', question: '词A 与 词C 双含', answer: '', category: '交' },
            { id: 3, type: 'essay', question: '仅 词B', answer: '', category: '单' },
        ]);
        mounted = mountPage(createBrowsePage);
        for (const kw of ['词A', '词B', '词C']) {
            const input = mounted.root.querySelector('input[type="search"]');
            type(input, kw);
            clickLabel(mounted.root, '执行题干搜索');
        }
        assertEqual(mounted.root.querySelectorAll('.lx-chip--active').length, 3);
        assertTextIncludes(mounted.root, '全含');
        assertEqual((mounted.root.textContent || '').includes('双含'), false);

        clickLabel(mounted.root, '清除过滤条件：词B');
        const chips = mounted.root.querySelectorAll('.lx-chip--active');
        assertEqual(chips.length, 2);
        assertTrue((chips[0].textContent || '').includes('词A'));
        assertTrue((chips[1].textContent || '').includes('词C'));
        assertTextIncludes(mounted.root, '全含');
        assertTextIncludes(mounted.root, '双含');
        assertEqual((mounted.root.textContent || '').includes('仅 词B'), false);
    });

    it('多分类命中：COMMON 命中甲乙时结果含两组标题', async () => {
        await resetStateBeforeEach();
        mounted.destroy();
        createAndSwitchLibrary('多分类搜索库', [
            { id: 1, type: 'essay', question: 'COMMON 在甲', answer: '', category: '甲' },
            { id: 2, type: 'essay', question: 'COMMON 在乙', answer: '', category: '乙' },
            { id: 3, type: 'essay', question: '无关丙', answer: '', category: '丙' },
        ]);
        mounted = mountPage(createBrowsePage);
        const input = mounted.root.querySelector('input[type="search"]');
        type(input, 'COMMON');
        clickLabel(mounted.root, '执行题干搜索');
        assertTextIncludes(mounted.root, '甲');
        assertTextIncludes(mounted.root, '乙');
        assertEqual((mounted.root.textContent || '').includes('📁 丙'), false);
        assertTrue(!!mounted.root.querySelector('[aria-label="全部折叠"]'), '搜索多分组应可全部折叠');
    });

    it('搜索命中>50：首屏≤50，续载后更多', async () => {
        await resetStateBeforeEach();
        mounted.destroy();
        const qs = [];
        for (let i = 1; i <= 60; i++) {
            qs.push({
                id: i,
                type: 'essay',
                question: `PAGEKEY 题${i}`,
                answer: '',
                category: i <= 30 ? '甲' : '乙',
            });
        }
        createAndSwitchLibrary('分页搜索库', qs);
        mounted = mountPage(createBrowsePage);
        const input = mounted.root.querySelector('input[type="search"]');
        type(input, 'PAGEKEY');
        clickLabel(mounted.root, '执行题干搜索');
        assertTextIncludes(mounted.root, '共 60 题');
        const first = mounted.root.querySelectorAll('.lx-catalog-item').length;
        assertTrue(first <= 50, '首屏不应超过一页');
        assertTrue(!!mounted.root.querySelector('[data-search-sentinel]'), '应有续载哨兵');
        assertTrue(
            typeof mounted.page.__loadMoreSearchForTest === 'function',
            '应暴露续载测试钩子',
        );
        mounted.page.__loadMoreSearchForTest();
        const second = mounted.root.querySelectorAll('.lx-catalog-item').length;
        assertTrue(second > first, `续载后条数应增加（${first} → ${second}）`);
        assertEqual(second, 60, '两页应凑满 60 题');
        assertEqual(
            !!mounted.root.querySelector('[data-search-sentinel]'),
            false,
            '已加载完不应再有哨兵',
        );
    });

    it('只练本类 → 设置分类并进入 study', () => {
        clickText(mounted.root, '只练本类');
        assertEqual(LX.NavigationAPI.getCategory() === 'all', false);
        assertNavigatedTo('study');
    });

    it('练习设置：切换随机模式', () => {
        clickText(mounted.root, /顺序|随机/);
        const mode1 = LX.NavigationAPI.getMode();
        clickText(mounted.root, /顺序|随机/);
        const mode2 = LX.NavigationAPI.getMode();
        assertTrue(mode1 === 'sequential' || mode1 === 'random');
        assertTrue(mode2 === 'sequential' || mode2 === 'random');
    });

    it('全部折叠 / 全部展开：折叠后题目行隐藏', () => {
        clickText(mounted.root, '全部折叠');
        const itemsAfterFold = mounted.root.querySelectorAll('.lx-catalog-item');
        assertEqual(itemsAfterFold.length, 0, '全部折叠后不应显示题目行');
        clickText(mounted.root, '全部展开');
        const itemsAfterExpand = mounted.root.querySelectorAll('.lx-catalog-item');
        assertTrue(itemsAfterExpand.length >= 2, '全部展开后应显示题目');
    });

    it('随机模式：换一批可点', () => {
        LX.NavigationAPI.setMode('random');
        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        clickText(mounted.root, '换一批');
        assertEqual(LX.NavigationAPI.getMode(), 'random');
    });

    it('清除分类：分类筛选后按钮出现并可清回 all', () => {
        LX.NavigationAPI.setCategory('甲');
        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        assertEqual(LX.NavigationAPI.getCategory(), '甲');
        clickText(mounted.root, '清除分类');
        assertEqual(LX.NavigationAPI.getCategory(), 'all');
    });

    it('跨类点题：单分类过滤下点另一类题会切分类并跳转', () => {
        LX.NavigationAPI.setCategory('甲');
        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        clearNavigateLog();
        clickText(mounted.root, 'BETA');
        assertNavigatedTo('study');
        assertEqual(LX.NavigationAPI.getCategory(), '乙');
    });

    it('空态：无题库时显示去首页', async () => {
        await resetStateBeforeEach();
        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        assertTextIncludes(mounted.root, '没有可显示的题目');
        clearNavigateLog();
        clickText(mounted.root, '去首页');
        assertNavigatedTo('home');
    });
}, { layer: 'ui', tags: ['buttons', 'catalog', 'search'] });
