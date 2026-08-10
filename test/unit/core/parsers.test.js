import { describe, it, beforeEach } from '../../runner.js';
import { assertEqual, assertTrue, assertOk } from '../../assert.js';
import { resetStateBeforeEach, getLX } from '../../helpers.js';
import {
    looksLikeJson, parseText, parseFile, parseJsonLibrary, cleanText, parseTextToQuestions,
} from '../../../src/core/parsers/index.js';

/**
 * SAR：parsers 路由与边界
 */
describe('core/parsers', () => {
    beforeEach(async () => {
        await resetStateBeforeEach();
    });

    it('looksLikeJson：空/对象/数组/文本', () => {
        assertEqual(looksLikeJson(''), false);
        assertEqual(looksLikeJson('  {"a":1}'), true);
        assertEqual(looksLikeJson('[1,2]'), true);
        assertEqual(looksLikeJson('1. 题干'), false);
    });

    it('S=非法 JSON 字符串 A=parseJsonLibrary → R=PARSE_ERROR', () => {
        const r = parseJsonLibrary('{bad');
        assertEqual(r.ok, false);
        assertEqual(r.error.code, 'PARSE_ERROR');
    });

    it('S=空数组 JSON A=parseJsonLibrary → R=ok 且 questions=[]', () => {
        const r = parseJsonLibrary('[]');
        assertEqual(r.ok, true);
        assertEqual(r.data.questions.length, 0);
    });

    it('S=标准题目数组 A=parseJsonLibrary → R=归一化题目', () => {
        const r = parseJsonLibrary(JSON.stringify([
            { id: 1, type: 'single', question: '解析测题', options: ['A', 'B'], answer: 'A' },
        ]));
        assertEqual(r.ok, true);
        assertEqual(r.data.questions.length, 1);
        assertEqual(r.data.questions[0].question, '解析测题');
        assertEqual(r.data.questions[0].type, 'single');
    });

    it('S=残缺 JSON 对象串 A=parseText → R=降级文本或 PARSE 仍可处理', () => {
        // 以 { 开头但非法 → looksLikeJson true，JSON 失败后降级纯文本
        const r = parseText('{not json but starts with brace\n1. 文本题干一行');
        assertEqual(r.ok, true);
        assertTrue(Array.isArray(r.data.questions));
    });

    it('S=空文本 A=parseTextToQuestions → R=空列表', () => {
        const r = parseTextToQuestions('   ');
        assertEqual(r.ok, true);
        assertEqual(r.data.questions.length, 0);
    });

    it('S=含控制字符 A=cleanText → R=去掉控制符保留换行语义', () => {
        const out = cleanText('ab\x00c\n\n\nde');
        assertTrue(!out.includes('\x00'));
        assertTrue(out.includes('abc') || out.includes('ab c') || out.length > 0);
    });

    it('S=无文件 A=parseFile → R=INVALID_INPUT', async () => {
        const r = await parseFile(null);
        assertEqual(r.ok, false);
        assertEqual(r.error.code, 'INVALID_INPUT');
    });

    it('S=未知扩展名 A=parseFile → R=INVALID_INPUT', async () => {
        const LX = getLX();
        const file = LX.TestAPI.mockFile('xxx', 'a.bin', 'application/octet-stream');
        const r = await parseFile(file, {});
        assertEqual(r.ok, false);
        assertEqual(r.error.code, 'INVALID_INPUT');
    });

    it('S=xlsx 且无 XLSX A=parseFile → R=DEP_MISSING', async () => {
        const LX = getLX();
        const file = LX.TestAPI.mockFile('not-really-xlsx', 't.xlsx');
        const saved = window.XLSX;
        try {
            // parseFile 在 deps.XLSX 为空时回落 window.XLSX；赋 null（不可 delete 的全局也通常可写）
            window.XLSX = null;
            const r = await parseFile(file, {});
            assertEqual(r.ok, false);
            assertEqual(r.error.code, 'DEP_MISSING');
        } finally {
            window.XLSX = saved;
        }
    });

    it('S=pdf 且无 pdfjs A=parseFile → R=DEP_MISSING', async () => {
        const LX = getLX();
        const file = LX.TestAPI.mockFile('%PDF-1.4', 't.pdf', 'application/pdf');
        const saved = window.pdfjsLib;
        try {
            window.pdfjsLib = null;
            const r = await parseFile(file, { pdfjsLib: null });
            assertEqual(r.ok, false);
            assertEqual(r.error.code, 'DEP_MISSING');
        } finally {
            window.pdfjsLib = saved;
        }
    });

    it('S=合法 json File A=parseFile → R=题目列表', async () => {
        const LX = getLX();
        const file = LX.TestAPI.mockFile(JSON.stringify([
            { id: 1, type: 'essay', question: '文件解析题FILE1', answer: '' },
        ]), 'q.json');
        const r = await parseFile(file);
        assertEqual(r.ok, true);
        assertEqual(r.data.questions[0].question, '文件解析题FILE1');
    });
}, { layer: 'core', tags: ['parsers', 'sar'] });
