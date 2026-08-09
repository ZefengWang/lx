/**
 * 测试种子场景定义
 * 被 TestAPI.seed 复用，也可被测试用例直接 import
 * @module test/scenarios/seed
 */

/**
 * 生成 N 道混合题型的题目（程序化生成，避免硬编码大数组）
 * @param {number} count
 * @param {number} [startIndex=1]
 */
export function generateMixedQuestions(count, startIndex = 1) {
    const types = ['single', 'multi', 'judge', 'fill', 'essay'];
    const categories = ['教育学', '心理学', '哲学', '历史'];
    const questions = [];
    for (let i = 0; i < count; i++) {
        const idx = startIndex + i;
        const type = types[i % types.length];
        const category = categories[i % categories.length];
        const q = {
            id: idx,
            displayId: idx,
            type,
            category,
            question: `第 ${idx} 题：${type} 类型测试题目（${category}）`,
            options: [],
            answer: '',
            explanation: `第 ${idx} 题的解析内容`,
            remarks: '',
        };
        if (type === 'single') {
            q.options = ['选项 A', '选项 B', '选项 C', '选项 D'];
            q.answer = 'A';
        } else if (type === 'multi') {
            q.options = ['选项 A', '选项 B', '选项 C', '选项 D'];
            q.answer = 'A,C';
        } else if (type === 'judge') {
            q.answer = '对';
        } else if (type === 'fill') {
            q.answer = '北京';
        } else {
            q.answerText = `第 ${idx} 题参考答案`;
        }
        questions.push(q);
    }
    return questions;
}

/** 5 题简答题样本 */
export const essayQuestions = [
    { id: 1, displayId: 1, type: 'essay', category: '教育学', question: '简述皮亚杰的认知发展阶段理论。', answer: '', explanation: '感知运动、前运算、具体运算、形式运算四个阶段', answerText: '皮亚杰将认知发展分为四个阶段...', remarks: '' },
    { id: 2, displayId: 2, type: 'essay', category: '教育学', question: '简述建构主义学习理论的核心观点。', answer: '', explanation: '知识是建构的、学习是主动的、情境重要', answerText: '建构主义强调学习者的主动建构...', remarks: '' },
    { id: 3, displayId: 3, type: 'essay', category: '心理学', question: '简述马斯洛的需要层次理论。', answer: '', explanation: '生理、安全、归属、尊重、自我实现', answerText: '马斯洛将需要分为五个层次...', remarks: '' },
    { id: 4, displayId: 4, type: 'essay', category: '心理学', question: '简述艾宾浩斯遗忘曲线的规律。', answer: '', explanation: '先快后慢，呈负指数衰减', answerText: '遗忘进程不均衡，先快后慢...', remarks: '' },
    { id: 5, displayId: 5, type: 'essay', category: '哲学', question: '简述辩证唯物主义的基本观点。', answer: '', explanation: '物质决定意识、矛盾统一、发展观', answerText: '辩证唯物主义坚持物质第一性...', remarks: '' },
    { id: 6, displayId: 6, type: 'essay', category: '哲学', question: '简述休谟的怀疑论。', answer: '', explanation: '因果关系的必然性可以被质疑', answerText: '休谟质疑因果关系的客观必然性...', remarks: '' },
    { id: 7, displayId: 7, type: 'essay', category: '历史', question: '简述文艺复兴的历史意义。', answer: '', explanation: '人文主义觉醒、思想解放', answerText: '文艺复兴推动人文主义兴起...', remarks: '' },
    { id: 8, displayId: 8, type: 'essay', category: '历史', question: '简述工业革命对社会的影响。', answer: '', explanation: '生产力飞跃、阶级分化、城市化', answerText: '工业革命带来生产方式巨变...', remarks: '' },
    { id: 9, displayId: 9, type: 'essay', category: '教育学', question: '简述夸美纽斯的教育思想。', answer: '', explanation: '班级授课制、泛智教育', answerText: '夸美纽斯提出班级授课制...', remarks: '' },
    { id: 10, displayId: 10, type: 'essay', category: '教育学', question: '简述赫尔巴特的教学形式阶段理论。', answer: '', explanation: '明了、联想、系统、方法', answerText: '赫尔巴特提出四阶段教学法...', remarks: '' },
];

/** 每题型 1 题（共 5 题） */
export const allTypesQuestions = [
    { id: 1, displayId: 1, type: 'single', category: '示例', question: '建构主义学习理论的代表人物是？', options: ['斯金纳', '皮亚杰', '巴甫洛夫', '桑代克'], answer: 'B', explanation: '皮亚杰是建构主义代表', remarks: '' },
    { id: 2, displayId: 2, type: 'multi', category: '示例', question: '下列哪些属于人本主义心理学家？', options: ['马斯洛', '罗杰斯', '华生', '弗洛伊德'], answer: 'A,B', explanation: '马斯洛和罗杰斯是人本主义代表', remarks: '' },
    { id: 3, displayId: 3, type: 'judge', category: '示例', question: '认知负荷理论认为工作记忆容量是无限的。', options: [], answer: '错', explanation: '工作记忆容量有限', remarks: '' },
    { id: 4, displayId: 4, type: 'fill', category: '示例', question: '心理学之父是______。', options: [], answer: '冯特', explanation: '冯特 1879 年建立第一个心理学实验室', remarks: '' },
    { id: 5, displayId: 5, type: 'essay', category: '示例', question: '简述最近发展区理论。', answer: '', explanation: '维果茨基提出，现有水平与潜在水平之间的差距', answerText: '最近发展区指儿童现有水平与潜在发展水平之间的差距...', remarks: '' },
];

/**
 * 7 个种子场景
 * - libraries: 题库定义数组（不含 id，运行时由 LibraryAPI.create 生成）
 * - progressByLibIndex: { [libIndex]: { [qKey]: 'mastered'|'review' } }
 *   qKey 优先用 question.uid（导入后由 library 层赋值，1-based）
 */
export const scenarios = Object.freeze({
    empty: {
        libraries: [],
        progressByLibIndex: {},
    },
    small: {
        libraries: [{ name: '小型题库（10 题简答）', questions: essayQuestions }],
        progressByLibIndex: {},
    },
    large: {
        libraries: [{ name: '大型题库（50 题混合）', questions: generateMixedQuestions(50) }],
        progressByLibIndex: {},
    },
    withWrong: {
        libraries: [{ name: '错题题库（5 题）', questions: essayQuestions.slice(0, 5) }],
        // 5 题：uid 1,2 为掌握；uid 3,4,5 为错题
        progressByLibIndex: {
            0: { '1': 'mastered', '2': 'mastered', '3': 'review', '4': 'review', '5': 'review' },
        },
    },
    allTypes: {
        libraries: [{ name: '全题型题库（5 题）', questions: allTypesQuestions }],
        progressByLibIndex: {},
    },
    multiLibrary: {
        libraries: [
            { name: '题库 A', questions: essayQuestions.slice(0, 3) },
            { name: '题库 B', questions: essayQuestions.slice(3, 6) },
            { name: '题库 C', questions: essayQuestions.slice(6, 10) },
        ],
        progressByLibIndex: {},
    },
    withProgress: {
        libraries: [{ name: '进度题库（50 题混合）', questions: generateMixedQuestions(50) }],
        // 50 题：前 25 掌握，后 25 错题
        progressByLibIndex: {
            0: Object.fromEntries([
                ...Array.from({ length: 25 }, (_, i) => [String(i + 1), 'mastered']),
                ...Array.from({ length: 25 }, (_, i) => [String(i + 26), 'review']),
            ]),
        },
    },
});

/** 场景名列表 */
export const scenarioNames = Object.keys(scenarios);
