import { describe, it } from '../../runner.js';
import { assertTrue, assertFalse, assertEqual } from '../../assert.js';
import { ok, err, isResult, ErrorCode } from '../../../src/core/errors.js';

describe('core/errors：Result 与 ErrorCode', () => {
    it('ok/err 构造符合契约', () => {
        const a = ok({ x: 1 });
        assertTrue(a.ok);
        assertEqual(a.data.x, 1);
        assertTrue(isResult(a));

        const b = err(ErrorCode.NOT_FOUND, 'missing');
        assertFalse(b.ok);
        assertEqual(b.error.code, ErrorCode.NOT_FOUND);
        assertTrue(isResult(b));
    });

    it('isResult 拒绝非 Result', () => {
        assertFalse(isResult(null));
        assertFalse(isResult(undefined));
        assertFalse(isResult({}));
        assertFalse(isResult({ data: 1 }));
        assertTrue(isResult({ ok: true, data: null }));
        assertTrue(isResult({ ok: false, error: { code: 'X', message: 'm' } }));
    });
}, { layer: 'core', tags: ['unit'] });
