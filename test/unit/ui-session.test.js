import { describe, it, beforeEach } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import {
    getBrowseSearch, setBrowseSearch, clearBrowseSearch,
    getPracticeSheet, setPracticeSheet, closePracticeSheet, getUiSession,
    __resetUiSessionForTest,
} from '../../src/render/session/index.js';

describe('UiSession：跨页 UI 上下文', () => {
    beforeEach(() => {
        __resetUiSessionForTest();
    });

    it('browseSearch 读写与清空', () => {
        setBrowseSearch({ filters: ['甲', '乙'], draft: '乙' });
        assertEqual(getBrowseSearch().filters.join(','), '甲,乙');
        assertEqual(getBrowseSearch().draft, '乙');
        clearBrowseSearch();
        assertEqual(getBrowseSearch().filters.length, 0);
        assertEqual(getBrowseSearch().draft, '');
    });

    it('setBrowseSearch 部分更新：只改 draft 时保留 filters', () => {
        setBrowseSearch({ filters: ['A'], draft: 'A' });
        setBrowseSearch({ draft: 'B' });
        assertEqual(getBrowseSearch().filters.join(','), 'A');
        assertEqual(getBrowseSearch().draft, 'B');
    });

    it('getBrowseSearch 返回副本：外改 filters 不污染 session', () => {
        setBrowseSearch({ filters: ['稳'], draft: '' });
        const snap = getBrowseSearch();
        snap.filters.push('脏');
        assertEqual(getBrowseSearch().filters.join(','), '稳');
    });

    it('practiceSheet 默认背诵；关闭后 open=false 且保留 mode', () => {
        assertEqual(getPracticeSheet().mode, 'memory');
        assertEqual(getPracticeSheet().open, false);
        setPracticeSheet({ open: true, mode: 'quick', countDraft: '20' });
        assertEqual(getPracticeSheet().open, true);
        assertEqual(getPracticeSheet().mode, 'quick');
        assertEqual(getPracticeSheet().countDraft, '20');
        closePracticeSheet();
        assertEqual(getPracticeSheet().open, false);
        assertEqual(getPracticeSheet().mode, 'quick');
        assertEqual(getPracticeSheet().countDraft, '20');
    });

    it('非法 mode 被忽略；getUiSession 含两块快照', () => {
        setPracticeSheet({ mode: 'memory' });
        setPracticeSheet({ mode: 'nope' });
        assertEqual(getPracticeSheet().mode, 'memory');
        setBrowseSearch({ filters: ['x'], draft: 'x' });
        const all = getUiSession();
        assertEqual(all.browseSearch.filters.join(','), 'x');
        assertTrue(all.practiceSheet.mode === 'memory');
    });

    it('__reset 后恢复初始态', () => {
        setBrowseSearch({ filters: ['z'], draft: 'z' });
        setPracticeSheet({ open: true, mode: 'quick', countDraft: '9' });
        __resetUiSessionForTest();
        assertEqual(getBrowseSearch().filters.length, 0);
        assertEqual(getPracticeSheet().open, false);
        assertEqual(getPracticeSheet().mode, 'memory');
        assertEqual(getPracticeSheet().countDraft, '100');
    });
}, { layer: 'ui', tags: ['ui-session'] });
