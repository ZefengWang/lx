/**
 * 浏览页 × UiSession × searchPlaylist 联调（计划验收补测）
 */
import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue, assertOk } from '../../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../../helpers.js';
import { createBrowsePage } from '../../../src/render/pages/browse.js';
import { createStudyPage } from '../../../src/render/pages/study.js';
import { getBrowseSearch, setBrowseSearch } from '../../../src/render/session/index.js';
import {
    mountPage, clickLabel, type, clearNavigateLog, assertNavigatedTo,
    preserveHash, installToastSpy, clearToastLog,
} from '../dom-harness.js';

describe('UI：浏览会话 / 搜索队列 / 练习面板', () => {
    let LX;
    let mounted;
    let restoreHash;
    let uninstallToast;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        restoreHash = preserveHash();
        uninstallToast = installToastSpy();
        clearToastLog();
    });

    afterEach(() => {
        if (mounted) mounted.destroy();
        mounted = null;
        if (restoreHash) restoreHash();
        if (uninstallToast) uninstallToast();
    });

    function mountBrowse(libName, questions) {
        createAndSwitchLibrary(libName, questions);
        mounted = mountPage(createBrowsePage);
        return mounted;
    }

    it('S=三命中 A=点其一 → R=playlist=3 且 next 只在三题循环', () => {
        mountBrowse('三命中库', [
            { id: 1, type: 'essay', question: '共享词 HIT 甲', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '无关题', answer: '', category: 'B' },
            { id: 3, type: 'essay', question: '共享词 HIT 乙', answer: '', category: 'A' },
            { id: 4, type: 'essay', question: '共享词 HIT 丙', answer: '', category: 'C' },
        ]);
        type(mounted.root.querySelector('input[type="search"]'), 'HIT');
        clickLabel(mounted.root, '执行题干搜索');
        clearNavigateLog();
        const hit = [...mounted.root.querySelectorAll('.lx-catalog-item')]
            .find((b) => (b.textContent || '').includes('HIT'));
        assertTrue(!!hit);
        hit.click();
        assertNavigatedTo('study');

        const pl = LX.NavigationAPI.getSearchPlaylist();
        assertTrue(!!pl);
        assertEqual(pl.uids.length, 3);
        assertEqual(LX.NavigationAPI.current().data.total, 3);

        const first = LX.NavigationAPI.current().data.qId;
        const seen = new Set([String(first)]);
        assertOk(LX.NavigationAPI.next());
        seen.add(String(LX.NavigationAPI.current().data.qId));
        assertOk(LX.NavigationAPI.next());
        seen.add(String(LX.NavigationAPI.current().data.qId));
        assertEqual(seen.size, 3, '三步应走到三道不同命中题');
        assertOk(LX.NavigationAPI.next());
        assertEqual(LX.NavigationAPI.current().data.qId, first, '第四步应循环回起点');
    });

    it('S=搜索进 study A=挂载 study → R=显示搜索范围 n/N', () => {
        mountBrowse('范围文案库', [
            { id: 1, type: 'essay', question: '范围词 X1', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '范围词 X2', answer: '', category: 'A' },
            { id: 3, type: 'essay', question: '其它', answer: '', category: 'B' },
        ]);
        type(mounted.root.querySelector('input[type="search"]'), '范围词');
        clickLabel(mounted.root, '执行题干搜索');
        mounted.root.querySelector('.lx-catalog-item').click();
        mounted.destroy();
        mounted = mountPage(createStudyPage);
        const badge = mounted.root.querySelector('[aria-label="搜索范围"]');
        assertTrue(!!badge, 'study 应显示搜索范围');
        assertTrue(
            /搜索范围\s+\d+\/2/.test(badge.textContent || ''),
            `文案应为 搜索范围 k/2，实际=${badge.textContent}`,
        );
    });

    it('S=playlist 中 A=关光过滤标签 → R=playlist 清空且 total 回全库', () => {
        mountBrowse('关标签清队列', [
            { id: 1, type: 'essay', question: '清队词 ONLY', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '旁路题', answer: '', category: 'B' },
        ]);
        type(mounted.root.querySelector('input[type="search"]'), '清队词');
        clickLabel(mounted.root, '执行题干搜索');
        mounted.root.querySelector('.lx-catalog-item').click();
        assertEqual(LX.NavigationAPI.getSearchPlaylist().uids.length, 1);

        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        clickLabel(mounted.root, '清除过滤条件：清队词');
        assertEqual(LX.NavigationAPI.getSearchPlaylist(), null, '关光标签应清 playlist');
        assertEqual(getBrowseSearch().filters.length, 0);
        assertEqual(LX.NavigationAPI.current().data.total, 2);
    });

    it('S=搜索态离页再挂载 → R=UiSession.filters 与过滤标签仍在', () => {
        mountBrowse('跨页保留', [
            { id: 1, type: 'essay', question: '保留词 KEEP', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '其它', answer: '', category: 'B' },
        ]);
        type(mounted.root.querySelector('input[type="search"]'), '保留词');
        clickLabel(mounted.root, '执行题干搜索');
        assertEqual(getBrowseSearch().filters.join(','), '保留词');
        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        assertEqual(getBrowseSearch().filters.join(','), '保留词');
        assertTrue(!!mounted.root.querySelector('[aria-label="清除过滤条件：保留词"]'));
        assertTrue((mounted.root.textContent || '').includes('KEEP'));
    });

    it('S=命中>50 A=点首屏题 → R=playlist 为全量 total 而非仅已加载页', () => {
        const qs = [];
        for (let i = 1; i <= 60; i++) {
            qs.push({
                id: i,
                type: 'essay',
                question: `批量词 BULK 第${i}题`,
                answer: '',
                category: '批',
            });
        }
        qs.push({ id: 999, type: 'essay', question: '噪声', answer: '', category: '其它' });
        mountBrowse('超量命中库', qs);
        type(mounted.root.querySelector('input[type="search"]'), 'BULK');
        clickLabel(mounted.root, '执行题干搜索');
        assertTrue((mounted.root.textContent || '').includes('共 60 题'));
        assertTrue(mounted.root.querySelectorAll('.lx-catalog-item').length <= 50);
        mounted.root.querySelector('.lx-catalog-item').click();
        const pl = LX.NavigationAPI.getSearchPlaylist();
        assertTrue(!!pl);
        assertEqual(pl.uids.length, 60, 'playlist 应为全量 60，不能只 50');
        assertEqual(LX.NavigationAPI.current().data.total, 60);
    });

    it('S=已有 playlist A=开始练习 → R=Drill 启动且 playlist 清空', () => {
        mountBrowse('练习清队列', [
            { id: 1, type: 'essay', question: '练清词 Z', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '练清词 Y', answer: '', category: 'A' },
        ]);
        type(mounted.root.querySelector('input[type="search"]'), '练清词');
        clickLabel(mounted.root, '执行题干搜索');
        mounted.root.querySelector('.lx-catalog-item').click();
        assertTrue(!!LX.NavigationAPI.getSearchPlaylist());

        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        clickLabel(mounted.root, '练习模式');
        clickLabel(mounted.root, '开始练习');
        assertTrue(LX.DrillAPI.isActive());
        assertEqual(LX.NavigationAPI.getSearchPlaylist(), null, 'Drill 应清掉搜索队列');
        LX.DrillAPI.exit();
    });

    it('S=练习面板 A=背诵→快速→背诵 → R=题量框禁用态切换', () => {
        mountBrowse('题量切换库', [
            { id: 1, type: 'essay', question: 't1', answer: '', category: 'A' },
        ]);
        clickLabel(mounted.root, '练习模式');
        let input = mounted.root.querySelector('[aria-label="本轮题量"]');
        assertEqual(input.disabled, true);
        clickLabel(mounted.root, '快速刷题');
        input = mounted.root.querySelector('[aria-label="本轮题量"]');
        assertEqual(input.disabled, false, '快速应可编辑题量');
        type(input, '1');
        clickLabel(mounted.root, '背诵记忆');
        input = mounted.root.querySelector('[aria-label="本轮题量"]');
        assertEqual(input.disabled, true, '切回背诵应再禁用');
    });

    it('S=只练本类甲 A=搜共享词 → R=仅甲类命中；点题 playlist 亦仅甲且分类保留', () => {
        mountBrowse('本类搜索库', [
            { id: 1, type: 'essay', question: '共享 SHARE 甲1', answer: '', category: '甲' },
            { id: 2, type: 'essay', question: '共享 SHARE 乙', answer: '', category: '乙' },
            { id: 3, type: 'essay', question: '共享 SHARE 甲2', answer: '', category: '甲' },
        ]);
        assertOk(LX.NavigationAPI.setCategory('甲'));
        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        assertEqual(LX.NavigationAPI.getCategory(), '甲');
        assertTrue((mounted.root.textContent || '').includes('当前仅练习分类：甲'));

        type(mounted.root.querySelector('input[type="search"]'), 'SHARE');
        clickLabel(mounted.root, '执行题干搜索');
        assertTrue(
            (mounted.root.textContent || '').includes('搜索范围：仅「甲」分类')
            || (mounted.root.querySelector('[aria-label="当前分类范围"]')?.textContent || '').includes('甲'),
        );
        assertTrue((mounted.root.textContent || '').includes('共 2 题'), '本类内应只有 2 命中');
        assertEqual(
            (mounted.root.textContent || '').includes('共享 SHARE 乙'),
            false,
            '乙类不应出现在本类搜索结果',
        );

        mounted.root.querySelector('.lx-catalog-item').click();
        assertEqual(LX.NavigationAPI.getSearchPlaylist().uids.length, 2);
        assertEqual(LX.NavigationAPI.getSearchPlaylist().category, '甲');
        assertEqual(LX.NavigationAPI.getCategory(), '甲', '跳转不得清掉只练本类');
        assertEqual(LX.NavigationAPI.current().data.total, 2);
    });

    it('S=本类搜索中 A=清除分类 → R=改为全库搜索命中变多', () => {
        mountBrowse('清分类扩搜', [
            { id: 1, type: 'essay', question: '扩搜词 W 甲', answer: '', category: '甲' },
            { id: 2, type: 'essay', question: '扩搜词 W 乙', answer: '', category: '乙' },
        ]);
        LX.NavigationAPI.setCategory('甲');
        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        type(mounted.root.querySelector('input[type="search"]'), '扩搜词');
        clickLabel(mounted.root, '执行题干搜索');
        assertTrue((mounted.root.textContent || '').includes('共 1 题'));
        clickLabel(mounted.root, '清除分类');
        assertEqual(LX.NavigationAPI.getCategory(), 'all');
        assertTrue((mounted.root.textContent || '').includes('共 2 题'), '清分类后应全库 2 命中');
    });

    it('S=playlist 残留 A=目录态点普通题 → R=clearSearchPlaylist', () => {
        mountBrowse('非搜索点题清队', [
            { id: 1, type: 'essay', question: '搜词 S1', answer: '', category: 'A' },
            { id: 2, type: 'essay', question: '普通题', answer: '', category: 'B' },
        ]);
        type(mounted.root.querySelector('input[type="search"]'), '搜词');
        clickLabel(mounted.root, '执行题干搜索');
        mounted.root.querySelector('.lx-catalog-item').click();
        assertTrue(!!LX.NavigationAPI.getSearchPlaylist());

        // 模拟：过滤标签已关但 playlist 曾残留——此处主动清 session filters，保留 playlist
        setBrowseSearch({ filters: [], draft: '' });
        // 不调用 clearSearchPlaylist，验证「点普通题」路径会清
        mounted.destroy();
        mounted = mountPage(createBrowsePage);
        assertEqual(getBrowseSearch().filters.length, 0);
        assertTrue(!!LX.NavigationAPI.getSearchPlaylist(), '挂载前 playlist 应仍在（故意残留）');
        const normal = [...mounted.root.querySelectorAll('.lx-catalog-item')]
            .find((b) => (b.textContent || '').includes('普通题'));
        assertTrue(!!normal);
        normal.click();
        assertEqual(LX.NavigationAPI.getSearchPlaylist(), null);
    });
}, { layer: 'ui', tags: ['browse', 'ui-session', 'search', 'sar'] });
