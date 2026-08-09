/**
 * JSON 格式题库解析
 * 从 app.js L1264-L1296（parseTextToQuestions 内的 JSON 分支）迁移
 * 支持：
 *   - 数组 [{...}, {...}]
 *   - 对象 { questions: [...] }
 *   - 单对象 {...}
 * @module core/parsers/json
 */

import { normalizeQuestion } from '../validators/question.js';
import { buildStats } from './text.js';

/** 题库 JSON schema 版本 */
export const SCHEMA_VERSION = '1.0';

/**
 * 解析 JSON 字符串/对象为题目数组
 * @param {string | object} input
 * @returns {{ok: true, data: {questions: any[], stats: object, meta?: object}, warnings: any[], errors: any[]}}
 */
export function parseJsonLibrary(input) {
    const warnings = [];
    const errors = [];

    let data;
    if (typeof input === 'string') {
        try {
            data = JSON.parse(input);
        } catch (e) {
            return {
                ok: false,
                error: { code: 'PARSE_ERROR', message: 'JSON 解析失败：' + e.message },
                warnings,
                errors,
            };
        }
    } else if (input && typeof input === 'object') {
        data = input;
    } else {
        return {
            ok: false,
            error: { code: 'INVALID_INPUT', message: '输入必须是 JSON 字符串或对象' },
            warnings,
            errors,
        };
    }

    // 提取 questions 数组
    let rawQuestions = [];
    let meta = undefined;
    if (Array.isArray(data)) {
        rawQuestions = data;
    } else if (data.questions && Array.isArray(data.questions)) {
        rawQuestions = data.questions;
        meta = {
            format: data.format,
            version: data.version,
            exportedAt: data.exportedAt,
            library: data.library,
        };
    } else if (data.library && Array.isArray(data.library.questions)) {
        // serializeJsonLibrary 产物：{ format, version, exportedAt, library: { name, questions } }
        rawQuestions = data.library.questions;
        meta = {
            format: data.format,
            version: data.version,
            exportedAt: data.exportedAt,
            library: { name: data.library.name, questions: rawQuestions },
        };
    } else if (typeof data === 'object') {
        // 单个题目对象
        rawQuestions = [data];
    }

    if (!rawQuestions.length) {
        warnings.push({ message: '题库为空' });
    }

    const questions = [];
    rawQuestions.forEach((q, idx) => {
        if (!q || typeof q !== 'object') {
            errors.push({ row: idx + 1, message: '题目对象无效，已跳过' });
            return;
        }
        const normalized = normalizeQuestion(q, idx + 1);
        if (!normalized.question) {
            errors.push({ row: idx + 1, message: `题目 #${normalized.id || idx + 1} 内容为空，已跳过` });
            return;
        }
        questions.push(normalized);
    });

    return {
        ok: true,
        data: { questions, stats: buildStats(questions), meta },
        warnings,
        errors,
    };
}

/**
 * 序列化题库为标准 JSON（含 schema version）
 * @param {string} name
 * @param {any[]} questions
 */
export function serializeJsonLibrary(name, questions) {
    return {
        format: 'lx-quiz-library',
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        library: {
            name,
            questions,
        },
    };
}
