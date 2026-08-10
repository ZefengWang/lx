/**
 * 极简测试运行器（自写原生 JS，零依赖）
 * API: describe / it / beforeEach / afterEach / runAll / getSuites / clearSuites
 * @module test/runner
 */

/**
 * @typedef {'core'|'api'|'ui'|'integration'|'system'|'regression'} TestLayer
 * @typedef {{ layer?: TestLayer; tags?: string[] }} SuiteMeta
 * @typedef {{ name: string, tests: Array<{name: string, fn: Function, skipped?: boolean}>, beforeEach?: Function, afterEach?: Function, layer: TestLayer, tags: string[] }} Suite
 */

/** @type {Suite[]} */
const suites = [];
let currentSuite = null;
let _skipMode = false;

/**
 * 定义测试套件
 * @param {string} name
 * @param {() => void} fn
 * @param {SuiteMeta} [meta] layer/tags，供过滤与报告分组
 */
export function describe(name, fn, meta = {}) {
    const suite = {
        name,
        tests: [],
        beforeEach: null,
        afterEach: null,
        layer: meta.layer || inferLayerFromName(name),
        tags: Array.isArray(meta.tags) ? meta.tags : [],
    };
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
 * 从套件名推断层级（兼容旧用例未传 meta）
 * @param {string} name
 * @returns {TestLayer}
 */
function inferLayerFromName(name) {
    const n = String(name || '');
    if (/^core\b|核心层|core\//i.test(n)) return 'core';
    if (/^ui\b|UI|render|契约/i.test(n)) return 'ui';
    if (/系统|system/i.test(n)) return 'system';
    if (/集成|integration/i.test(n)) return 'integration';
    if (/回归|bug|BUG/i.test(n)) return 'regression';
    return 'api';
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
 * @param {{ layer?: TestLayer|TestLayer[]; tag?: string }} [filter] 可选过滤
 * @returns {Promise<{passed: number, failed: number, skipped: number, total: number, suites: Array, startTime: number, endTime: number, byLayer: object}>}
 */
export async function runAll(onProgress, filter = {}) {
    const startTime = Date.now();
    const results = {
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        suites: [],
        startTime,
        endTime: 0,
        byLayer: {},
    };

    const layerFilter = filter.layer
        ? (Array.isArray(filter.layer) ? filter.layer : [filter.layer])
        : null;
    const tagFilter = filter.tag || null;

    for (const suite of suites) {
        if (layerFilter && !layerFilter.includes(suite.layer)) continue;
        if (tagFilter && !(suite.tags || []).includes(tagFilter)) continue;

        const suiteResult = {
            name: suite.name,
            layer: suite.layer,
            tags: suite.tags || [],
            tests: [],
            passed: 0,
            failed: 0,
            skipped: 0,
        };

        const layer = suite.layer || 'api';
        if (!results.byLayer[layer]) {
            results.byLayer[layer] = { passed: 0, failed: 0, skipped: 0, total: 0 };
        }

        const bumpProgress = (status, testName) => {
            if (status === 'pass') results.byLayer[layer].passed++;
            else if (status === 'fail') results.byLayer[layer].failed++;
            else if (status === 'skip') results.byLayer[layer].skipped++;
            results.byLayer[layer].total++;
            results.current = { suite: suite.name, name: testName, layer, status };
            // 进行中套件快照（供控制台实时刷列表，避免长矩阵像卡死）
            results.activeSuite = {
                name: suite.name,
                layer,
                tags: suite.tags || [],
                tests: suiteResult.tests.slice(-12), // 最近若干条，避免 DOM 过大
                passed: suiteResult.passed,
                failed: suiteResult.failed,
                skipped: suiteResult.skipped,
                planned: suite.tests.length,
            };
            results.duration = Date.now() - startTime;
            if (onProgress) onProgress(results);
        };

        for (const test of suite.tests) {
            results.total++;
            if (test.skipped) {
                results.skipped++;
                suiteResult.skipped++;
                suiteResult.tests.push({ name: test.name, status: 'skip' });
                bumpProgress('skip', test.name);
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
                    bumpProgress('fail', test.name);
                    await new Promise((r) => setTimeout(r, 0));
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
                bumpProgress('pass', test.name);
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
                bumpProgress('fail', test.name);
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

            // 让出宏任务，刷新「运行中」文案（SAR iframe 矩阵很长，避免像卡死）
            await new Promise((r) => setTimeout(r, 0));
        }

        results.suites.push(suiteResult);
    }

    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;
    delete results.current;
    delete results.activeSuite;
    return results;
}

/**
 * 获取已注册的套件（不执行）
 */
export function getSuites() {
    return suites;
}

/**
 * 扁平列出全部用例（供控制台目录 / 填充命令）
 * @returns {Array<{ suite: string, name: string, layer: TestLayer, tags: string[], skipped: boolean }>}
 */
export function listCases() {
    const out = [];
    for (const suite of suites) {
        for (const test of suite.tests) {
            out.push({
                suite: suite.name,
                name: test.name,
                layer: suite.layer,
                tags: suite.tags || [],
                skipped: !!test.skipped,
            });
        }
    }
    return out;
}

/**
 * 从用例名解析预期摘要（约定：`… → R=…` 或 `… -> R=…`）
 * @param {string} testName
 * @returns {{ status: 'pass', note?: string }}
 */
export function parseExpectedFromTestName(testName) {
    const n = String(testName || '');
    const m = n.match(/(?:→|->)\s*R\s*=\s*(.+)\s*$/);
    if (m) {
        return { status: 'pass', note: m[1].trim() };
    }
    return { status: 'pass' };
}

/**
 * 只跑一条用例（含该套件 beforeEach/afterEach）
 * @param {string} suiteName
 * @param {string} testName
 * @returns {Promise<{ ok: boolean, status: 'pass'|'fail'|'skip'|'not_found', suite: string, name: string, duration?: number, error?: object }>}
 */
export async function runCase(suiteName, testName) {
    const suite = suites.find((s) => s.name === suiteName);
    if (!suite) {
        return {
            ok: false,
            status: 'not_found',
            suite: suiteName,
            name: testName,
            error: { message: `未找到套件：${suiteName}` },
        };
    }
    const test = suite.tests.find((t) => t.name === testName);
    if (!test) {
        return {
            ok: false,
            status: 'not_found',
            suite: suiteName,
            name: testName,
            error: { message: `套件「${suiteName}」中未找到用例：${testName}` },
        };
    }
    if (test.skipped || !test.fn) {
        return { ok: true, status: 'skip', suite: suiteName, name: testName };
    }

    if (suite.beforeEach) {
        try {
            await suite.beforeEach();
        } catch (e) {
            return {
                ok: false,
                status: 'fail',
                suite: suiteName,
                name: testName,
                error: { message: 'beforeEach 抛错：' + e.message, stack: e.stack },
            };
        }
    }

    const t0 = performance.now();
    let result;
    try {
        await test.fn();
        result = {
            ok: true,
            status: 'pass',
            suite: suiteName,
            name: testName,
            duration: Math.round(performance.now() - t0),
        };
    } catch (e) {
        result = {
            ok: false,
            status: 'fail',
            suite: suiteName,
            name: testName,
            duration: Math.round(performance.now() - t0),
            error: {
                message: e.message,
                stack: e.stack,
                actual: e.actual,
                expected: e.expected,
            },
        };
    }

    if (suite.afterEach) {
        try {
            await suite.afterEach();
        } catch (e) {
            console.warn(`[runner] afterEach error in suite "${suite.name}":`, e);
        }
    }
    return result;
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
    if (results.byLayer) {
        const parts = Object.keys(results.byLayer).map((k) => {
            const L = results.byLayer[k];
            return `${k}:${L.passed}/${L.total}`;
        });
        if (parts.length) lines.push(`分层: ${parts.join(' · ')}`);
    }
    lines.push('');
    for (const suite of results.suites) {
        const icon = suite.failed > 0 ? '✗' : '✓';
        const layerTag = suite.layer ? `[${suite.layer}] ` : '';
        lines.push(`${icon} ${layerTag}${suite.name} (${suite.passed}/${suite.tests.length})`);
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
