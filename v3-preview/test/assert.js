/**
 * 断言库
 * 失败时抛带 actual/expected 信息的 Error，runner 捕获后展示
 * @module test/assert
 */

/**
 * 断言结果对象 ok: true
 * @param {{ok: boolean, data?: any, error?: any}} r
 * @param {string} [msg]
 */
export function assertOk(r, msg) {
    if (!r || r.ok !== true) {
        const e = new Error(msg || `期望 ok:true，实际得到 ${JSON.stringify(r)}`);
        e.actual = r;
        e.expected = { ok: true };
        throw e;
    }
}

/**
 * 断言结果对象 ok: false 且 error.code 匹配
 * @param {{ok: boolean, error?: {code: string}}} r
 * @param {string} [code]
 * @param {string} [msg]
 */
export function assertErr(r, code, msg) {
    if (!r || r.ok !== false) {
        const e = new Error(msg || `期望 ok:false，实际得到 ${JSON.stringify(r)}`);
        e.actual = r;
        e.expected = { ok: false };
        throw e;
    }
    if (code && (!r.error || r.error.code !== code)) {
        const e = new Error(
            msg || `期望 error.code="${code}"，实际得到 ${r.error ? r.error.code : '无'}`
        );
        e.actual = r.error ? r.error.code : null;
        e.expected = code;
        throw e;
    }
}

/**
 * 断言严格相等（JSON.stringify 比较）
 */
export function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        const err = new Error(msg || `期望 ${e}，实际 ${a}`);
        err.actual = actual;
        err.expected = expected;
        throw err;
    }
}

/**
 * 断言真值
 */
export function assertTrue(v, msg) {
    if (!v) {
        const e = new Error(msg || `期望真值，实际得到 ${JSON.stringify(v)}`);
        e.actual = v;
        e.expected = 'truthy';
        throw e;
    }
}

/**
 * 断言假值
 */
export function assertFalse(v, msg) {
    if (v) {
        const e = new Error(msg || `期望假值，实际得到 ${JSON.stringify(v)}`);
        e.actual = v;
        e.expected = 'falsy';
        throw e;
    }
}

/**
 * 断言数组长度
 */
export function assertLength(arr, n, msg) {
    if (!Array.isArray(arr)) {
        const e = new Error(msg || `期望数组，实际 ${typeof arr}`);
        e.actual = typeof arr;
        e.expected = 'array';
        throw e;
    }
    if (arr.length !== n) {
        const e = new Error(msg || `期望长度 ${n}，实际 ${arr.length}`);
        e.actual = arr.length;
        e.expected = n;
        throw e;
    }
}

/**
 * 断言函数抛错
 * @param {() => void | Promise<void>} fn
 * @param {string} [msg]
 */
export async function assertThrows(fn, msg) {
    let threw = false;
    try {
        await fn();
    } catch (_) {
        threw = true;
    }
    if (!threw) {
        const e = new Error(msg || '期望函数抛错，但未抛错');
        e.actual = 'no throw';
        e.expected = 'throw';
        throw e;
    }
}

/**
 * 断言两个数字相等（带精度容差）
 */
export function assertApprox(actual, expected, epsilon = 0.01, msg) {
    if (Math.abs(actual - expected) > epsilon) {
        const e = new Error(msg || `期望约 ${expected}（±${epsilon}），实际 ${actual}`);
        e.actual = actual;
        e.expected = expected;
        throw e;
    }
}

/**
 * 断言 value 包含在数组/字符串中
 */
export function assertContains(container, value, msg) {
    let contained = false;
    if (Array.isArray(container)) {
        contained = container.includes(value);
    } else if (typeof container === 'string') {
        contained = container.includes(String(value));
    } else if (container && typeof container === 'object') {
        contained = value in container;
    }
    if (!contained) {
        const e = new Error(msg || `期望 ${JSON.stringify(container)} 包含 ${JSON.stringify(value)}`);
        e.actual = container;
        e.expected = value;
        throw e;
    }
}
