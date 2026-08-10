import { describe, it, beforeEach } from '../runner.js';
import { assertErr, assertOk, assertEqual } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';

/**
 * SAR：各 API 域典型错误码矩阵（成功路径见各域专测）
 */
describe('API 错误码矩阵（SAR 失败路径）', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('LibraryAPI：空名 INVALID；重复 DUPLICATE；get/switch/delete 不存在 NOT_FOUND', () => {
        assertErr(LX.LibraryAPI.create('', []), 'INVALID_INPUT');
        const qs = [{ id: 1, type: 'essay', question: '唯一定制题ERR', answer: '' }];
        assertOk(LX.LibraryAPI.create('L1', qs));
        assertErr(LX.LibraryAPI.create('L2', qs), 'DUPLICATE');
        assertErr(LX.LibraryAPI.get('no-such-lib'), 'NOT_FOUND');
        assertErr(LX.LibraryAPI.switch('no-such-lib'), 'NOT_FOUND');
        assertErr(LX.LibraryAPI.delete('no-such-lib'), 'NOT_FOUND');
    });

    it('QuestionAPI：未选题库 STATE_ERROR；空题干 INVALID；get/delete 不存在 NOT_FOUND', () => {
        assertErr(LX.QuestionAPI.add({ question: '无库' }), 'STATE_ERROR');
        assertErr(LX.QuestionAPI.get(1), 'STATE_ERROR');

        createAndSwitchLibrary('QErr', [
            { id: 1, type: 'essay', question: '存在', answer: '' },
        ]);
        assertErr(LX.QuestionAPI.add({ question: '' }), 'INVALID_INPUT');
        assertErr(LX.QuestionAPI.get(999), 'NOT_FOUND');
        assertErr(LX.QuestionAPI.update(999, { question: 'x' }), 'NOT_FOUND');
        assertErr(LX.QuestionAPI.delete(999), 'NOT_FOUND');
        assertErr(LX.QuestionAPI.search('a', { fields: ['nope'] }), 'INVALID_INPUT');
    });

    it('NavigationAPI：越界 OUT_OF_RANGE；非法 mode INVALID；非随机 shuffle STATE_ERROR', () => {
        createAndSwitchLibrary('NavErr', [
            { id: 1, type: 'essay', question: 'n1', answer: '' },
        ]);
        assertErr(LX.NavigationAPI.goto(-1), 'OUT_OF_RANGE');
        assertErr(LX.NavigationAPI.goto(9), 'OUT_OF_RANGE');
        assertErr(LX.NavigationAPI.setMode('chaos'), 'INVALID_INPUT');
        assertErr(LX.NavigationAPI.shuffle(), 'STATE_ERROR');
    });

    it('NavigationAPI：无题时 next OUT_OF_RANGE', async () => {
        await resetStateBeforeEach();
        LX = getLX();
        // 空库
        const r = LX.LibraryAPI.create('空导航库', [], { skipDuplicateCheck: true });
        assertOk(r);
        LX.LibraryAPI.switch(r.data.id);
        assertErr(LX.NavigationAPI.next(), 'OUT_OF_RANGE');
    });

    it('ProgressAPI：非法状态 INVALID；import 非法 PARSE/INVALID；无库 reset STATE_ERROR', async () => {
        createAndSwitchLibrary('PErr', [
            { id: 1, type: 'essay', question: 'p', answer: '' },
        ]);
        const q = LX.QuestionAPI.get(1).data;
        assertErr(LX.ProgressAPI.setStatus(q, 'pending'), 'INVALID_INPUT');
        assertErr(LX.ProgressAPI.import('{'), 'PARSE_ERROR');
        assertErr(LX.ProgressAPI.import('[]'), 'INVALID_INPUT');

        await resetStateBeforeEach();
        LX = getLX();
        assertErr(LX.ProgressAPI.reset(), 'STATE_ERROR');
    });

    it('WrongBookAPI：无错题 NO_WRONG；未进入 markMastered NOT_IN_WRONG_BOOK', () => {
        createAndSwitchLibrary('WErr', [
            { id: 1, type: 'single', question: 'w', options: ['A', 'B'], answer: 'A' },
        ]);
        assertErr(LX.WrongBookAPI.enter(), 'NO_WRONG');
        assertErr(LX.WrongBookAPI.markMastered(1), 'NOT_IN_WRONG_BOOK');

        LX.QuestionAPI.answer(1, 'B');
        assertOk(LX.WrongBookAPI.enter());
        assertOk(LX.WrongBookAPI.exit());
        assertErr(LX.WrongBookAPI.markMastered(1), 'NOT_IN_WRONG_BOOK');
    });

    it('IOAPI：未选题库 export STATE_ERROR；非法 format INVALID；空名 import INVALID', () => {
        assertErr(LX.IOAPI.exportLibrary(null, 'json'), 'STATE_ERROR');
        createAndSwitchLibrary('IOErr', [
            { id: 1, type: 'essay', question: 'io', answer: '' },
        ]);
        const cur = LX.LibraryAPI.current().data;
        assertErr(LX.IOAPI.exportLibrary(cur, 'csv'), 'INVALID_INPUT');
        assertErr(LX.IOAPI.importLibrary('', [{ id: 1, type: 'essay', question: 'x', answer: '' }]), 'INVALID_INPUT');
    });

    it('CategoryAPI：未选题库 rename STATE_ERROR', () => {
        assertErr(LX.CategoryAPI.rename('甲', '乙'), 'STATE_ERROR');
    });

    it('StatsAPI：无库时 summary 仍 ok 且全 0', () => {
        const s = LX.StatsAPI.summary();
        assertOk(s);
        assertEqual(s.data.total, 0);
    });
}, { layer: 'api', tags: ['errors', 'sar'] });
