import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertErr, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach, createAndSwitchLibrary } from '../helpers.js';

/**
 * 系统级失败注入旅程（SAR）：
 * 导入失败 / 错题清空失败路径 / 设置往返（进度）失败与恢复
 */
describe('系统：失败注入旅程', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('S=损坏导入文件 A=parseFile→import → R=不落库；合法再导入成功', async () => {
        const bad = LX.TestAPI.mockFile('{not-json', '坏导入.json');
        const parseBad = await LX.IOAPI.parseFile(bad);
        assertErr(parseBad, 'PARSE_ERROR');
        assertEqual(LX.LibraryAPI.list().data.length, 0, '坏文件不应创建题库');

        const good = LX.TestAPI.mockFile(JSON.stringify([
            { id: 1, type: 'single', question: '失败注入题FI1', options: ['A', 'B'], answer: 'A' },
        ]), '好导入.json');
        const parseGood = await LX.IOAPI.parseFile(good);
        assertOk(parseGood);
        const imp = LX.IOAPI.importLibrary('失败注入库', parseGood.data.questions);
        assertOk(imp);
        assertEqual(LX.LibraryAPI.list().data.length, 1);
    });

    it('S=重复内容导入 A=importLibrary → R=DUPLICATE 且库数不增', async () => {
        const qs = [{ id: 1, type: 'essay', question: '重复注入题DUP', answer: '' }];
        assertOk(LX.IOAPI.importLibrary('库甲', qs));
        const before = LX.LibraryAPI.list().data.length;
        assertErr(LX.IOAPI.importLibrary('库乙', qs), 'DUPLICATE');
        assertEqual(LX.LibraryAPI.list().data.length, before);
    });

    it('S=无错题 A=WrongBook.enter → R=NO_WRONG；有错题清完后 count=0', () => {
        createAndSwitchLibrary('失败错题库', [
            { id: 1, type: 'single', question: 'wb1', options: ['A', 'B'], answer: 'A' },
        ]);
        assertErr(LX.WrongBookAPI.enter(), 'NO_WRONG');

        assertOk(LX.QuestionAPI.answer(1, 'B'));
        assertEqual(LX.WrongBookAPI.count().data, 1);
        assertOk(LX.WrongBookAPI.enter());
        assertOk(LX.QuestionAPI.answer(1, 'A'));
        assertOk(LX.WrongBookAPI.markMastered(1));
        assertEqual(LX.WrongBookAPI.count().data, 0);
        // 清完后再 enter 失败
        assertErr(LX.WrongBookAPI.enter(), 'NO_WRONG');
    });

    it('S=有进度 A=坏进度导入失败后原进度保留；合法串可恢复', () => {
        createAndSwitchLibrary('进度往返库', [
            { id: 1, type: 'fill', question: '首都', answer: '北京' },
            { id: 2, type: 'judge', question: '地球圆', options: ['对', '错'], answer: '对' },
        ]);
        assertTrue(LX.QuestionAPI.answer(1, '北京').data.correct);
        assertTrue(LX.QuestionAPI.answer(2, '错').data.correct === false);

        const backup = LX.IOAPI.exportProgress();
        assertOk(backup);
        const masteredBefore = LX.StatsAPI.summary().data.mastered;
        const reviewBefore = LX.StatsAPI.summary().data.review;
        assertTrue(masteredBefore >= 1);
        assertTrue(reviewBefore >= 1);

        assertErr(LX.IOAPI.importProgress('{坏进度'), 'PARSE_ERROR');
        assertEqual(LX.StatsAPI.summary().data.mastered, masteredBefore, '坏导入不得覆盖进度');
        assertEqual(LX.StatsAPI.summary().data.review, reviewBefore);

        assertOk(LX.ProgressAPI.reset());
        assertEqual(LX.StatsAPI.summary().data.mastered, 0);
        assertOk(LX.IOAPI.importProgress(backup.data));
        assertEqual(LX.StatsAPI.summary().data.mastered, masteredBefore);
        assertEqual(LX.StatsAPI.summary().data.review, reviewBefore);
    });

    it('S=未选题库 A=exportLibrary → R=STATE_ERROR；切库后可导出', () => {
        assertErr(LX.IOAPI.exportLibrary(undefined, 'json'), 'STATE_ERROR');
        const { libId } = createAndSwitchLibrary('导出失败库', [
            { id: 1, type: 'essay', question: '导出失败题', answer: '' },
        ]);
        const r = LX.IOAPI.exportLibrary(libId, 'json');
        assertOk(r);
        assertTrue(r.data.blob instanceof Blob);
    });
}, { layer: 'system', tags: ['failure', 'sar', 'e2e'] });
