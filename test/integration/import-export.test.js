import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

/**
 * 串联 SAR；单点 SAR 见 unit/ui/matrix。
 * 用户流程 2：导入导出往返一致性
 * 创建题库 → 导出 JSON → 删除 → 重新导入 → 题目数据一致
 */
describe('集成：导入导出往返一致性', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('JSON 导出 → 删除 → 重新导入 → 数据一致', async () => {
        // 1. 创建题库
        const originalQs = [
            { id: 1, type: 'single', category: '甲', question: '题1', options: ['A', 'B'], answer: 'A', explanation: '解1', remarks: '备注1' },
            { id: 2, type: 'essay', category: '乙', question: '题2', answer: '', explanation: '解2', answerText: '参考答案2' },
        ];
        const createR = LX.LibraryAPI.create('往返测试', originalQs);
        const libId = createR.data.id;

        // 2. 导出 JSON
        const exportR = LX.IOAPI.exportLibrary(libId, 'json');
        assertOk(exportR);
        const jsonText = await exportR.data.blob.text();
        assertTrue(jsonText.includes('往返测试'), 'JSON 应含题库名');
        assertTrue(jsonText.includes('题1'), 'JSON 应含题目');

        // 3. 删除原题库
        LX.LibraryAPI.delete(libId);
        assertEqual(LX.LibraryAPI.list().data.length, 0, '删除后应无题库');

        // 4. 重新导入（用 parseText + importLibrary）
        const parseR = LX.IOAPI.parseText(jsonText);
        assertOk(parseR);
        const reimportR = LX.IOAPI.importLibrary('往返测试-副本', parseR.data.questions);
        assertOk(reimportR);
        const newLibId = reimportR.data.id;

        // 5. 验证数据一致
        const lib = LX.LibraryAPI.get(newLibId).data;
        assertEqual(lib.questions.length, 2);
        assertEqual(lib.questions[0].question, '题1');
        assertEqual(lib.questions[0].type, 'single');
        assertEqual(lib.questions[0].answer, 'A');
        assertEqual(lib.questions[1].question, '题2');
        assertEqual(lib.questions[1].type, 'essay');
        assertEqual(lib.questions[1].answerText, '参考答案2');
    });
});
