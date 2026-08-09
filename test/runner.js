/**
 * 极简测试运行器（自写原生 JS，零依赖）
 * API: describe / it / beforeEach / afterEach / runAll / getSuites / clearSuites
 * @module test/runner
 */

/** @type {Array<{name: string, tests: Array<{name: string, fn: Function}>, beforeEach?: Function, afterEach?: Function}>} */
const suites = [];
let currentSuite = null;
let _skipMode = false;

/**
 * 定义测试套件
 * @param {string} name
 * @param {() => void} fn
 */
export function describe(name, fn) {
    const suite = { name, tests: [], beforeEach: null, afterEach: null };
    const prev = currentSuite;
    currentSuite = suite;
    try {
        fn();
    } finally {
        currentSuite = prev;
    }
    suites.push(suite);
}

/**
 * 定义测试用例
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
export function it(name, fn) {
    if (!currentSuite) {
        throw new Error('it() must be called inside describe()');
    }
    if (_skipMode) {
        currentSuite.tests.push({ name: name + ' (skipped)', fn: null, skipped: true });
        return;
    }
    currentSuite.tests.push({ name, fn });
}

/**
 * 跳过测试用例（仅占位，不执行）
 */
it.skip = function (name, _fn) {
    if (!currentSuite) return;
    currentSuite.tests.push({ name: name + ' (skipped)', fn: null, skipped: true });
};

/**
 * 注册 beforeEach 钩子
 */
export function beforeEach(fn) {
    if (currentSuite) currentSuite.beforeEach = fn;
}

/**
 * 注册 afterEach 钩子
 */
export function afterEach(fn) {
    if (currentSuite) currentSuite.afterEach = fn;
}

/**
 * 运行所有已注册的测试
 * @param {(results: object) => void} [onProgress] 每完成一个用例回调一次
 * @returns {Promise<{passed: number, failed: number, skipped: number, total: number, suites: Array, startTime: number, endTime: number}>}
 */
export async function runAll(onProgress) {
    const startTime = Date.now();
    const results = {
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        suites: [],
        startTime,
        endTime: 0,
    };

    for (const suite of suites) {
        const suiteResult = {
            name: suite.name,
            tests: [],
            passed: 0,
            failed: 0,
            skipped: 0,
        };

        for (const test of suite.tests) {
            results.total++;
            if (test.skipped) {
                results.skipped++;
                suiteResult.skipped++;
                suiteResult.tests.push({ name: test.name, status: 'skip' });
                continue;
            }

            // beforeEach
            if (suite.beforeEach) {
                try {
                    await suite.beforeEach();
                } catch (e) {
                    results.failed++;
                    suiteResult.failed++;
                    suiteResult.tests.push({
                        name: test.name,
                        status: 'fail',
                        error: { message: 'beforeEach 抛错：' + e.message, stack: e.stack },
                    });
                    if (onProgress) onProgress(results);
                    continue;
                }
            }

            // 执行测试
            const t0 = performance.now();
            try {
                await test.fn();
                const duration = Math.round(performance.now() - t0);
                results.passed++;
                suiteResult.passed++;
                suiteResult.tests.push({ name: test.name, status: 'pass', duration });
            } catch (e) {
                const duration = Math.round(performance.now() - t0);
                results.failed++;
                suiteResult.failed++;
                suiteResult.tests.push({
                    name: test.name,
                    status: 'fail',
                    duration,
                    error: {
                        message: e.message,
                        stack: e.stack,
                        actual: e.actual,
                        expected: e.expected,
                    },
                });
            }

            // afterEach（即使测试失败也执行）
            if (suite.afterEach) {
                try {
                    await suite.afterEach();
                } catch (e) {
                    // afterEach 错误不影响测试结果，仅打日志
                    console.warn(`[runner] afterEach error in suite "${suite.name}":`, e);
                }
            }

            if (onProgress) onProgress(results);
        }

        results.suites.push(suiteResult);
    }

    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;
    return results;
}

/**
 * 获取已注册的套件（不执行）
 */
export function getSuites() {
    return suites;
}

/**
 * 清空已注册的套件（HMR 重载或重复运行用）
 */
export function clearSuites() {
    suites.length = 0;
}

/**
 * 格式化结果为可读字符串
 */
export function formatResults(results) {
    const lines = [];
    lines.push(`=== 测试结果 ===`);
    lines.push(`通过: ${results.passed} / 失败: ${results.failed} / 跳过: ${results.skipped} / 总计: ${results.total}`);
    lines.push(`耗时: ${results.duration}ms`);
    lines.push('');
    for (const suite of results.suites) {
        const icon = suite.failed > 0 ? '✗' : '✓';
        lines.push(`${icon} ${suite.name} (${suite.passed}/${suite.tests.length})`);
        for (const t of suite.tests) {
            if (t.status === 'pass') {
                lines.push(`    ✓ ${t.name} (${t.duration}ms)`);
            } else if (t.status === 'skip') {
                lines.push(`    - ${t.name}`);
            } else {
                lines.push(`    ✗ ${t.name}`);
                if (t.error) {
                    lines.push(`        Error: ${t.error.message}`);
                }
            }
        }
    }
    return lines.join('\n');
}
