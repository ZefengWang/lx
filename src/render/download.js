/**
 * download.js — Blob 下载触发（可测试）
 * 测试注入 sink 时可断言 filename/blob，并跳过真实 <a download>。
 * @module render/download
 */

import { h } from './dom.js';

/** @type {null | ((entry: { filename: string, blob: Blob }) => void)} */
let _downloadSinkForTest = null;
/** @type {Array<{ filename: string, blob: Blob, size: number }>} */
let _downloadLogForTest = [];

/**
 * 【仅测试用】设置下载旁路；null 恢复真实下载。
 * @param {null | ((entry: { filename: string, blob: Blob }) => void)} sink
 */
export function __setDownloadSinkForTest(sink) {
    _downloadSinkForTest = typeof sink === 'function' ? sink : null;
}

/** 【仅测试用】 */
export function __getDownloadLogForTest() {
    return _downloadLogForTest.slice();
}

/** 【仅测试用】 */
export function __clearDownloadLogForTest() {
    _downloadLogForTest = [];
}

/**
 * 触发浏览器下载 Blob
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerBlobDownload(blob, filename) {
    const name = String(filename || 'download.bin');
    const entry = { filename: name, blob, size: blob ? blob.size : 0 };
    _downloadLogForTest.push(entry);
    if (_downloadSinkForTest) {
        try { _downloadSinkForTest(entry); } catch (_) { /* ignore */ }
        return;
    }
    if (typeof URL === 'undefined' || !URL.createObjectURL) return;
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
