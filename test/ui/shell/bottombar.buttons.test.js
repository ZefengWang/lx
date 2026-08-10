import { describe, it, beforeEach, afterEach } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import { createMountPoint, destroyMountPoint, resetStateBeforeEach } from '../../helpers.js';
import { renderBottombar } from '../../../src/render/bottombar.js';
import { clickLabel } from '../dom-harness.js';

/**
 * SAR：底栏六键（主成功 + disabled 对照 + 掌握/错题按下态）
 * 矩阵 iframe 另见 ui-sar-matrix；本文件锁 renderBottombar 纯控件契约。
 */
describe('UI 按钮：底栏 bottombar', () => {
    let root;
    let flags;

    beforeEach(async () => {
        await resetStateBeforeEach();
        root = createMountPoint();
        flags = { reset: 0, mastered: 0, wrong: 0, prev: 0, catalog: 0, next: 0 };
        const bar = renderBottombar({
            canPrev: true,
            canNext: true,
            canReset: true,
            isMastered: false,
            isWrong: false,
            onReset: () => { flags.reset++; },
            onMastered: () => { flags.mastered++; },
            onWrong: () => { flags.wrong++; },
            onPrev: () => { flags.prev++; },
            onCatalog: () => { flags.catalog++; },
            onNext: () => { flags.next++; },
        });
        root.appendChild(bar);
    });

    afterEach(() => {
        destroyMountPoint(root);
        root = null;
    });

    it('六个操作键均可点击并触发回调', () => {
        clickLabel(root, '清除标记');
        clickLabel(root, '标记为已掌握');
        clickLabel(root, '加入错题');
        clickLabel(root, '上一题');
        clickLabel(root, '浏览');
        clickLabel(root, '下一题');
        assertEqual(flags.reset, 1);
        assertEqual(flags.mastered, 1);
        assertEqual(flags.wrong, 1);
        assertEqual(flags.prev, 1);
        assertEqual(flags.catalog, 1);
        assertEqual(flags.next, 1);
    });

    it('S=canReset=false A=点清除标记 → R=disabled 且回调不触发', () => {
        destroyMountPoint(root);
        root = createMountPoint();
        flags.reset = 0;
        root.appendChild(renderBottombar({
            canReset: false,
            onReset: () => { flags.reset++; },
            onMastered: () => {},
            onWrong: () => {},
            onPrev: () => {},
            onCatalog: () => {},
            onNext: () => {},
            canPrev: true,
            canNext: true,
        }));
        const btn = root.querySelector('[aria-label="清除标记"]');
        assertTrue(!!btn);
        assertTrue(btn.disabled === true || btn.hasAttribute('disabled'));
        btn.click();
        assertEqual(flags.reset, 0, 'disabled 时不应触发 onReset');
    });

    it('S=canPrev/canNext=false A=渲染 → R=上一题/下一题 disabled', () => {
        destroyMountPoint(root);
        root = createMountPoint();
        flags.prev = 0;
        flags.next = 0;
        root.appendChild(renderBottombar({
            canReset: true,
            canPrev: false,
            canNext: false,
            onReset: () => {},
            onMastered: () => {},
            onWrong: () => {},
            onPrev: () => { flags.prev++; },
            onCatalog: () => {},
            onNext: () => { flags.next++; },
        }));
        const prev = root.querySelector('[aria-label="上一题"]');
        const next = root.querySelector('[aria-label="下一题"]');
        assertTrue(!!prev && prev.disabled);
        assertTrue(!!next && next.disabled);
        prev.click();
        next.click();
        assertEqual(flags.prev, 0);
        assertEqual(flags.next, 0);
    });

    it('S=isMastered+isWrong A=渲染 → R=aria 为取消/移出态且可点', () => {
        destroyMountPoint(root);
        root = createMountPoint();
        flags.mastered = 0;
        flags.wrong = 0;
        root.appendChild(renderBottombar({
            canReset: true,
            canPrev: true,
            canNext: true,
            isMastered: true,
            isWrong: true,
            onReset: () => {},
            onMastered: () => { flags.mastered++; },
            onWrong: () => { flags.wrong++; },
            onPrev: () => {},
            onCatalog: () => {},
            onNext: () => {},
        }));
        clickLabel(root, '取消掌握标记');
        clickLabel(root, '移出错题本');
        assertEqual(flags.mastered, 1);
        assertEqual(flags.wrong, 1);
    });
}, { layer: 'ui', tags: ['buttons', 'shell', 'bottombar'] });
