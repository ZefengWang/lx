/**
 * IOAPI - 文件导入导出统一入口
 * 修复 bug 1：Excel 导出列错位（使用单一 COLUMNS 数组保证表头与数据对齐）
 * 依赖注入：_XLSX 由 bootstrap.js 注入，便于测试时替换
 * @module api/io
 */

import * as LibraryAPI from './library.js';
import * as ProgressAPI from './progress.js';
import { ok, err, ErrorCode } from '../core/errors.js';
import { getState } from '../core/state.js';
import { parseFile as parseFileFn, parseText as parseTextFn } from '../core/parsers/index.js';
import { parseExcelWorkbook } from '../core/parsers/excel.js';
import { serializeJsonLibrary } from '../core/parsers/json.js';

/** 依赖注入槽 */
let _XLSX = null;
let _pdfjsLib = null;

/**
 * 注入外部依赖（bootstrap.js 启动时调用）
 * @param {{XLSX?: object, pdfjsLib?: object}} deps
 */
export function _injectDeps(deps = {}) {
    if (deps.XLSX) _XLSX = deps.XLSX;
    if (deps.pdfjsLib) _pdfjsLib = deps.pdfjsLib;
}

function getXLSX() {
    return _XLSX || (typeof window !== 'undefined' ? window.XLSX : null);
}

/**
 * 导出列定义（单一来源，修复 bug 1）
 * 表头顺序与数据行取值顺序严格一致
 */
const COLUMNS = Object.freeze([
    { header: '序号', get: (q) => q.displayId ?? q.id ?? '' },
    { header: '题型', get: (q) => q.type || 'essay' },
    { header: '分类', get: (q) => q.category || '' },
    { header: '题目', get: (q) => q.question || '' },
    { header: '选项', get: (q) => (q.options || []).join('\n') },
    { header: '正确答案', get: (q) => q.answer || '' },
    { header: '解析', get: (q) => q.explanation || '' },
    { header: '参考答案', get: (q) => q.answerText || '' },
    { header: '备注', get: (q) => q.remarks || '' },
]);

/**
 * 解析文件（转发到 parsers/index）
 * @param {File} file
 * @returns {Promise<{ok, data?, error?, warnings?, errors?}>}
 */
export async function parseFile(file) {
    return parseFileFn(file, { XLSX: getXLSX(), pdfjsLib: _pdfjsLib });
}

/**
 * 解析文本（转发到 parsers/index，自动检测 JSON / 纯文本）
 * @param {string} text
 */
export function parseText(text) {
    return parseTextFn(text);
}

/**
 * 导入题库（含去重检测）
 * @param {string} name
 * @param {any[]} questions
 * @param {object} [opts] - { skipDuplicateCheck?: boolean }
 * @returns {{ok: true, data: {id}} | {ok: false, error}}
 */
export function importLibrary(name, questions, opts = {}) {
    return LibraryAPI.create(name, questions, opts);
}

/**
 * 导出题库
 * @param {string} [libId] - 不传则导出当前题库
 * @param {'json'|'xlsx'} format
 * @returns {{ok: true, data: {blob: Blob, filename: string}} | {ok: false, error}}
 */
export function exportLibrary(libId, format = 'json') {
    const targetLibId = libId || getState().currentLibId;
    if (!targetLibId) {
        return err(ErrorCode.STATE_ERROR, '未选择题库');
    }
    const libR = LibraryAPI.get(targetLibId);
    if (!libR.ok) return libR;
    const lib = libR.data;
    const questions = lib.questions || [];
    const safeName = (lib.name || '题库').replace(/[\\/:*?"<>|]/g, '_');

    if (format === 'json') {
        const obj = serializeJsonLibrary(lib.name, questions);
        const text = JSON.stringify(obj, null, 2);
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        return ok({ blob, filename: `${safeName}.json` });
    }

    if (format === 'xlsx') {
        const XLSX = getXLSX();
        if (!XLSX) {
            return err(ErrorCode.DEP_MISSING, 'SheetJS 未加载，无法导出 xlsx');
        }
        // 修复 bug 1：表头与数据行严格按 COLUMNS 顺序
        const aoa = [COLUMNS.map((c) => c.header)];
        for (const q of questions) {
            aoa.push(COLUMNS.map((c) => c.get(q)));
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // 设置列宽（可选，提升可读性）
        ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(8, c.header.length * 2 + 4) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '题目');
        const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([arrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        return ok({ blob, filename: `${safeName}.xlsx` });
    }

    return err(ErrorCode.INVALID_INPUT, `不支持的导出格式：${format}`);
}

/**
 * 下载模板（最小 xlsx，含 5 种题型示例各 1 题）
 */
export function downloadTemplate() {
    const XLSX = getXLSX();
    if (!XLSX) {
        return err(ErrorCode.DEP_MISSING, 'SheetJS 未加载，无法生成模板');
    }
    const samples = [
        {
            displayId: 1,
            type: 'single',
            category: '示例分类',
            question: '下列哪项是正确的？（单选题示例）',
            options: ['选项 A 内容', '选项 B 内容', '选项 C 内容', '选项 D 内容'],
            answer: 'A',
            explanation: '解析内容写在这里',
            answerText: '',
            remarks: '',
        },
        {
            displayId: 2,
            type: 'multi',
            category: '示例分类',
            question: '下列哪些是正确的？（多选题示例，答案用逗号分隔）',
            options: ['选项 A', '选项 B', '选项 C', '选项 D'],
            answer: 'A,C',
            explanation: '多选答案用英文逗号或换行分隔',
            answerText: '',
            remarks: '',
        },
        {
            displayId: 3,
            type: 'judge',
            category: '示例分类',
            question: '地球是圆的。（判断题示例，答案填"对"或"错"）',
            options: [],
            answer: '对',
            explanation: '',
            answerText: '',
            remarks: '',
        },
        {
            displayId: 4,
            type: 'fill',
            category: '示例分类',
            question: '中国的首都是______。（填空题示例）',
            options: [],
            answer: '北京',
            explanation: '',
            answerText: '',
            remarks: '',
        },
        {
            displayId: 5,
            type: 'essay',
            category: '示例分类',
            question: '简答题示例：请简述你的学习心得。',
            options: [],
            answer: '',
            explanation: '简答题答案写在"参考答案"列，不自动判分',
            answerText: '简答题参考答案写在这里',
            remarks: '备注信息',
        },
    ];
    const aoa = [COLUMNS.map((c) => c.header)];
    for (const q of samples) {
        aoa.push(COLUMNS.map((c) => c.get(q)));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(8, c.header.length * 2 + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '题目模板');
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return ok({ blob, filename: '题库模板.xlsx' });
}

/**
 * 格式转换（题目数组 → 指定格式 blob）
 * @param {any[]} questions
 * @param {'json'|'xlsx'} toFormat
 * @param {string} [name] - 题库名（用于文件名）
 */
export function convert(questions, toFormat, name = '转换结果') {
    if (!Array.isArray(questions)) {
        return err(ErrorCode.INVALID_INPUT, 'questions 必须是数组');
    }
    const safeName = String(name).replace(/[\\/:*?"<>|]/g, '_');
    if (toFormat === 'json') {
        const obj = serializeJsonLibrary(name, questions);
        const text = JSON.stringify(obj, null, 2);
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        return ok({ blob, filename: `${safeName}.json` });
    }
    if (toFormat === 'xlsx') {
        const XLSX = getXLSX();
        if (!XLSX) return err(ErrorCode.DEP_MISSING, 'SheetJS 未加载');
        const aoa = [COLUMNS.map((c) => c.header)];
        for (const q of questions) {
            aoa.push(COLUMNS.map((c) => c.get(q)));
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(8, c.header.length * 2 + 4) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '题目');
        const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([arrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        return ok({ blob, filename: `${safeName}.xlsx` });
    }
    return err(ErrorCode.INVALID_INPUT, `不支持的格式：${toFormat}`);
}

/**
 * 导出全部进度为 JSON 字符串
 */
export function exportProgress() {
    return ProgressAPI.exportProgress();
}

/**
 * 导入进度（覆盖式）
 * @param {string} jsonString
 */
export function importProgress(jsonString) {
    return ProgressAPI.importProgress(jsonString);
}

export const IOAPI = {
    parseFile,
    parseText,
    importLibrary,
    exportLibrary,
    downloadTemplate,
    convert,
    exportProgress,
    importProgress,
    _injectDeps,
    _COLUMNS: COLUMNS, // 暴露给测试用
    /** 给测试用：直接传 XLSX workbook 对象走核心解析流程（无需 Blob） */
    _coreParseExcelWorkbook: parseExcelWorkbook,
};
