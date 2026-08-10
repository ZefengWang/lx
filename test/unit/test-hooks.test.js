import { describe, it, beforeEach, afterEach } from '../runner.js';
import { assertEqual, assertTrue } from '../assert.js';
import { resetStateBeforeEach } from '../helpers.js';
import {
    toast, toastInfo, __setToastSinkForTest, __getToastLogForTest, __clearToastLogForTest,
} from '../../src/render/toast.js';
// toast 用于非 info 类型直调
import {
    appConfirm, __setConfirmForTest, __getConfirmLogForTest, __clearConfirmLogForTest,
} from '../../src/render/confirm.js';
import {
    openDrawer, closeDrawer, createDrawer, createOverlay,
    __getDrawerLogForTest, __clearDrawerLogForTest,
} from '../../src/render/drawer.js';
import {
    triggerBlobDownload, __setDownloadSinkForTest, __getDownloadLogForTest, __clearDownloadLogForTest,
} from '../../src/render/download.js';
import { createMountPoint, destroyMountPoint } from '../helpers.js';

describe('测试钩子：toast/confirm/drawer/download', () => {
    let root;

    beforeEach(async () => {
        await resetStateBeforeEach();
        __clearToastLogForTest();
        __clearConfirmLogForTest();
        __clearDrawerLogForTest();
        __clearDownloadLogForTest();
        __setToastSinkForTest(() => {});
        __setDownloadSinkForTest(() => {});
        root = createMountPoint();
        root.appendChild(createOverlay());
        root.appendChild(createDrawer());
    });

    afterEach(() => {
        __setToastSinkForTest(null);
        // 禁止卸成 null：否则回落原生 confirm，headed 下点取消会连环失败
        __setConfirmForTest(() => true);
        __setDownloadSinkForTest(null);
        destroyMountPoint(root);
        document.body.style.overflow = '';
    });

    it('toast sink 记录 type+文案且可跳过 DOM', () => {
        toastInfo('你好世界');
        toast('警告', { type: 'warning' });
        const log = __getToastLogForTest();
        assertEqual(log.length, 2);
        assertEqual(log[0].type, 'info');
        assertTrue(log[0].message.includes('你好'));
        assertEqual(log[1].type, 'warning');
    });

    it('confirm 钩子可断言文案与返回值', () => {
        __setConfirmForTest((msg) => msg.includes('确定'));
        assertEqual(appConfirm('确定删除吗？'), true);
        assertEqual(appConfirm('随便问问'), false);
        assertEqual(__getConfirmLogForTest().length, 2);
    });

    it('drawer open/close 写入观测日志', () => {
        openDrawer('unit');
        closeDrawer('unit');
        const log = __getDrawerLogForTest();
        assertTrue(log.some((e) => e.open === true));
        assertTrue(log.some((e) => e.open === false));
    });

    it('download sink 记录 filename', () => {
        const blob = new Blob(['hi'], { type: 'text/plain' });
        triggerBlobDownload(blob, 'demo.txt');
        const log = __getDownloadLogForTest();
        assertEqual(log.length, 1);
        assertEqual(log[0].filename, 'demo.txt');
    });
}, { layer: 'ui', tags: ['hooks'] });
