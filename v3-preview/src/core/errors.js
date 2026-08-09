/**
 * 错误码枚举 + 结果工厂
 * 所有 API 统一返回 { ok, data?, error? } 结构
 * @module core/errors
 */

export const ErrorCode = Object.freeze({
    NOT_FOUND: 'NOT_FOUND',
    INVALID_INPUT: 'INVALID_INPUT',
    DUPLICATE: 'DUPLICATE',
    STORAGE_FULL: 'STORAGE_FULL',
    STORAGE_ERROR: 'STORAGE_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
    STATE_ERROR: 'STATE_ERROR',
    DEP_MISSING: 'DEP_MISSING',
    NO_WRONG: 'NO_WRONG',
    NOT_IN_WRONG_BOOK: 'NOT_IN_WRONG_BOOK',
    OUT_OF_RANGE: 'OUT_OF_RANGE',
});

/**
 * 成功结果
 * @template T
 * @param {T} data
 * @returns {{ok: true, data: T}}
 */
export function ok(data) {
    return { ok: true, data };
}

/**
 * 失败结果
 * @param {string} code - ErrorCode 之一
 * @param {string} message
 * @param {Record<string, any>} [extra]
 */
export function err(code, message, extra = {}) {
    return { ok: false, error: { code, message, ...extra } };
}

/**
 * 判断是否为结果对象（{ok:true/false,...}）
 * @param {any} r
 */
export function isResult(r) {
    return r && typeof r === 'object' && typeof r.ok === 'boolean';
}
