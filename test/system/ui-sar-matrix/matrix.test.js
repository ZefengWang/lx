/**
 * UI SAR 全量矩阵系统测（由 cases.js 驱动）
 * @module test/system/ui-sar-matrix/matrix.test
 */
import { describe, it } from '../../runner.js';
import { SAR_CASES, SAR_MATRIX } from './cases.js';
import { runSarCase, DEFERRED, isDeferredCase, IFRAME_CONTROL_IDS } from './perform.js';

describe('系统：UI SAR 矩阵驱动', () => {
    it('SAR-META：矩阵规模与 DEFERRED 上限', () => {
        const n = SAR_MATRIX.stats.caseCount;
        if (n < 220) throw new Error(`caseCount=${n} < 220`);
        if (DEFERRED.size > 15) throw new Error(`DEFERRED=${DEFERRED.size} > 15`);
        // 校验 DEFERRED id 均存在于矩阵
        for (const id of DEFERRED) {
            if (!SAR_CASES.some((c) => c.id === id)) {
                throw new Error(`DEFERRED 含未知 id: ${id}`);
            }
        }
        const iframeCases = SAR_CASES.filter((c) => IFRAME_CONTROL_IDS.has(c.controlId)).length;
        if (iframeCases < 20) {
            throw new Error(`iframe 整页用例过少：${iframeCases}（期望 ≥20）`);
        }
    });

    for (const c of SAR_CASES) {
        const title = `SAR: ${c.id}`;
        if (isDeferredCase(c)) {
            it.skip(title, () => runSarCase(c));
        } else {
            it(title, () => runSarCase(c));
        }
    }
}, { layer: 'system', tags: ['ui-sar-matrix', 'delta', 'sar'] });
