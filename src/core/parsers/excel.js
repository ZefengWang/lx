/**
 * Excel 解析
 * 从 app.js L1112-L1250 迁移
 * 修复 bug 2：选项分隔符去掉中文逗号，改为 /\n|;|；/
 * @module core/parsers/excel
 */

import { normalizeQuestion } from '../validators/question.js';
import { buildStats } from './text.js';
import { cleanText } from './text.js';

/**
 * 表头关键词（按优先级排序，第一个命中的列索引胜出）
 *
 * answer vs answerText 区分：
 *   - answer     ：正确答案（短）→ A/B、对/错、ABCD…（对应 Excel「正确答案」「答案」「answer」）
 *   - answerText ：参考答案（长）→ 完整答案解析文字、简答题标准答案（对应「参考答案」「参考解析」「标准答案」「参考答案要点」等）
 *
 * 这里刻意把「参考答案」从旧的 answer 组中移到 answerText 组：
 *   背书计划表/主观题库 Excel 的「参考答案」列是长文本，之前错误地塞给 answer，
 *   导致 essay.answerText = ''，进而简答题永远进入 notGraded（不判分）。
 */
const HEADER_PATTERNS = {
    id: [/^序号$/, /题号/, /^no\.?$/i, /^#$/, /编号/],
    type: [/题型/, /类型/, /question\s*type/i],
    question: [/^题目$/, /题干/, /内容/, /question/i],
    options: [/选项/, /option/i],
    // 注意：「参考答案」放在 answerText 组里，不再匹配 answer
    answer: [/正确答案/, /^答案$/, /^答案[:：]/, /^标准答案（字母）$/i, /answer\s*key/i, /^\banswer\b/i],
    answerText: [
        /参考答案/, /标准答案/, /参考答案要点/, /参考解析/, /答案解析/,
        /完整答案/, /答题要点/, /得分点/, /key\s*points?/i, /reference\s*answer/i,
    ],
    explanation: [/解析/, /explanation/i],
    // 「口诀」单独列：背书计划表常见，与「解析」并列时需分别提取
    mnemonic: [/口诀/, /mnemonic/i],
    // 「类别」是常见变体，注意不与 "题目类别" 里的「题目」冲突（question 正则已改为 ^题目$）
    category: [/分类/, /类别/, /模块/, /章节/, /^所属/, /category/i],
};

/** 「选项A」这类独立列的模式：匹配后会把同类列全部收集 */
const OPTION_SPLIT_COL_RE = /^选项\s*([A-Za-z0-9]+)/;

/**
 * 解析 SheetJS workbook
 * 多 Sheet 合并：每个 Sheet 作为一个独立的「来源分类」，Sheet 名作为兜底分类。
 * 修复：
 *   - 真实题库：选项A/B/C/D 分散列 → 合并为 options 数组
 *   - 真实题库：无「题型」列 → 按答案格式反推（单字母A→single, 多字母ABD→multi, 对/错→judge）
 *   - 真实题库：「题目类别」列 / Sheet 名 → 作为分类
 *   - 真实题库：第 1 行是标题 + 第 2 行才是表头
 * @param {object} workbook - XLSX.read 返回的 workbook
 * @param {object} [XLSX] - SheetJS 全局对象（用于 sheet_to_json）
 * @returns {{ok: true, data: {questions: any[], stats: object}, warnings: any[], errors: any[]}}
 */
export function parseExcelWorkbook(workbook, XLSX) {
    const warnings = [];
    const errors = [];
    const questions = [];

    if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
        return {
            ok: false,
            error: { code: 'PARSE_ERROR', message: 'Excel 文件无工作表' },
            warnings,
            errors,
        };
    }

    const xlsxUtil = XLSX || (typeof window !== 'undefined' ? window.XLSX : null);
    if (!xlsxUtil) {
        return {
            ok: false,
            error: { code: 'DEP_MISSING', message: 'SheetJS 未加载' },
            warnings,
            errors,
        };
    }

    for (let sheetIdx = 0; sheetIdx < workbook.SheetNames.length; sheetIdx++) {
        const sheetName = workbook.SheetNames[sheetIdx];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows = xlsxUtil.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!rows.length) continue;

        let currentCategory = '';
        // 兜底：Sheet 名作为默认分类（如果 Sheet 名不是默认的 Sheet1 等就采用）
        if (isMeaningfulSheetName(sheetName)) {
            currentCategory = sheetName;
        }

        let colMap = null;
        let headerRowFound = false;
        let uidOffset = questions.length; // 多 Sheet 合并时 uid 累加

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            // 检测表头行
            if (!headerRowFound) {
                const detected = detectHeaderRow(row);
                if (detected) {
                    colMap = detected;
                    headerRowFound = true;
                    continue;
                }
            } else if (colMap && !isPotentialDataRow(row, colMap) && isHeaderLike(row)) {
                // 后续分类标题后可能重复出现表头（如背书计划表「心理学/教育学」章节各自带表头）
                // 只有当「本行不像数据行（id 列不是序号数字）」时，才按重复表头跳过
                // （修复：数据行里若题目/口诀单元格含「口诀」「解析」等关键词，误判为表头被丢弃）
                continue;
            }

            // 分类标题行（非序号数字开头，且非表头）
            const firstCell = String(row[0] || '').trim();
            const isNumberRow = /^-?\d+$/.test(firstCell);
            if (!isNumberRow && firstCell.length > 0 && !isHeaderLike(row)) {
                // 如果第一个 cell 就像分类标题，就覆盖 currentCategory
                const looksLikeCategory = !isPotentialDataRow(row, colMap);
                if (looksLikeCategory) {
                    // 取该行第一个非空 cell 作为分类
                    const catName = row.find((c) => String(c || '').trim()) || firstCell;
                    if (catName && String(catName).trim()) {
                        currentCategory = String(catName).trim();
                        continue;
                    }
                }
            }

            // 数据行解析
            if (colMap && headerRowFound) {
                const parsed = parseDataRow(row, colMap, currentCategory, i + 1, sheetName);
                if (parsed.warning) warnings.push(parsed.warning);
                if (parsed.error) errors.push(parsed.error);
                if (parsed.question) {
                    parsed.question.uid = uidOffset + questions.length + 1; // 全局 uid
                    questions.push(parsed.question);
                }
            } else if (!headerRowFound && isNumberRow) {
                // 兜底：全表无表头的最简格式（序号 题目 口诀）
                const num = parseInt(firstCell, 10);
                if (!isNaN(num) && row.length >= 2) {
                    const q = String(row[1] || '').trim();
                    const mnemonic = String(row[2] || '').trim();
                    if (q) {
                        const nq = normalizeQuestion({
                            id: num,
                            displayId: num,
                            category: currentCategory || '未分类',
                            question: q,
                            type: 'essay',
                            options: [],
                            answer: '',
                            explanation: mnemonic,
                            mnemonic: mnemonic,
                            answerText: '',
                            remarks: '',
                        });
                        nq.uid = uidOffset + questions.length + 1;
                        questions.push(nq);
                    }
                }
            }
        }
    }

    if (questions.length === 0) {
        warnings.push({ message: '未解析出任何题目，请检查 Excel 格式（应包含"序号"表头行）' });
    }

    return { ok: true, data: { questions, stats: buildStats(questions) }, warnings, errors };
}

/** Sheet 名是否有业务含义（非 Sheet1/Sheet2 这种默认名） */
function isMeaningfulSheetName(name) {
    if (!name) return false;
    return !/^Sheet\d+$/i.test(name.trim());
}

/** 预判：如果有 colMap，id 列能完整解析为纯数字整数（前后无多余字符）才算潜在数据行（防止 2027xxx 这种数字开头的标题被误判） */
function isPotentialDataRow(row, colMap) {
    if (!colMap) return false;
    const idCell = String(row[colMap.id] ?? '').trim();
    if (!/^-?\d+$/.test(idCell)) return false;
    const n = parseInt(idCell, 10);
    return Number.isFinite(n);
}

/**
 * 检测表头行并构建列映射
 * 真实题库格式升级：
 *   - colMap.options 可能返回数组 []：{ optionsCols: [3,4,5,6] } 表示选项A/B/C/D 分散列
 *   - HEADER_PATTERNS.options 只作为匹配前缀，实际匹配到后扫描所有列找同源（选项A/B/C/D…）
 */
function detectHeaderRow(row) {
    const headers = row.map((h) => String(h || '').trim());
    const hasAnyHeader = headers.some((h) =>
        Object.values(HEADER_PATTERNS).flat().some((re) => re.test(h))
    );
    if (!hasAnyHeader) return null;

    const findFirstCol = (patterns) => {
        for (const re of patterns) {
            const idx = headers.findIndex((h) => re.test(h));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    // 特殊处理：选项列 → 可能是单一「选项」列，也可能是「选项A…选项X」分散列
    let optionsCols = [];
    const firstOptIdx = findFirstCol(HEADER_PATTERNS.options);
    if (firstOptIdx !== -1) {
        const firstHeader = headers[firstOptIdx] || '';
        const m = firstHeader.match(OPTION_SPLIT_COL_RE);
        if (m) {
            // 匹配到「选项X」格式 → 把整行里所有「选项X」格式的列都收集起来（按序号排序去重）
            const collected = new Map();
            for (let i = 0; i < headers.length; i++) {
                const h = headers[i];
                const mm = h.match(OPTION_SPLIT_COL_RE);
                if (mm) collected.set(mm[1].toUpperCase(), i);
            }
            const sortedKeys = [...collected.keys()].sort(compareOptionLabels);
            optionsCols = sortedKeys.map((k) => collected.get(k));
        } else {
            // 单一「选项」列，兼容旧格式
            optionsCols = [firstOptIdx];
        }
    }

    const colMap = {
        id: findFirstCol(HEADER_PATTERNS.id),
        type: findFirstCol(HEADER_PATTERNS.type),
        question: findFirstCol(HEADER_PATTERNS.question),
        answer: findFirstCol(HEADER_PATTERNS.answer),
        answerText: findFirstCol(HEADER_PATTERNS.answerText),
        explanation: findFirstCol(HEADER_PATTERNS.explanation),
        mnemonic: findFirstCol(HEADER_PATTERNS.mnemonic),
        category: findFirstCol(HEADER_PATTERNS.category),
        // 新字段：可能长度 >=1；长度为 0 时表示无选项列
        optionsCols,
    };

    // 兜底默认列号
    if (colMap.question === -1 && headers.length > 1) colMap.question = 1;
    if (colMap.id === -1 && headers.length > 0) colMap.id = 0;
    // 兼容旧字段 colMap.options（其他代码可能还在用）：取第一个
    colMap.options = optionsCols[0] ?? -1;

    return colMap;
}

/** 选项标签排序：优先按字母序 A/B/C，数字序 1/2/3 次之，同类型比较 */
function compareOptionLabels(a, b) {
    const aNum = Number(a), bNum = Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

function isHeaderLike(row) {
    return row.some((cell) => {
        const str = String(cell || '').trim();
        if (!str) return false;
        return (
            str.includes('序号') ||
            /^题目$/.test(str) ||
            str.includes('口诀') ||
            str.includes('选项') ||
            str.includes('答案') ||
            str.includes('解析')
        );
    });
}

/**
 * 解析数据行（真实题库兼容升级版）
 *   - colMap.optionsCols: 多列选项合并
 *   - 没有 colMap.type 的题型列时：根据答案格式反推 single/multi/judge
 *   - category 优先用「题目类别」列，否则用 currentCategory（Sheet 名/标题行）
 */
function parseDataRow(row, colMap, currentCategory, rowNumber, _sheetName) {
    const result = { question: null, warning: null, error: null };

    const idRaw = row[colMap.id];
    const id = parseInt(idRaw, 10);
    if (isNaN(id) || id === 0) {
        return result; // 静默跳过非数据行
    }

    const question = String(row[colMap.question] || '').trim();
    if (!question) {
        result.error = { row: rowNumber, message: `第 ${id} 题内容为空，已跳过` };
        return result;
    }

    // 分类
    let category = '';
    if (colMap.category !== -1) {
        category = String(row[colMap.category] || '').trim();
    }
    if (!category) category = currentCategory || '未分类';

    // 题型：先看显式列；没有就用 answer 推断
    let type = colMap.type !== -1 ? String(row[colMap.type] || '').trim().toLowerCase() : '';
    if (type.includes('单选')) type = 'single';
    else if (type.includes('多选')) type = 'multi';
    else if (type.includes('填空')) type = 'fill';
    else if (type.includes('判断')) type = 'judge';
    else type = ''; // 留空触发反推

    // 选项解析（修复真实题库多列选项 bug）
    let options = [];
    if (colMap.optionsCols && colMap.optionsCols.length) {
        if (colMap.optionsCols.length === 1) {
            // 旧格式：单个「选项」列 = 分隔字符串
            const optStr = String(row[colMap.optionsCols[0]] || '').trim();
            if (optStr) options = parseOptions(optStr);
        } else {
            // 新格式：选项A/B/C/D 分散列，非空即视为一个选项
            for (const idx of colMap.optionsCols) {
                const cell = String(row[idx] || '').trim();
                if (cell) options.push(cell);
            }
        }
    }

    // answer：短字母答案（A/B/C、对/错、ABCD…）；来源于「正确答案/答案」列
    // answerTextRaw：长文本参考答案；来源于「参考答案/标准解析」列
    //   - 若 Excel 没有「参考答案」列，但有非空的「答案」列且题干像主观题（essay 或无 option）：
    //     兜底把 answer 内容塞给 answerText（兼容旧 Excel 只有一个「答案/参考答案」列的场景）
    const answerRaw = colMap.answer !== -1 ? String(row[colMap.answer] || '').trim() : '';
    const answerTextRaw = colMap.answerText !== -1 ? String(row[colMap.answerText] || '').trim() : '';
    const explanationRaw = colMap.explanation !== -1 ? String(row[colMap.explanation] || '').trim() : '';
    // 口诀列单独提取（BUG-011：与「解析」列并列时分别保留）
    // 无口诀列时 colMap.mnemonic === -1，mnemonicRaw 为空，下方兜底用 explanation
    const mnemonicRaw = colMap.mnemonic !== -1 ? String(row[colMap.mnemonic] || '').trim() : '';
    const explanation = cleanText(explanationRaw);
    const mnemonic = mnemonicRaw ? cleanText(mnemonicRaw) : explanation;

    // 根据答案格式反推题型
    if (!type) {
        type = inferTypeFromAnswer(answerRaw, options);
    }
    // 反推不出来（answer 也空），但题干 + 选项为空 → 视为 essay（背书计划表的常见情况）
    if (!type && !options.length) type = 'essay';

    // 选择题但 options 太少时告警
    if ((type === 'single' || type === 'multi') && options.length <= 1) {
        result.warning = {
            row: rowNumber,
            message: `第 ${id} 题推断为 ${type} 但仅识别出 ${options.length} 个选项，请检查选项列`,
        };
    }

    // answerText 最终值（按题型 + 列来源决定）
    // 规则：
    //   1) 有 answerText 列 → 直接用 answerTextRaw（主观/客观题都照收，便于后续简答题导入后自动判分）
    //   2) 否则 essay：如果 answerRaw 不是纯字母/对错（即像长文本），或本来就只填了 answer 列 → 兜底 answerRaw
    //   3) 其他情况：留空
    let finalAnswerText = '';
    if (answerTextRaw) {
        finalAnswerText = answerTextRaw;
    } else if (type === 'essay' && answerRaw) {
        finalAnswerText = answerRaw;
    }

    result.question = normalizeQuestion({
        id,
        displayId: id,
        category,
        question: cleanText(question),
        type,
        options,
        answer: type === 'essay' ? '' : normalizeAnswerByType(answerRaw, type),
        explanation,
        mnemonic,
        answerText: cleanText(finalAnswerText),
        remarks: '',
    });

    return result;
}

/** 根据答案字符串和选项数反推题型 */
function inferTypeFromAnswer(ans, options) {
    if (!ans) {
        // 没有答案：有 2 个及以上选项当 single，否则 essay
        return options.length >= 2 ? 'single' : 'essay';
    }
    // 判断词
    if (/^(对|错|正确|错误|是|否|T|F|√|×|✓|✗)$/i.test(ans)) return 'judge';
    // 单字母 A-Z
    if (/^[A-Z]$/i.test(ans)) return 'single';
    // 多字母 ABC / A,B,C / A B C / A；B；C
    const clean = ans.replace(/[,\s，；;、]+/g, '');
    if (/^[A-Z]{2,}$/i.test(clean)) return 'multi';
    // 有填空题标志（下划线、空白符很多、答案短）
    if (/_{2,}|____/.test(ans) || (ans.length <= 20 && options.length === 0)) {
        // 无法判断填空和 essay，默认 essay（填空题更多依赖题干下划线）
    }
    return 'essay';
}

/** 按题型标准化答案（多选 → 统一去空格、逗号分隔） */
function normalizeAnswerByType(ans, type) {
    if (!ans) return '';
    if (type === 'multi') {
        const letters = [...ans.toUpperCase()].filter((c) => /[A-Z]/.test(c));
        return [...new Set(letters)].sort().join(',');
    }
    if (type === 'single') {
        const m = ans.match(/[A-Za-z]/);
        return m ? m[0].toUpperCase() : ans.trim();
    }
    if (type === 'judge') {
        const a = ans.trim();
        if (/^(对|正确|是|T|√|✓)$/i.test(a)) return '对';
        if (/^(错|错误|否|F|×|✗)$/i.test(a)) return '错';
        return a;
    }
    return ans.trim();
}

/**
 * 选项解析（多策略）
 * 1. 优先按换行
 * 2. 退而按 "A." "B." 模式
 * 3. 再退按分号（半角 / 全角）
 * 不再用中文逗号「，」分隔（修复 bug 2）
 * @param {string} optStr
 * @returns {string[]}
 */
export function parseOptions(optStr) {
    if (!optStr) return [];
    const s = optStr.trim();
    if (!s) return [];

    // 1. 优先按换行
    if (s.includes('\n')) {
        return s
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean);
    }

    // 2. 按 "A." "B." 标签拆分
    const labelMatch = s.match(/(?:^|\s)([A-Za-z])[.、\)）]\s*/g);
    if (labelMatch && labelMatch.length >= 2) {
        // 用前瞻正则拆分
        const parts = s
            .split(/(?=[A-Za-z][.、\)）])/)
            .map((x) => x.trim())
            .filter(Boolean);
        if (parts.length >= 2) return parts;
    }

    // 3. 按半角分号
    if (s.includes(';')) {
        return s
            .split(';')
            .map((x) => x.trim())
            .filter(Boolean);
    }

    // 4. 按中文分号
    if (s.includes('；')) {
        return s
            .split('；')
            .map((x) => x.trim())
            .filter(Boolean);
    }

    // 5. 单个选项
    return [s];
}
