import { describe, it, beforeEach } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import {
    runCase, listCases, parseExpectedFromTestName, getSuites,
} from '../runner.js';
import { resetStateBeforeEach } from '../helpers.js';

describe('runner.runCase / listCases 单条复现', () => {
    beforeEach(async () => {
        await resetStateBeforeEach();
    });

    it('S=已注册套件 A=listCases → R=含本套件用例', () => {
        const cases = listCases();
        assertTrue(cases.length > 0);
        assertTrue(cases.some((c) => c.suite.includes('runner.runCase')));
    });

    it('S=用例名含 R= A=parseExpected → R=抽出 note', () => {
        const e = parseExpectedFromTestName('S=x A=y → R=回看后再回进度');
        assertEqual(e.status, 'pass');
        assertEqual(e.note, '回看后再回进度');
    });

    it('S=存在的用例 A=runCase → R=status pass', async () => {
        // 跑本文件里上一条已注册的 parse 用例（名称固定）
        const target = 'S=用例名含 R= A=parseExpected → R=抽出 note';
        const suite = getSuites().find((s) => s.name.includes('runner.runCase'));
        assertTrue(!!suite);
        const r = await runCase(suite.name, target);
        assertEqual(r.status, 'pass');
        assertEqual(r.ok, true);
    });

    it('S=不存在套件 A=runCase → R=not_found', async () => {
        const r = await runCase('___no_such_suite___', 'x');
        assertEqual(r.status, 'not_found');
        assertEqual(r.ok, false);
    });
}, { layer: 'api', tags: ['runner', 'sar'] });
