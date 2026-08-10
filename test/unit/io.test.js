import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertErr, assertEqual, assertTrue, assertLength } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('IOAPI', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('parseText JSON 字符串 → 题目数组', () => {
        const json = JSON.stringify([
            { id: 1, type: 'essay', question: '题1', answer: '', explanation: '解1' },
            { id: 2, type: 'single', question: '题2', options: ['A', 'B'], answer: 'A', explanation: '' },
        ]);
        const r = LX.IOAPI.parseText(json);
        assertOk(r);
        assertLength(r.data.questions, 2);
        assertEqual(r.data.questions[0].question, '题1');
        assertEqual(r.data.questions[1].type, 'single');
    });

    it('exportLibrary xlsx 表头与数据列对齐（bug 1 回归）', async () => {
        // 创建题库
        const createR = LX.LibraryAPI.create('导出测试', [
            { id: 5, type: 'single', category: '示例', question: '导出题1', options: ['A', 'B', 'C', 'D'], answer: 'A', explanation: '解1' },
            { id: 6, type: 'judge', category: '示例', question: '导出题2', options: [], answer: '对', explanation: '解2' },
        ]);
        const libId = createR.data.id;

        const r = LX.IOAPI.exportLibrary(libId, 'xlsx');
        assertOk(r);
        assertTrue(r.data.blob instanceof Blob, '应返回 Blob');
        assertTrue(r.data.filename.endsWith('.xlsx'), '文件名应以 .xlsx 结尾');

        // 用 XLSX 重新读回，验证列对齐
        const buf = await r.data.blob.arrayBuffer();
        const wb = window.XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // 第 1 行是表头
        const headers = rows[0];
        assertEqual(headers[0], '序号');
        assertEqual(headers[1], '题型');
        assertEqual(headers[2], '分类');
        assertEqual(headers[3], '题目');
        assertEqual(headers[4], '选项');
        assertEqual(headers[5], '正确答案');

        // 第 2 行是第 1 题（id=5），验证列对齐
        const row1 = rows[1];
        assertEqual(row1[0], 5, '序号列应为 5');
        assertEqual(row1[1], 'single', '题型列应为 single');
        assertEqual(row1[2], '示例', '分类列对齐');
        assertEqual(row1[3], '导出题1', '题目列对齐');
        assertEqual(row1[5], 'A', '正确答案列对齐');

        // 第 3 行是第 2 题（id=6，判断题）
        const row2 = rows[2];
        assertEqual(row2[0], 6);
        assertEqual(row2[1], 'judge');
        assertEqual(row2[5], '对');
    });

    it('importLibrary 调 create 含去重', () => {
        const qs = [{ id: 1, type: 'essay', question: '唯一题', answer: '', explanation: '' }];
        const r1 = LX.IOAPI.importLibrary('题库1', qs);
        assertOk(r1);

        const r2 = LX.IOAPI.importLibrary('题库2', qs);
        assertErr(r2, 'DUPLICATE', '重复内容应触发 DUPLICATE');
    });

    it('S=未选题库 A=exportLibrary → R=STATE_ERROR', () => {
        assertErr(LX.IOAPI.exportLibrary(undefined, 'json'), 'STATE_ERROR');
    });

    it('S=有库 A=exportLibrary 非法格式 → R=INVALID_INPUT', () => {
        const c = LX.LibraryAPI.create('导出格式库', [
            { id: 1, type: 'essay', question: '导出格式题', answer: '' },
        ]);
        assertOk(c);
        assertErr(LX.IOAPI.exportLibrary(c.data.id, 'csv'), 'INVALID_INPUT');
    });

    it('S=有库 A=exportLibrary json → R=blob+filename', async () => {
        const c = LX.LibraryAPI.create('JSON导出库', [
            { id: 1, type: 'essay', question: 'JSON导出题', answer: '' },
        ]);
        assertOk(c);
        const r = LX.IOAPI.exportLibrary(c.data.id, 'json');
        assertOk(r);
        assertTrue(r.data.blob instanceof Blob);
        assertTrue(r.data.filename.endsWith('.json'));
        const text = await r.data.blob.text();
        assertTrue(text.includes('JSON导出题'));
    });

    it('S=坏扩展名 File A=parseFile → R=INVALID_INPUT', async () => {
        const file = LX.TestAPI.mockFile('xxx', 'a.bin', 'application/octet-stream');
        const r = await LX.IOAPI.parseFile(file);
        assertErr(r, 'INVALID_INPUT');
    });

    it('S=损坏 JSON File A=parseFile → R=PARSE_ERROR', async () => {
        const file = LX.TestAPI.mockFile('{bad', '坏.json');
        const r = await LX.IOAPI.parseFile(file);
        assertErr(r, 'PARSE_ERROR');
    });

    it('S=空题库 JSON A=parseFile → R=ok + warnings 含空', async () => {
        const file = LX.TestAPI.mockFile('[]', '空.json');
        const r = await LX.IOAPI.parseFile(file);
        assertOk(r);
        assertEqual(r.data.questions.length, 0);
        assertTrue(Array.isArray(r.warnings));
        assertTrue(r.warnings.some((w) => String(w.message || '').includes('空')));
    });

    it('S=非数组 A=convert → R=INVALID_INPUT；非法格式同', () => {
        assertErr(LX.IOAPI.convert(null, 'json'), 'INVALID_INPUT');
        assertErr(LX.IOAPI.convert([], 'pdf'), 'INVALID_INPUT');
    });

    it('S=题目数组 A=convert json → R=blob', async () => {
        const r = LX.IOAPI.convert(
            [{ id: 1, type: 'essay', question: '转换题CONVERT1', answer: '' }],
            'json',
            '转换名'
        );
        assertOk(r);
        assertTrue(r.data.filename.includes('转换名') || r.data.filename.endsWith('.json'));
        const text = await r.data.blob.text();
        assertTrue(text.includes('转换题CONVERT1'));
    });

    it('S=非法进度串 A=importProgress → R=PARSE_ERROR/INVALID_INPUT', () => {
        assertErr(LX.IOAPI.importProgress('{bad'), 'PARSE_ERROR');
        assertErr(LX.IOAPI.importProgress('[]'), 'INVALID_INPUT');
    });

    it('S=SheetJS 可用 A=downloadTemplate → R=xlsx blob', () => {
        const r = LX.IOAPI.downloadTemplate();
        assertOk(r);
        assertTrue(r.data.blob instanceof Blob);
        assertTrue(r.data.filename.includes('模板'));
    });
});
