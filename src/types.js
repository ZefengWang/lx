/**
 * 全局类型定义（JSDoc @typedef）
 *
 * 本文件不含任何运行时代码，仅通过 JSDoc @typedef 声明共享类型，
 * 供 jsconfig.json / IDE 在整个项目范围内提供类型提示与契约检查。
 *
 * 契约来源：docs/CONTRACT-core.md + docs/CONTRACT-api.md
 * 修改类型定义时必须同步更新上述契约文档。
 *
 * 使用方式（其他文件直接引用类型名即可）：
 *   /** @type {Result<Question>} *\/
 *   const r = QuestionAPI.get(1);
 *
 * @file 全局类型定义
 */

// ============================================================================
// Result（所有 API 函数的返回值铁律）
// ============================================================================

/**
 * 成功结果
 * @template T
 * @typedef {Object} Ok
 * @property {true} ok
 * @property {T} data
 */

/**
 * 错误结果
 * @typedef {Object} Err
 * @property {false} ok
 * @property {{ code: string; message: string; [key: string]: * }} error
 */

/**
 * Result 联合类型（所有 api/ 函数必须返回此类型，禁止 throw）
 * @template T
 * @typedef {Ok<T> | Err} Result
 */

// ============================================================================
// 题目与题库
// ============================================================================

/**
 * 题目状态枚举（铁律：只能用这三个值，禁止 'pending'/'correct'/'wrong'）
 * @typedef {'none' | 'mastered' | 'review'} QuestionStatus
 * - none     = 未开始/未标记（API 默认值）
 * - mastered  = 已掌握
 * - review    = 错题
 */

/**
 * 题型枚举
 * @typedef {'single' | 'multi' | 'judge' | 'fill' | 'essay'} QuestionType
 */

/**
 * 归一化后的题目对象
 * @typedef {Object} Question
 * @property {number} id - 序号（1-based）
 * @property {number} uid - 内部稳定标识（ProgressAPI 进度 key，优先使用）
 * @property {number} displayId - 展示用 ID（向后兼容，== id）
 * @property {QuestionType} type - 题型
 * @property {string} question - 题干
 * @property {string[]} [options] - 选项（single/multi/judge 必填）
 * @property {string} answer - 正确答案（字母 / 'A,B,C' / '对' / 文本）
 * @property {string} [explanation] - 解析
 * @property {string} [answerText] - 简答题参考答案（用于 bigram 模糊判分）
 * @property {string} [remarks] - 备注
 * @property {string} [category] - 分类
 */

/**
 * 题库对象
 * @typedef {Object} Library
 * @property {string} id - 题库 ID（lib_<timestamp>_<rand>）
 * @property {string} name - 题库名
 * @property {Question[]} questions - 题目数组
 * @property {string} createdAt - ISO 创建时间
 */

/**
 * 题库摘要（list() 返回）
 * @typedef {Object} LibrarySummary
 * @property {string} id
 * @property {string} name
 * @property {number} questionCount
 * @property {number} masteredCount
 * @property {number} reviewCount
 * @property {number} percent - 掌握百分比 [0, 100]
 */

// ============================================================================
// 答题判分
// ============================================================================

/**
 * 答题判分结果（QuestionAPI.answer 返回的 data）
 * @typedef {Object} AnswerResult
 * @property {boolean} correct - 是否正确
 * @property {boolean} notGraded - essay 未设参考答案时为 true（不判分、不影响状态）
 * @property {number} [similarity] - essay 相似度 [0, 1]
 * @property {string} correctAnswer - 正确答案
 * @property {string} explanation - 解析
 * @property {'mastered' | 'review' | null} autoStatus - 自动设置的状态；null = 未设置（notGraded 或错题本模式）
 */

// ============================================================================
// 统计
// ============================================================================

/**
 * 统计摘要
 * @typedef {Object} StatsSummary
 * @property {number} total
 * @property {number} mastered
 * @property {number} review
 * @property {number} percent - 掌握百分比 [0, 100]
 * @property {Record<string, CategoryStat>} [byCategory]
 * @property {Record<QuestionType, CategoryStat>} [byType]
 */

/**
 * 分类统计
 * @typedef {Object} CategoryStat
 * @property {number} total
 * @property {number} mastered
 * @property {number} review
 */

// ============================================================================
// 导航
// ============================================================================

/**
 * 导航当前位置
 * @typedef {Object} NavPosition
 * @property {number} index - 当前索引
 * @property {(string|number|null)} qId - 当前题目 ID（uid），null 表示无题目
 * @property {number} total - 当前筛选下题目总数
 */

/**
 * 题干搜索选项（QuestionAPI.search）
 * @typedef {Object} QuestionSearchOptions
 * @property {Array<'question'|'options'|'explanation'|'category'>} [fields] 默认 ['question']
 * @property {string} [category]
 * @property {'all'|'none'|'mastered'|'review'} [status]
 * @property {number} [limit] 默认 50
 * @property {number} [offset] 默认 0
 * @property {string[]} [keywords] v1.2：有序 AND 关键字；非空时优先于单体 keyword
 */

/**
 * 练习会话（DrillAPI：快速刷题 / 背诵记忆）
 * @typedef {Object} DrillSession
 * @property {'quick'|'memory'} mode
 * @property {(string|number)[]} queue
 * @property {number} progressIndex
 * @property {number} viewIndex
 * @property {Object<string, { userAnswer: any, correct: boolean, correctAnswer?: any, notGraded?: boolean }>} answers
 */

// ============================================================================
// 应用全局状态（core/state.js）
// ============================================================================

/**
 * 应用全局状态
 * @typedef {Object} AppState
 * @property {string | null} currentLibId - 当前题库 ID
 * @property {'sequential' | 'random'} mode - 浏览模式
 * @property {string} category - 分类筛选（'all' 或分类名）
 * @property {'all' | 'none' | 'mastered' | 'review'} statusFilter - 状态筛选
 * @property {boolean} isWrongBookMode - 是否处于错题专注模式
 * @property {{ category: string; mode: string; index: number; statusFilter: string } | null} wrongBookSnapshot - 错题本进入前的状态快照
 * @property {number} lastIndex - 当前题目索引
 * @property {(string|number|null)} lastQId - 当前题目 ID
 * @property {(string|number)[]} filteredQIds - 当前筛选下题目 ID 列表
 * @property {DrillSession | null} drillSession - 练习会话；null 表示未在会话中
 * @property {{ mnemonic: boolean; answer: boolean; remark: boolean }} uiVisibility - UI 可见性
 */

// ============================================================================
// 事件 Payload 类型
// ============================================================================

/**
 * QUESTION_ANSWERED 事件 payload
 * @typedef {Object} QuestionAnsweredPayload
 * @property {string} libId
 * @property {string|number} qId
 * @property {boolean} correct
 * @property {boolean} notGraded
 * @property {string|string[]} userAnswer
 * @property {string} correctAnswer
 * @property {QuestionType} type
 */

/**
 * QUESTION_STATUS_CHANGED 事件 payload
 * @typedef {Object} QuestionStatusChangedPayload
 * @property {string} libId
 * @property {string|number} qId
 * @property {QuestionStatus} oldStatus
 * @property {QuestionStatus} newStatus
 * @property {string} source - 触发来源（'answer' | 'wrong-book' | 'api' 等）
 */

export {};
