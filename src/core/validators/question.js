/**
 * 题目对象校验与归一化
 * @module core/validators/question
 */

export const QUESTION_TYPES = Object.freeze(['single', 'multi', 'judge', 'fill', 'essay']);

/**
 * 校验并归一化题目对象
 * @param {object} q
 * @param {number} [fallbackIdx] - 缺失 id 时用 index+1 作为 displayId
 * @returns {object} 归一化后的题目对象
 */
export function normalizeQuestion(q, fallbackIdx = 0) {
    if (!q || typeof q !== 'object') {
        return makeBlank(fallbackIdx);
    }

    // ID 体系（修复 bug 6：不覆盖原始 id）
    // - id: 原始序号（来自 Excel 序号列 / JSON 的 id）
    // - uid: 内部稳定标识，导入时由 library 层统一分配
    // - displayId: 用户可见序号，优先 id，缺失时用 fallbackIdx
    const rawId = q.id ?? q.displayId ?? q.uid ?? null;
    const id = rawId != null ? rawId : fallbackIdx;
    const displayId = q.displayId != null ? q.displayId : id;

    // 题型
    let type = (q.type || 'essay').toString().trim().toLowerCase();
    if (type.includes('单选')) type = 'single';
    else if (type.includes('多选')) type = 'multi';
    else if (type.includes('填空')) type = 'fill';
    else if (type.includes('判断')) type = 'judge';
    else if (!QUESTION_TYPES.includes(type)) type = 'essay';

    // 选项
    let options = Array.isArray(q.options) ? q.options : [];
    options = options.map((o) => String(o || '').trim()).filter(Boolean);

    // 答案
    const answer = String(q.answer || '').trim();
    // 兼容 answerText（简答题参考答案）
    const answerText = String(q.answerText || q.answerText || '').trim();

    // 解析/口诀：分别保留两个 key（BUG-011：背书计划表「口诀」与「解析」并列时各自独立）
    // 向后兼容：仅传 mnemonic 时 → explanation 也用之；仅传 explanation 时 → mnemonic 也用之
    const rawExplanation = String(q.explanation ?? '').trim();
    const rawMnemonic = String(q.mnemonic ?? '').trim();
    const explanation = rawExplanation || rawMnemonic;
    const mnemonic = rawMnemonic || rawExplanation;

    return {
        id,
        uid: q.uid ?? null, // 由 library 层在入库时统一分配
        displayId,
        category: String(q.category || '未分类').trim() || '未分类',
        question: String(q.question || q.title || '').trim(),
        type,
        options,
        answer,
        explanation,
        mnemonic,
        answerText: type === 'essay' ? answerText : '',
        remarks: String(q.remarks || '').trim(),
    };
}

/**
 * 校验题目完整性
 * @param {object} q
 * @returns {{valid: boolean, errors: Array<{field: string, message: string}>}}
 */
export function validateQuestion(q) {
    const errors = [];
    if (!q || typeof q !== 'object') {
        return { valid: false, errors: [{ field: '_', message: '题目对象无效' }] };
    }
    if (!q.question || !String(q.question).trim()) {
        errors.push({ field: 'question', message: '题目内容不能为空' });
    }
    if (!QUESTION_TYPES.includes(q.type)) {
        errors.push({ field: 'type', message: `题型无效：${q.type}` });
    }
    if ((q.type === 'single' || q.type === 'multi') && (!q.options || q.options.length < 2)) {
        errors.push({ field: 'options', message: '选择题至少需要 2 个选项' });
    }
    if ((q.type === 'single' || q.type === 'multi' || q.type === 'judge' || q.type === 'fill') && !q.answer) {
        errors.push({ field: 'answer', message: '该题型需要正确答案' });
    }
    return { valid: errors.length === 0, errors };
}

function makeBlank(fallbackIdx) {
    return {
        id: fallbackIdx,
        uid: null,
        displayId: fallbackIdx,
        category: '未分类',
        question: '',
        type: 'essay',
        options: [],
        answer: '',
        explanation: '',
        mnemonic: '',
        answerText: '',
        remarks: '',
    };
}
