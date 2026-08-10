import { describe, it } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import {
    addFilter, removeFilterAt, isSearchMode,
    groupHitsByCategory, categoryOrderFromQuestions,
} from '../../src/render/contracts/catalog-search-state.js';

describe('catalog-search-state AND 过滤链', () => {
    it('S=[] A=add 空白 → R=INVALID；filters 不变', () => {
        const r = addFilter([], '   ');
        assertEqual(r.ok, false);
        assertEqual(r.error.code, 'INVALID_INPUT');
        assertEqual(r.filters.length, 0);
        assertEqual(isSearchMode(r.filters), false);
    });

    it('S=[] A=add 甲（含空白）→ R=filters=[甲]', () => {
        const r = addFilter([], '  甲  ');
        assertEqual(r.ok, true);
        assertEqual(r.filters, ['甲']);
        assertEqual(isSearchMode(r.filters), true);
    });

    it('S=[甲] A=add 乙 → R=[甲,乙]；再 add 乙 不重复 append', () => {
        const r1 = addFilter(['甲'], '乙');
        assertEqual(r1.filters, ['甲', '乙']);
        const r2 = addFilter(r1.filters, '乙');
        assertEqual(r2.ok, true);
        assertEqual(r2.filters, ['甲', '乙'], '与末尾相同不重复 append');
    });

    it('S=[甲,乙] A=removeAt(0) → R=[乙]', () => {
        const r = removeFilterAt(['甲', '乙'], 0);
        assertEqual(r.ok, true);
        assertEqual(r.filters, ['乙']);
    });

    it('S=[甲,乙,丙] A=removeAt(1) → R=[甲,丙]', () => {
        const r = removeFilterAt(['甲', '乙', '丙'], 1);
        assertEqual(r.ok, true);
        assertEqual(r.filters, ['甲', '丙']);
    });

    it('S=[甲] A=removeAt(0) → R=[]', () => {
        const r = removeFilterAt(['甲'], 0);
        assertEqual(r.ok, true);
        assertEqual(r.filters, []);
        assertEqual(isSearchMode(r.filters), false);
    });

    it('S=[甲] A=removeAt(-1) → R=OUT_OF_RANGE', () => {
        const r = removeFilterAt(['甲'], -1);
        assertEqual(r.ok, false);
        assertEqual(r.error.code, 'OUT_OF_RANGE');
        assertEqual(r.filters, ['甲']);
    });

    it('S=命中分属甲/乙，题库序甲先于乙 A=groupHits → R=甲组在前且无丙', () => {
        const hits = [
            { uid: 2, category: '乙', question: '乙命中' },
            { uid: 1, category: '甲', question: '甲命中1' },
            { uid: 3, category: '甲', question: '甲命中2' },
        ];
        const order = categoryOrderFromQuestions([
            { category: '甲' },
            { category: '乙' },
            { category: '丙' },
        ]);
        assertEqual(order, ['甲', '乙', '丙']);
        const groups = groupHitsByCategory(hits, order);
        assertEqual(groups.map((g) => g.category), ['甲', '乙']);
        assertEqual(groups[0].questions.length, 2);
        assertEqual(groups[1].questions.length, 1);
        assertTrue(!groups.some((g) => g.category === '丙'));
    });

    it('S=无 category 字段 A=groupHits → R=未分类一组', () => {
        const groups = groupHitsByCategory([{ uid: 1, question: 'x' }], []);
        assertEqual(groups.length, 1);
        assertEqual(groups[0].category, '未分类');
    });
}, { layer: 'ui', tags: ['search', 'sar', 'unit'] });
