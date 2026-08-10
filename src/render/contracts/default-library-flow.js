/**
 * 默认题库加载 UI 契约（首页空状态 + 设置页题库管理共用）
 *
 * 权威规则：两处入口点击「加载示例题库」必须走本模块的 loadDefaultLibrary，
 * 禁止各自内联实现，避免新建/重复/失败三种结果的处理逻辑分叉。
 * help 页只做文字引导，不承载加载操作（关注点分离：help 是文档，不是业务入口）。
 *
 * 处理：
 * - 失败 → toastWarning，停留原页
 * - 已存在同指纹题库 → appConfirm 询问是否切换；同意 → toastInfo + navigate study
 * - 新建成功 → toastSuccess（含题名 + 题量）+ navigate study
 *
 * @module render/contracts/default-library-flow
 */

import { toastInfo, toastSuccess, toastWarning } from '../toast.js';
import { appConfirm } from '../confirm.js';
import { navigate } from '../router.js';

/**
 * 加载内置示例题库并处理三种结果。
 * @param {object} LX window.LX
 * @returns {{ ok: true, data: { id: string, name: string, questionCount: number, switched: boolean, duplicateOf?: string } } | { ok: false, error: { code: string, message: string } }}
 *          透传 DefaultLibraryAPI.loadDefault 的 Result，便于调用方/测试断言。
 */
export function loadDefaultLibrary(LX) {
    const r = LX.DefaultLibraryAPI.loadDefault();
    if (!r.ok) {
        toastWarning(`加载失败：${r.error?.message || '未知错误'}`);
        return r;
    }
    if (r.data.duplicateOf) {
        // 已存在同指纹题库：询问是否切换过去
        if (appConfirm('示例题库已存在，是否切换过去？')) {
            toastInfo('已切换到示例题库');
            navigate('study');
        }
        return r;
    }
    toastSuccess(`已加载示例题库「${r.data.name}」，共 ${r.data.questionCount} 题`);
    navigate('study');
    return r;
}
