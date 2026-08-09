/**
 * ID 生成器
 * @module core/id
 */

/**
 * 生成题库 ID：lib_<timestamp>_<rand>
 * @returns {string}
 */
export function genLibId() {
    return 'lib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

let _qIdCounter = 0;

/**
 * 内部 qId 自增计数器（主要用于测试场景的临时 ID 生成）
 * 业务题目 ID 在导入时由序列号决定，不依赖此函数
 * @returns {number}
 */
export function genQId() {
    return ++_qIdCounter;
}

/**
 * 重置 qId 计数器（测试用）
 */
export function resetQIdCounter() {
    _qIdCounter = 0;
}
