/**
 * PDF 解析
 * 从 app.js L1360-L1374 迁移
 * 依赖注入 pdfjsLib
 * @module core/parsers/pdf
 */

import { parseTextToQuestions } from './text.js';
import { buildStats } from './text.js';
import { cleanText } from './text.js';

/**
 * 解析 PDF 文件为题目数组
 * @param {File | ArrayBuffer} input
 * @param {object} pdfjsLib - PDF.js 全局对象（必须含 GlobalWorkerOptions.workerSrc 配置）
 * @returns {Promise<{ok: true, data: {questions, stats}, warnings, errors} | {ok: false, error, warnings, errors}>}
 */
export async function parsePdfFile(input, pdfjsLib) {
    const warnings = [];
    const errors = [];

    if (!pdfjsLib) {
        return {
            ok: false,
            error: { code: 'DEP_MISSING', message: 'PDF.js 未加载' },
            warnings,
            errors,
        };
    }

    let arrayBuffer;
    try {
        arrayBuffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
    } catch (e) {
        return {
            ok: false,
            error: { code: 'PARSE_ERROR', message: 'PDF 文件读取失败：' + e.message },
            warnings,
            errors,
        };
    }

    let pdf;
    try {
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
        return {
            ok: false,
            error: { code: 'PARSE_ERROR', message: 'PDF 解析失败：' + e.message },
            warnings,
            errors,
        };
    }

    let fullText = '';
    let totalPages = pdf.numPages || 0;

    for (let i = 1; i <= totalPages; i++) {
        try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(' ');
            fullText += pageText + '\n';
        } catch (e) {
            warnings.push({ message: `第 ${i} 页解析失败：${e.message}` });
        }
    }

    // 检测扫描件：每页平均字符数过少
    if (totalPages > 0) {
        const avgCharsPerPage = fullText.length / totalPages;
        if (avgCharsPerPage < 50) {
            warnings.push({
                message: `该 PDF 可能是扫描件（每页平均 ${Math.round(avgCharsPerPage)} 字符），建议使用 OCR 工具转换为文本后粘贴导入`,
            });
        }
    }

    if (!fullText.trim()) {
        return {
            ok: false,
            error: {
                code: 'PARSE_ERROR',
                message: 'PDF 中未提取到任何文本，可能是扫描件或纯图片 PDF',
            },
            warnings,
            errors,
        };
    }

    const cleaned = cleanText(fullText);
    const parsed = parseTextToQuestions(cleaned);

    return {
        ok: true,
        data: parsed.data,
        warnings: [...warnings, ...parsed.warnings],
        errors: [...errors, ...parsed.errors],
    };
}

/**
 * 设置 PDF.js worker（由调用方在 bootstrap 时调用）
 * @param {object} pdfjsLib
 * @param {string} workerSrc
 */
export function configurePdfWorker(pdfjsLib, workerSrc) {
    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    }
}
