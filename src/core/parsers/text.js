/**
 * 文本清洗 + 纯文本格式题目解析
 * 从 app.js L1252-L1358 迁移
 * @module core/parsers/text
 */

import { normalizeQuestion } from '../validators/question.js';

/**
 * 清洗文本：移除不可打印控制字符，合并多余空格
 * 保留换行符（用于题目分隔）
 * @param {string} text
 */
export function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * 解析纯文本格式题库
 * 支持格式：
 *   1. 题号行 + 下一行口诀（自动识别）
 *   2. 题号\t题目\t口诀（tab 分隔）
 *   3. 分类标题行（非数字开头）
 * @param {string} text
 * @returns {{ok: true, data: {questions: any[], stats: object}, warnings: any[], errors: any[]}}
 */
export function parseTextToQuestions(text) {
    const warnings = [];
    const errors = [];
    const questions = [];

    if (!text || !text.trim()) {
        return { ok: true, data: { questions, stats: buildStats(questions) }, warnings, errors };
    }

    const cleaned = cleanText(text);
    const lines = cleaned
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    let currentCategory = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 检测分类标题：非数字开头，且不包含表头关键词
        if (!/^\d/.test(line) && !line.includes('序号') && !line.includes('题目') && !line.includes('口诀')) {
            currentCategory = line.trim();
            continue;
        }

        // 匹配序号行：支持 1. / 1、 / 1） / 1) / 第1题 / (1) / Q1:
        const match = line.match(/^(?:第(\d+)题|[（(]?(\d+)[)）]?)[.、．\)）\s]*(.*)/);
        if (!match) continue;

        const id = parseInt(match[1] || match[2], 10);
        if (!Number.isFinite(id)) continue;

        let rest = match[3] || '';
        let question = rest;
        let mnemonic = '';

        // 检查下一行是否为口诀（非数字开头）
        if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            if (!/^\d/.test(nextLine) && !nextLine.includes('序号') && !nextLine.includes('题目')) {
                mnemonic = nextLine;
                i++;
            }
        }

        // tab 分隔的题目+口诀
        if (!mnemonic) {
            const parts = rest.split(/\t+/);
            if (parts.length >= 2) {
                question = parts[0];
                mnemonic = parts.slice(1).join(' ');
            }
        }

        if (!question.trim()) {
            errors.push({ row: i + 1, message: `第 ${id} 题内容为空，已跳过` });
            continue;
        }

        const normalized = normalizeQuestion({
            id,
            displayId: id,
            category: currentCategory || '未分类',
            question: question.trim(),
            type: 'essay',
            options: [],
            answer: '',
            explanation: mnemonic.trim() || '',
            mnemonic: mnemonic.trim() || '',
            answerText: '',
            remarks: '',
        });
        questions.push(normalized);
    }

    if (questions.length === 0) {
        warnings.push({ message: '未解析出任何题目，请检查文本格式' });
    }

    return { ok: true, data: { questions, stats: buildStats(questions) }, warnings, errors };
}

/**
 * 从 questions 构建统计
 * @param {any[]} questions
 */
export function buildStats(questions) {
    const byType = { single: 0, multi: 0, judge: 0, fill: 0, essay: 0 };
    const byCategory = {};
    for (const q of questions) {
        const t = q.type in byType ? q.type : 'essay';
        byType[t] = (byType[t] || 0) + 1;
        const c = q.category || '未分类';
        byCategory[c] = (byCategory[c] || 0) + 1;
    }
    return { total: questions.length, byType, byCategory };
}
