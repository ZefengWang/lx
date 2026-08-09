/**
 * 解析器路由
 * 根据输入类型分发到具体解析器
 * @module core/parsers/index
 */

import { parseExcelWorkbook, parseOptions } from './excel.js';
import { parsePdfFile, configurePdfWorker } from './pdf.js';
import { parseJsonLibrary } from './json.js';
import { parseTextToQuestions, cleanText } from './text.js';

export { parseExcelWorkbook, parsePdfFile, parseJsonLibrary, parseTextToQuestions, cleanText, parseOptions, configurePdfWorker };

/**
 * 检测字符串是否为 JSON 格式
 * @param {string} text
 */
export function looksLikeJson(text) {
    if (!text) return false;
    const trimmed = text.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/**
 * 解析文本（自动检测 JSON 或纯文本）
 * @param {string} text
 */
export function parseText(text) {
    if (looksLikeJson(text)) {
        const r = parseJsonLibrary(text);
        if (r.ok) return r;
        // JSON 解析失败，降级为纯文本解析
        // 失败原因可能是 JSON 字符串不完整等，文本解析可能仍能提取内容
    }
    return parseTextToQuestions(text);
}

/**
 * 根据文件扩展名选择解析器
 * @param {File} file
 * @param {object} depsOrOpts - { XLSX, pdfjsLib, fileName? }
 *   fileName 兜底：当 File.name 访问受限或异常时使用（现代浏览器 File.name 是只读的，
 *   不允许再赋值，这里不写入 file，只作为参数传进来）
 * @returns {Promise<{ok: boolean, ...}>}
 */
export async function parseFile(file, depsOrOpts = {}) {
    if (!file) {
        return {
            ok: false,
            error: { code: 'INVALID_INPUT', message: '未提供文件' },
            warnings: [],
            errors: [],
        };
    }
    const { XLSX, pdfjsLib, fileName } = depsOrOpts || {};

    const rawName = fileName || file.name || '';
    const name = String(rawName).toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';

    try {
        if (ext === 'json') {
            const text = await file.text();
            return parseJsonLibrary(text);
        }
        if (ext === 'xlsx' || ext === 'xls') {
            const xlsxLib = XLSX || (typeof window !== 'undefined' ? window.XLSX : null);
            if (!xlsxLib) {
                return {
                    ok: false,
                    error: { code: 'DEP_MISSING', message: 'SheetJS 未加载，请检查网络' },
                    warnings: [],
                    errors: [],
                };
            }
            const arrayBuffer = await file.arrayBuffer();
            const workbook = xlsxLib.read(arrayBuffer, { type: 'array' });
            return parseExcelWorkbook(workbook, xlsxLib);
        }
        if (ext === 'pdf') {
            const pdfLib = pdfjsLib || (typeof window !== 'undefined' ? window.pdfjsLib : null);
            return await parsePdfFile(file, pdfLib);
        }
        if (ext === 'txt' || ext === 'csv' || !ext) {
            const text = await file.text();
            return parseText(text);
        }
        return {
            ok: false,
            error: { code: 'INVALID_INPUT', message: `不支持的文件格式：.${ext || '未知'}` },
            warnings: [],
            errors: [],
        };
    } catch (e) {
        return {
            ok: false,
            error: { code: 'PARSE_ERROR', message: '文件解析失败：' + e.message },
            warnings: [],
            errors: [],
        };
    }
}
