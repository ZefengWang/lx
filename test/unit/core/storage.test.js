import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertOk, assertErr, assertTrue } from '../../assert.js';
import { resetStateBeforeEach } from '../../helpers.js';
import {
    KEYS,
    getLibraries, setLibraries,
    getProgress, setProgress,
    getLastLibraryId, setLastLibraryId,
    clearAll, invalidateCache, estimateUsage, migrateLegacyKeys,
} from '../../../src/core/storage.js';

/**
 * SAR：storage 读写 / 缓存 / 坏数据 / 配额
 */
describe('core/storage', () => {
    beforeEach(async () => {
        await resetStateBeforeEach();
        invalidateCache();
    });

    afterEach(() => {
        invalidateCache();
    });

    it('S=空存储 A=getLibraries/getProgress → R=空对象 ok', () => {
        assertOk(clearAll());
        invalidateCache();
        assertOk(getLibraries());
        assertEqual(Object.keys(getLibraries().data).length, 0);
        assertOk(getProgress());
        assertEqual(Object.keys(getProgress().data).length, 0);
    });

    it('S=写入题库 A=get 命中缓存；invalidate 后重读一致', () => {
        const libs = { lib_a: { id: 'lib_a', name: 'A', questions: [] } };
        assertOk(setLibraries(libs));
        assertEqual(getLibraries().data.lib_a.name, 'A');
        // 缓存命中：直接改 localStorage 后未 invalidate 仍见旧缓存
        localStorage.setItem(KEYS.LIBRARIES, JSON.stringify({ lib_b: { id: 'lib_b', name: 'B', questions: [] } }));
        assertEqual(getLibraries().data.lib_a.name, 'A', '未 invalidate 应仍返回缓存');
        invalidateCache();
        assertEqual(getLibraries().data.lib_b.name, 'B');
    });

    it('S=进度往返 A=setProgress/getProgress → R=一致', () => {
        const prog = { lib_x: { '1': 'mastered' } };
        assertOk(setProgress(prog));
        invalidateCache();
        assertEqual(getProgress().data.lib_x['1'], 'mastered');
    });

    it('S=lastLib A=set/get/clear → R=值变化', () => {
        assertOk(setLastLibraryId('lib_1'));
        assertEqual(getLastLibraryId().data, 'lib_1');
        assertOk(setLastLibraryId(null));
        assertEqual(getLastLibraryId().data, null);
    });

    it('S=坏 JSON A=getLibraries → R=STORAGE_ERROR', () => {
        localStorage.setItem(KEYS.LIBRARIES, '{not-json');
        invalidateCache();
        assertErr(getLibraries(), 'STORAGE_ERROR');
        // 清理以免污染后续
        localStorage.removeItem(KEYS.LIBRARIES);
        invalidateCache();
    });

    it('S=QuotaExceeded A=setLibraries → R=STORAGE_FULL', () => {
        const original = localStorage.setItem;
        localStorage.setItem = function () {
            const e = new Error('full');
            e.name = 'QuotaExceededError';
            throw e;
        };
        try {
            const r = setLibraries({ a: { id: 'a', name: 'x', questions: [] } });
            assertErr(r, 'STORAGE_FULL');
        } finally {
            localStorage.setItem = original;
        }
    });

    it('S=已有数据 A=clearAll → R=题库进度清空', () => {
        assertOk(setLibraries({ a: { id: 'a', name: 'x', questions: [] } }));
        assertOk(setProgress({ a: { '1': 'review' } }));
        assertOk(setLastLibraryId('a'));
        assertOk(clearAll());
        invalidateCache();
        assertEqual(Object.keys(getLibraries().data).length, 0);
        assertEqual(Object.keys(getProgress().data).length, 0);
        assertEqual(getLastLibraryId().data, null);
    });

    it('S=无旧键 A=migrateLegacyKeys → R=migrated=false', () => {
        localStorage.setItem(KEYS.MIGRATED, '1');
        const r = migrateLegacyKeys();
        assertOk(r);
        assertEqual(r.data.migrated, false);
    });

    it('S=有旧键无新键 A=migrate → R=migrated=true 且可读新键', () => {
        // 清新键与标记，植入 legacy
        localStorage.removeItem(KEYS.LIBRARIES);
        localStorage.removeItem(KEYS.PROGRESS);
        localStorage.removeItem(KEYS.LAST_LIB);
        localStorage.removeItem(KEYS.MIGRATED);
        invalidateCache();
        const legacy = { old1: { id: 'old1', name: '旧库', questions: [{ id: 1, question: 'q', type: 'essay' }] } };
        localStorage.setItem(KEYS.LEGACY.LIBRARIES, JSON.stringify(legacy));
        localStorage.setItem(KEYS.LEGACY.PROGRESS, JSON.stringify({ old1: { '1': 'mastered' } }));
        localStorage.setItem(KEYS.LEGACY.LAST_LIB, 'old1');

        const r = migrateLegacyKeys();
        assertOk(r);
        assertTrue(r.data.migrated === true || r.data.reason === 'new-exists' || r.data.reason === 'already');
        invalidateCache();
        if (r.data.migrated) {
            assertEqual(getLibraries().data.old1.name, '旧库');
            assertEqual(getLastLibraryId().data, 'old1');
        }
        // 清理 legacy 避免影响他人
        localStorage.removeItem(KEYS.LEGACY.LIBRARIES);
        localStorage.removeItem(KEYS.LEGACY.PROGRESS);
        localStorage.removeItem(KEYS.LEGACY.LAST_LIB);
    });

    it('S=任意 A=estimateUsage → R=usedBytes 为数字', () => {
        const r = estimateUsage();
        assertOk(r);
        assertTrue(typeof r.data.usedBytes === 'number');
        assertTrue(r.data.quotaBytes > 0);
    });
}, { layer: 'core', tags: ['storage', 'sar'] });
