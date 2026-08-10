/**
 * DefaultLibraryAPI - 内置默认题库
 *
 * 设计动机：第一次打开 app 的用户面对空状态要"抓瞎"找上传入口。
 * 提供一个内置示例题库（10 学科 × 5 题型 = 50 题），菜单/首页一键加载即可体验。
 *
 * 数据策略：JS 模块打包（不走 fetch）——首次访问立即可用、不依赖 SW、测试无需 mock。
 *
 * @module api/default-library
 */

import { LibraryAPI } from './library.js';
import { ok, err, ErrorCode } from '../core/errors.js';

/**
 * 默认题库名称
 */
export const DEFAULT_LIBRARY_NAME = '通识综合示例题库';

/**
 * 默认题库题目数据（50 题，10 分类 × 5 题型）
 *
 * 分类：语文 / 数学 / 英语 / 物理 / 化学 / 历史 / 地理 / 政治 / 生物 / 职业常识
 * 每分类 5 题，覆盖 single / multi / judge / fill / essay 五种题型各 1 题。
 *
 * 字段约定（参考 src/core/validators/question.js normalizeQuestion）：
 * - id: 序号（1-50）
 * - type: 'single' | 'multi' | 'judge' | 'fill' | 'essay'
 * - category: 学科分类
 * - question: 题干
 * - options: 选项数组（single/multi 必填 ≥2；judge/fill/essay 可空）
 * - answer: 正确答案（single='A'/'B'/...；multi='A,B,C'；judge='对'/'错'；fill=填空答案；essay 可空）
 * - explanation: 解析
 * - answerText: 简答题参考答案（仅 essay 需要）
 */
export const DEFAULT_QUESTIONS = [
    // ===== 语文（5 题）=====
    { id: 1, type: 'single', category: '语文', question: '《红楼梦》的作者是？', options: ['罗贯中', '曹雪芹', '施耐庵', '吴承恩'], answer: 'B', explanation: '曹雪芹创作了《红楼梦》前 80 回' },
    { id: 2, type: 'multi', category: '语文', question: '下列哪些属于唐宋八大家？', options: ['韩愈', '柳宗元', '李白', '苏轼'], answer: 'A,B,D', explanation: '唐宋八大家含韩愈、柳宗元、欧阳修、苏洵、苏轼、苏辙、王安石、曾巩；李白是唐代诗人非八大家' },
    { id: 3, type: 'judge', category: '语文', question: '"床前明月光"出自李白的《静夜思》。', answer: '对', explanation: '《静夜思》是李白的名篇，首句即"床前明月光"' },
    { id: 4, type: 'fill', category: '语文', question: '"三人行，必有我师焉"出自《______》。', answer: '论语', explanation: '出自《论语·述而》，孔子所言' },
    { id: 5, type: 'essay', category: '语文', question: '简述比喻修辞的作用。', answer: '', explanation: '考查修辞手法', answerText: '比喻通过把一种事物比作另一种事物，使抽象变具体、深奥变浅显，增强语言的形象性和感染力，帮助读者理解。' },

    // ===== 数学（5 题）=====
    { id: 6, type: 'single', category: '数学', question: '圆周率 π 约等于？', options: ['3.14', '2.71', '1.41', '1.62'], answer: 'A', explanation: 'π ≈ 3.14159...' },
    { id: 7, type: 'multi', category: '数学', question: '下列哪些是质数？', options: ['2', '7', '9', '15'], answer: 'A,B', explanation: '2 和 7 是质数；9=3×3、15=3×5 是合数' },
    { id: 8, type: 'judge', category: '数学', question: '0 是自然数。', answer: '对', explanation: '我国现行教材规定 0 是最小的自然数' },
    { id: 9, type: 'fill', category: '数学', question: '直角三角形两直角边分别为 3 和 4，斜边长为______。', answer: '5', explanation: '勾股定理：√(3²+4²)=5' },
    { id: 10, type: 'essay', category: '数学', question: '简述勾股定理的内容。', answer: '', explanation: '考查几何基础', answerText: '勾股定理：直角三角形两直角边的平方和等于斜边的平方，即 a² + b² = c²。' },

    // ===== 英语（5 题）=====
    { id: 11, type: 'single', category: '英语', question: 'Which one means "苹果"?', options: ['banana', 'apple', 'orange', 'grape'], answer: 'B', explanation: 'apple = 苹果' },
    { id: 12, type: 'multi', category: '英语', question: 'Which of the following are English tenses?（下列哪些是英语时态？）', options: ['Present', 'Past', 'Red', 'Future'], answer: 'A,B,D', explanation: 'Present/Past/Future 是时态；Red 是颜色' },
    { id: 13, type: 'judge', category: '英语', question: '"go" 的过去式是 "went"。', answer: '对', explanation: 'go 是不规则动词，过去式 went，过去分词 gone' },
    { id: 14, type: 'fill', category: '英语', question: 'The past tense of "eat" is ______.', answer: 'ate', explanation: 'eat → ate → eaten' },
    { id: 15, type: 'essay', category: '英语', question: 'Translate into Chinese: "Practice makes perfect."', answer: '', explanation: '考查谚语翻译', answerText: '熟能生巧。' },

    // ===== 物理（5 题）=====
    { id: 16, type: 'single', category: '物理', question: '光在真空中的速度约为？', options: ['3×10⁸ m/s', '3×10⁶ m/s', '3×10¹⁰ m/s', '3×10⁴ m/s'], answer: 'A', explanation: '光速 c ≈ 299,792,458 m/s ≈ 3×10⁸ m/s' },
    { id: 17, type: 'multi', category: '物理', question: '下列哪些是基本物理量？', options: ['长度', '质量', '速度', '时间'], answer: 'A,B,D', explanation: '基本物理量是长度、质量、时间等；速度是导出量' },
    { id: 18, type: 'judge', category: '物理', question: '牛顿第一定律又称惯性定律。', answer: '对', explanation: '牛顿第一定律：物体不受外力时保持静止或匀速直线运动' },
    { id: 19, type: 'fill', category: '物理', question: '力的国际单位是______。', answer: '牛顿', explanation: '力的单位是牛顿（N），简称牛' },
    { id: 20, type: 'essay', category: '物理', question: '简述能量守恒定律。', answer: '', explanation: '考查物理基础定律', answerText: '能量守恒定律：能量既不会凭空产生，也不会凭空消失，只能从一种形式转化为另一种形式，或从一个物体转移到另一个物体，总量保持不变。' },

    // ===== 化学（5 题）=====
    { id: 21, type: 'single', category: '化学', question: '水的化学式是？', options: ['CO₂', 'H₂O', 'O₂', 'NaCl'], answer: 'B', explanation: '水由 2 个氢原子和 1 个氧原子组成' },
    { id: 22, type: 'multi', category: '化学', question: '下列哪些是气体？', options: ['氧气', '铁', '氮气', '铜'], answer: 'A,C', explanation: 'O₂ 和 N₂ 常温下是气体；铁、铜是固体金属' },
    { id: 23, type: 'judge', category: '化学', question: '原子是化学变化中的最小粒子。', answer: '对', explanation: '化学反应中原子种类和数目不变，是化学变化的最小粒子' },
    { id: 24, type: 'fill', category: '化学', question: '食盐的化学式是______。', answer: 'NaCl', explanation: 'NaCl = 氯化钠，俗称食盐' },
    { id: 25, type: 'essay', category: '化学', question: '简述化学变化和物理变化的区别。', answer: '', explanation: '考查化学基础概念', answerText: '化学变化有新物质生成（如燃烧、生锈），物理变化没有新物质生成（如熔化、沸腾），只是状态或形状改变。' },

    // ===== 历史（5 题）=====
    { id: 26, type: 'single', category: '历史', question: '中华人民共和国成立于哪一年？', options: ['1945', '1949', '1950', '1978'], answer: 'B', explanation: '1949 年 10 月 1 日中华人民共和国成立' },
    { id: 27, type: 'multi', category: '历史', question: '下列哪些属于中国古代四大发明？', options: ['造纸术', '印刷术', '蒸汽机', '指南针'], answer: 'A,B,D', explanation: '四大发明：造纸术、印刷术、火药、指南针；蒸汽机是瓦特发明' },
    { id: 28, type: 'judge', category: '历史', question: '秦始皇统一六国建立了秦朝。', answer: '对', explanation: '公元前 221 年秦始皇统一六国' },
    { id: 29, type: 'fill', category: '历史', question: '丝绸之路的起点是古代的______（今西安）。', answer: '长安', explanation: '汉代张骞从长安出发开辟丝绸之路' },
    { id: 30, type: 'essay', category: '历史', question: '简述丝绸之路的历史意义。', answer: '', explanation: '考查古代商贸交流', answerText: '丝绸之路是古代连接东西方的商贸通道，促进了中西方经济、文化交流，把中国的丝绸、瓷器、造纸术等传到西方，也把西方的物产、宗教、艺术传入中国，对世界文明发展有深远影响。' },

    // ===== 地理（5 题）=====
    { id: 31, type: 'single', category: '地理', question: '世界上最长的河流是？', options: ['长江', '尼罗河', '亚马逊河', '黄河'], answer: 'B', explanation: '尼罗河约 6650 公里，是世界最长河流' },
    { id: 32, type: 'multi', category: '地理', question: '下列哪些是大洲？', options: ['亚洲', '太平洋', '欧洲', '非洲'], answer: 'A,C,D', explanation: '亚洲、欧洲、非洲是大洲；太平洋是大洋' },
    { id: 33, type: 'judge', category: '地理', question: '地球自西向东自转。', answer: '对', explanation: '地球自转方向是自西向东，产生昼夜交替' },
    { id: 34, type: 'fill', category: '地理', question: '中国的首都是______。', answer: '北京', explanation: '北京是中华人民共和国首都' },
    { id: 35, type: 'essay', category: '地理', question: '简述季风气候的特点。', answer: '', explanation: '考查气候类型', answerText: '季风气候的特点是：盛行风向随季节明显转换，夏季盛行来自海洋的暖湿气流，降水丰富；冬季盛行来自大陆的干冷气流，降水稀少。雨热同期是其显著特征。' },

    // ===== 政治（5 题）=====
    { id: 36, type: 'single', category: '政治', question: '我国的根本政治制度是？', options: ['人民代表大会制度', '总统制', '议会制', '联邦制'], answer: 'A', explanation: '人民代表大会制度是我国的根本政治制度' },
    { id: 37, type: 'multi', category: '政治', question: '下列哪些是我国社会主义核心价值观？', options: ['富强', '民主', '奢华', '文明'], answer: 'A,B,D', explanation: '社会主义核心价值观国家层面：富强、民主、文明、和谐；奢华不是' },
    { id: 38, type: 'judge', category: '政治', question: '宪法是国家的根本法。', answer: '对', explanation: '宪法具有最高法律效力，是治国安邦的总章程' },
    { id: 39, type: 'fill', category: '政治', question: '我国的国家宪法日是每年的______月 4 日。', answer: '12', explanation: '12 月 4 日是国家宪法日' },
    { id: 40, type: 'essay', category: '政治', question: '简述公民的基本义务（至少列举 3 项）。', answer: '', explanation: '考查宪法常识', answerText: '公民的基本义务包括：遵守宪法和法律、维护国家统一和民族团结、保守国家秘密、依法服兵役和参加民兵组织、依法纳税等。' },

    // ===== 生物（5 题）=====
    { id: 41, type: 'single', category: '生物', question: '光合作用发生在植物的哪个细胞器？', options: ['线粒体', '叶绿体', '细胞核', '核糖体'], answer: 'B', explanation: '叶绿体是光合作用的场所' },
    { id: 42, type: 'multi', category: '生物', question: '下列哪些属于哺乳动物？', options: ['鲸鱼', '蝙蝠', '鲨鱼', '老虎'], answer: 'A,B,D', explanation: '鲸鱼、蝙蝠、老虎是哺乳动物；鲨鱼是鱼类' },
    { id: 43, type: 'judge', category: '生物', question: 'DNA 是遗传信息的载体。', answer: '对', explanation: 'DNA（脱氧核糖核酸）储存生物体的遗传信息' },
    { id: 44, type: 'fill', category: '生物', question: '人体的造血器官是______。', answer: '骨髓', explanation: '骨髓是主要的造血器官' },
    { id: 45, type: 'essay', category: '生物', question: '简述生态系统的组成。', answer: '', explanation: '考查生态学基础', answerText: '生态系统由生物部分和非生物部分组成。生物部分包括生产者（植物）、消费者（动物）、分解者（细菌真菌）；非生物部分包括阳光、空气、水、土壤等。' },

    // ===== 职业常识（5 题）=====
    { id: 46, type: 'single', category: '职业常识', question: '简历中最应该突出的是？', options: ['兴趣爱好', '与岗位匹配的经历', '家庭成员', '星座'], answer: 'B', explanation: '简历应突出与目标岗位匹配的经历和能力' },
    { id: 47, type: 'multi', category: '职业常识', question: '下列哪些是良好的职场沟通习惯？', options: ['倾听对方完整表达', '及时回复邮件', '打断他人发言', '换位思考'], answer: 'A,B,D', explanation: '倾听、及时回复、换位思考是好习惯；打断他人是不礼貌的' },
    { id: 48, type: 'judge', category: '职业常识', question: '签订劳动合同是保护劳动者合法权益的重要方式。', answer: '对', explanation: '劳动合同是劳动者与用人单位确立劳动关系的法律凭证' },
    { id: 49, type: 'fill', category: '职业常识', question: 'PPT 是 ______ 的缩写。', answer: 'PowerPoint', explanation: 'PowerPoint 是微软的演示文稿软件' },
    { id: 50, type: 'essay', category: '职业常识', question: '简述时间管理中"四象限法则"的内容。', answer: '', explanation: '考查职业素养', answerText: '四象限法则按重要性和紧急性把任务分为四类：重要且紧急（立即做）、重要不紧急（计划做）、紧急不重要（委托做）、不紧急不重要（减少做）。建议把精力多投入"重要不紧急"的事。' },
];

/**
 * 计算默认题库元信息（不创建题库）
 * @returns {{ name: string, subjectCount: number, questionCount: number, subjects: string[] }}
 */
export function getDefaultLibraryMeta() {
    const subjects = [];
    const seen = new Set();
    for (const q of DEFAULT_QUESTIONS) {
        const c = q.category || '未分类';
        if (!seen.has(c)) { seen.add(c); subjects.push(c); }
    }
    return {
        name: DEFAULT_LIBRARY_NAME,
        subjectCount: subjects.length,
        questionCount: DEFAULT_QUESTIONS.length,
        subjects,
    };
}

/**
 * 加载默认题库
 *
 * 内部调用 LibraryAPI.create（带去重检测）+ 可选 switch。
 *
 * @param {object} [opts]
 * @param {boolean} [opts.skipDuplicateCheck=false] - 跳过指纹去重检测（测试或强制重新创建用）
 * @param {boolean} [opts.switchAfterCreate=true] - 创建后是否自动 switch 到新库
 * @returns {Result<{ id: string, name: string, questionCount: number, switched: boolean, duplicateOf?: string }>}
 *   - 新建成功：{ ok:true, data:{ id, name, questionCount, switched:true } }
 *   - 内容重复（默认 skipDuplicateCheck=false）：{ ok:true, data:{ id:matchingLibId, name, questionCount, switched, duplicateOf:matchingLibId } }
 *     注意：重复时仍返回 ok:true，调用方根据 data.duplicateOf 判断是"已存在"还是"新建"
 *   - 失败：{ ok:false, error }
 */
export function loadDefault(opts = {}) {
    const { skipDuplicateCheck = false, switchAfterCreate = true } = opts;

    const createR = LibraryAPI.create(DEFAULT_LIBRARY_NAME, DEFAULT_QUESTIONS, { skipDuplicateCheck });
    if (!createR.ok) {
        // DUPLICATE 是预期情况，转成"已存在"的成功返回
        // 注意：err() 把 extra 展开到 error 顶层，所以 matchingLibId 在 error.matchingLibId（非 error.details）
        if (createR.error?.code === ErrorCode.DUPLICATE && createR.error?.matchingLibId) {
            const matchingLibId = createR.error.matchingLibId;
            const meta = getDefaultLibraryMeta();
            let switched = false;
            if (switchAfterCreate) {
                const swR = LibraryAPI.switch(matchingLibId);
                if (swR.ok) switched = true;
            }
            return ok({
                id: matchingLibId,
                name: meta.name,
                questionCount: meta.questionCount,
                switched,
                duplicateOf: matchingLibId,
            });
        }
        // 其他错误原样返回
        return createR;
    }

    const newId = createR.data.id;
    let switched = false;
    if (switchAfterCreate) {
        const swR = LibraryAPI.switch(newId);
        if (!swR.ok) {
            // 创建成功但 switch 失败：返回创建成功但 switched:false
            return ok({
                id: newId,
                name: DEFAULT_LIBRARY_NAME,
                questionCount: DEFAULT_QUESTIONS.length,
                switched: false,
            });
        }
        switched = true;
    }

    return ok({
        id: newId,
        name: DEFAULT_LIBRARY_NAME,
        questionCount: DEFAULT_QUESTIONS.length,
        switched,
    });
}

export const DefaultLibraryAPI = {
    DEFAULT_LIBRARY_NAME,
    DEFAULT_QUESTIONS,
    loadDefault,
    getDefaultLibraryMeta,
};
