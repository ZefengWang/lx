/**
 * 题库文件导入 UI 契约（抽屉 + settings 共用）
 *
 * 权威规则：所有「上传新题库」入口必须走本模块的 triggerFileImport / handleImportFile，
 * 禁止通过「点另一个页面的按钮」间接触发（脆弱的 DOM hack，会因按钮顺序变化而错绑）。
 *
 * 流程：选文件 → IOAPI.parseFile → IOAPI.importLibrary → LibraryAPI.switch
 *       → toastSuccess → navigate('study')
 *
 * @module render/contracts/import-library-flow
 */

import { toastSuccess, toastWarning } from '../toast.js';
import { navigate } from '../router.js';

/**
 * 处理导入的文件：解析 → 创建题库 → 切换 → 跳刷题页
 * @param {File} file
 * @returns {Promise<{ ok: boolean }>}
 */
export async function handleImportFile(file) {
    if (!file) return { ok: false };
    const LX = window.LX;
    const fileName = (file && file.name) ? file.name : 'upload.xlsx';
    try {
        const parseR = await LX.IOAPI.parseFile(file, { fileName });
        if (!parseR.ok) {
            toastWarning(`解析失败：${parseR.error?.message || '未知错误'}`);
            return { ok: false };
        }
        const qs = parseR.data.questions;
        if (!qs || qs.length === 0) {
            toastWarning('文件解析后没有题目，请检查格式');
            return { ok: false };
        }
        const name = fileName.replace(/\.(xlsx|xls|json|csv|txt)$/i, '');
        const impR = LX.IOAPI.importLibrary(name, qs);
        if (!impR.ok) {
            if (impR.error?.code === 'DUPLICATE') {
                toastWarning(`题库已存在（重复内容）：${impR.error.message}`);
                return { ok: false };
            }
            toastWarning(`导入失败：${impR.error?.message || '未知错误'}`);
            return { ok: false };
        }
        LX.LibraryAPI.switch(impR.data.id);
        toastSuccess(`成功导入 ${qs.length} 题`);
        navigate('study');
        return { ok: true };
    } catch (e) {
        toastWarning(`导入异常：${e.message}`);
        return { ok: false };
    }
}

/**
 * 触发文件选择对话框 + 导入流程。
 * 创建临时 input，选完即移除，不污染 DOM。
 * 供抽屉等「不在 settings 页」的入口使用。
 */
export function triggerFileImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.json,.csv,.txt';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        // 选完即移除 input（即使没选文件也移除）
        if (input.parentNode) input.parentNode.removeChild(input);
        if (!file) return; // 用户取消选择
        await handleImportFile(file);
    });
    input.click();
}
