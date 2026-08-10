import { describe, it, beforeEach } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import { resetStateBeforeEach } from '../helpers.js';
import {
    confirmLeaveIfDirty, isEditableTarget, shouldIgnoreKeyboard,
} from '../../src/render/gestures.js';
import {
    __setConfirmForTest, __clearConfirmLogForTest, __getConfirmLogForTest,
} from '../../src/render/confirm.js';

/**
 * SAR：手势/离开守卫（不依赖真实触摸）
 */
describe('UI：gestures 离开守卫与键盘忽略', () => {
    beforeEach(async () => {
        await resetStateBeforeEach();
        __clearConfirmLogForTest();
        __setConfirmForTest(() => true);
    });

    it('S=不脏 A=confirmLeaveIfDirty → R=true 且不弹 confirm', () => {
        assertEqual(confirmLeaveIfDirty(() => false), true);
        assertEqual(__getConfirmLogForTest().length, 0);
    });

    it('S=脏 + confirm 同意 A=confirmLeaveIfDirty → R=true', () => {
        __setConfirmForTest(() => true);
        assertEqual(confirmLeaveIfDirty(() => true), true);
        assertTrue(__getConfirmLogForTest().some((e) => e.message.includes('未提交')));
    });

    it('S=脏 + confirm 拒绝 A=confirmLeaveIfDirty → R=false', () => {
        __setConfirmForTest(() => false);
        assertEqual(confirmLeaveIfDirty(() => true), false);
        __setConfirmForTest(() => true);
    });

    it('S=非函数 isDirty A=confirmLeaveIfDirty → R=true', () => {
        assertEqual(confirmLeaveIfDirty(null), true);
        assertEqual(confirmLeaveIfDirty(undefined), true);
    });

    it('isEditableTarget：input/textarea/contenteditable', () => {
        const input = document.createElement('input');
        const ta = document.createElement('textarea');
        const div = document.createElement('div');
        div.contentEditable = 'true';
        const span = document.createElement('span');
        assertEqual(isEditableTarget(input), true);
        assertEqual(isEditableTarget(ta), true);
        assertEqual(isEditableTarget(div), true);
        assertEqual(isEditableTarget(span), false);
        assertEqual(isEditableTarget(null), false);
    });

    it('shouldIgnoreKeyboard：可编辑目标或组合键', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        try {
            const eEdit = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
            Object.defineProperty(eEdit, 'target', { value: input });
            assertEqual(shouldIgnoreKeyboard(eEdit), true);

            const eMeta = new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true });
            Object.defineProperty(eMeta, 'target', { value: document.body });
            assertEqual(shouldIgnoreKeyboard(eMeta), true);

            const eOk = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
            Object.defineProperty(eOk, 'target', { value: document.body });
            assertEqual(shouldIgnoreKeyboard(eOk), false);
        } finally {
            input.remove();
        }
    });
}, { layer: 'ui', tags: ['gestures', 'sar'] });
