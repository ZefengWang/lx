import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertErr, assertEqual, assertTrue, assertFalse } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';
import { parseOptions } from '../../src/core/parsers/excel.js';
import { isEditableTarget, shouldIgnoreKeyboard, attachKeyboardGuard, attachSwipeGestures } from '../../src/render/gestures.js';

/**
 * 模拟一次完整的 touch 事件序列
 * @param {HTMLElement} el
 * @param {Array<{clientX: number, clientY: number}>} points [start, move, end]
 */
function fireTouch(el, points) {
    const mk = (type, point) => {
        const t = { clientX: point.clientX, clientY: point.clientY };
        const ev = new Event(type, { bubbles: true, cancelable: true });
        // 同时设置 touches 和 changedTouches（configurable 避免重复定义报错）
        Object.defineProperty(ev, 'touches', { value: [t], configurable: true });
        Object.defineProperty(ev, 'changedTouches', { value: [t], configurable: true });
        return ev;
    };
    el.dispatchEvent(mk('touchstart', points[0]));
    if (points[1]) el.dispatchEvent(mk('touchmove', points[1]));
    el.dispatchEvent(mk('touchend', points[points.length - 1]));
}

/**
 * Bug 回归测试
 * 钉死 6 个历史修复
 */
describe('Bug 回归', () => {
    let LX;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('BUG-001: S=xlsx 导出 A=读表 → R=序号列对齐（修复后）', async () => {
        const r = LX.LibraryAPI.create('bug1', [
            { id: 5, type: 'single', category: '甲', question: '题5', options: ['A', 'B'], answer: 'A', explanation: '解5' },
        ]);
        const libId = r.data.id;
        const exportR = LX.IOAPI.exportLibrary(libId, 'xlsx');
        assertOk(exportR);

        const buf = await exportR.data.blob.arrayBuffer();
        const wb = window.XLSX.read(buf, { type: 'array' });
        const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        // 验证第 1 列是"序号"表头，第 1 列数据是 5（不是其他值）
        assertEqual(rows[0][0], '序号', '表头第 1 列应为"序号"');
        assertEqual(rows[1][0], 5, '数据行第 1 列应为 5');
        // 验证第 2 列是"题型"表头，对应数据是 single
        assertEqual(rows[0][1], '题型');
        assertEqual(rows[1][1], 'single');
    });

    it('BUG-002: S=选项含中文逗号 A=parseOptions → R=不截断（修复后）', () => {
        // 修复前：分隔符含中文逗号「，」会误伤选项
        // 修复后：分隔符为 /\n|;|；/，不含中文逗号
        const opts = parseOptions('A.内容，含中文逗号\nB.另一项\nC.第三项');
        assertEqual(opts.length, 3, '应解析为 3 项（含中文逗号不被截断）');
        assertTrue(opts[0].includes('含中文逗号'), '第 1 项应保留中文逗号内容');

        // 分号分隔
        const opts2 = parseOptions('选项A;选项B;选项C');
        assertEqual(opts2.length, 3);
    });

    it('BUG-003: S=QuotaExceeded A=create → R=STORAGE_FULL 不抛（修复后）', () => {
        // stub localStorage.setItem 抛 QuotaExceededError
        const original = localStorage.setItem;
        let called = false;
        localStorage.setItem = function () {
            called = true;
            const e = new Error('QuotaExceeded');
            e.name = 'QuotaExceededError';
            throw e;
        };
        try {
            // 调一个会触发 setLibraries 的操作
            const r = LX.LibraryAPI.create('容量测试', [
                { id: 1, type: 'essay', question: 'q', answer: '', explanation: '' },
            ]);
            assertTrue(called, '应调用 setItem');
            assertErr(r, 'STORAGE_FULL', '应返回 STORAGE_FULL 而非抛错');
        } finally {
            localStorage.setItem = original;
        }
    });

    it('BUG-004: S=100 次 setStatus A=计时 → R=<500ms 缓存命中（修复后）', () => {
        const r = LX.LibraryAPI.create('bug4', [
            { id: 1, type: 'essay', question: 'q1', answer: '', explanation: '' },
        ]);
        LX.LibraryAPI.switch(r.data.id);
        const q = LX.QuestionAPI.get(1).data;

        const t0 = performance.now();
        for (let i = 0; i < 100; i++) {
            LX.ProgressAPI.setStatus(q, i % 2 === 0 ? 'mastered' : 'review', {
                libId: r.data.id,
                questions: [q],
            });
        }
        const elapsed = performance.now() - t0;
        assertTrue(elapsed < 500, `100 次 setStatus 耗时 ${elapsed.toFixed(1)}ms，应 < 500ms`);
    });

    // BUG-005: 键盘事件守护 —— input/textarea 内按方向键不切题
    // 原 skip 因 UI 层未就绪；Render 层 gestures.js 完成后补回归
    it('BUG-005: S=焦点在 input A=方向键 → R=不切题（修复后）', () => {
        // 1. 纯函数：isEditableTarget 识别可编辑元素
        const input = document.createElement('input');
        assertTrue(isEditableTarget(input), '<input> 应识别为可编辑');

        const textarea = document.createElement('textarea');
        assertTrue(isEditableTarget(textarea), '<textarea> 应识别为可编辑');

        const select = document.createElement('select');
        assertTrue(isEditableTarget(select), '<select> 应识别为可编辑');

        const div = document.createElement('div');
        div.setAttribute('contenteditable', 'true');
        assertTrue(isEditableTarget(div), 'contenteditable=true 的 div 应识别为可编辑');

        const span = document.createElement('span');
        assertFalse(isEditableTarget(span), '普通 <span> 不应识别为可编辑');

        assertFalse(isEditableTarget(null), 'null 不应识别为可编辑');

        // 2. shouldIgnoreKeyboard：模拟键盘事件的 target
        function fakeEvent(target, key, mods = {}) {
            return {
                target, key,
                ctrlKey: !!mods.ctrl, metaKey: !!mods.meta, altKey: !!mods.alt,
                preventDefault() {},
            };
        }

        // input 内按方向键 → 应忽略（不切题）
        assertTrue(
            shouldIgnoreKeyboard(fakeEvent(input, 'ArrowRight')),
            'input 内按 ArrowRight 应被忽略（BUG-005 核心）'
        );
        assertTrue(
            shouldIgnoreKeyboard(fakeEvent(textarea, 'ArrowLeft')),
            'textarea 内按 ArrowLeft 应被忽略'
        );
        assertTrue(
            shouldIgnoreKeyboard(fakeEvent(div, 'ArrowRight')),
            'contenteditable 内按方向键应被忽略'
        );

        // 普通元素按方向键 → 不应忽略（应切题）
        assertFalse(
            shouldIgnoreKeyboard(fakeEvent(span, 'ArrowRight')),
            '普通元素上按 ArrowRight 不应被忽略'
        );
        assertFalse(
            shouldIgnoreKeyboard(fakeEvent(document.body, 'ArrowLeft')),
            'body 上按 ArrowLeft 不应被忽略'
        );

        // Ctrl/Meta 组合键 → 应忽略（不切题，保留浏览器/编辑器快捷键）
        assertTrue(
            shouldIgnoreKeyboard(fakeEvent(span, 'ArrowLeft', { ctrl: true })),
            'Ctrl+ArrowLeft 应被忽略（选词快捷键）'
        );
        assertTrue(
            shouldIgnoreKeyboard(fakeEvent(span, 'ArrowRight', { meta: true })),
            'Meta+ArrowRight 应被忽略'
        );
    });

    it('BUG-005b: S=非编辑态 A=方向键 → R=切题；编辑态忽略（修复后）', () => {
        let prevCount = 0;
        let nextCount = 0;
        const detach = attachKeyboardGuard({
            onPrev: () => { prevCount++; },
            onNext: () => { nextCount++; },
        });

        // 辅助：从指定元素派发 keydown（自动冒泡到 document，event.target 即为该元素）
        function press(el, key) {
            el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        }

        // 普通元素（div）上按方向键 → 触发切题
        const div = document.createElement('div');
        document.body.appendChild(div);
        press(div, 'ArrowRight');
        assertEqual(nextCount, 1, '普通 div 上 ArrowRight 应触发 onNext');
        press(div, 'ArrowLeft');
        assertEqual(prevCount, 1, '普通 div 上 ArrowLeft 应触发 onPrev');

        // 在 input 内按方向键 → 不触发（BUG-005）
        const input = document.createElement('input');
        document.body.appendChild(input);
        press(input, 'ArrowRight');
        assertEqual(nextCount, 1, 'input 内 ArrowRight 不应触发 onNext（BUG-005）');
        press(input, 'ArrowLeft');
        assertEqual(prevCount, 1, 'input 内 ArrowLeft 不应触发 onPrev（BUG-005）');

        // 在 textarea 内按方向键 → 不触发
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        press(textarea, 'ArrowRight');
        assertEqual(nextCount, 1, 'textarea 内 ArrowRight 不应触发 onNext（BUG-005）');

        // 回到普通元素 → 恢复触发
        press(div, 'ArrowRight');
        assertEqual(nextCount, 2, '离开 input 后 ArrowRight 恢复触发');

        document.body.removeChild(div);
        document.body.removeChild(input);
        document.body.removeChild(textarea);
        detach();
    });

    it('BUG-005c: S=触摸滑动 A=超阈值 → R=按方向切题（修复后）', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        let leftCount = 0, rightCount = 0, upCount = 0, downCount = 0;
        const detach = attachSwipeGestures(el, {
            onLeft: () => { leftCount++; },
            onRight: () => { rightCount++; },
            onUp: () => { upCount++; },
            onDown: () => { downCount++; },
        });

        // 左滑：start(200,100) → move(150,100) 触发检测 → end(120,102) dx=-80
        fireTouch(el, [
            { clientX: 200, clientY: 100 },
            { clientX: 150, clientY: 100 },
            { clientX: 120, clientY: 102 },
        ]);
        assertEqual(leftCount, 1, '左滑应触发 onLeft');

        // 右滑：start(100,100) → move(150,100) → end(180,101) dx=+80
        fireTouch(el, [
            { clientX: 100, clientY: 100 },
            { clientX: 150, clientY: 100 },
            { clientX: 180, clientY: 101 },
        ]);
        assertEqual(rightCount, 1, '右滑应触发 onRight');

        // 上滑：start(100,200) → move(100,150) → end(102,100) dy=-100
        fireTouch(el, [
            { clientX: 100, clientY: 200 },
            { clientX: 100, clientY: 150 },
            { clientX: 102, clientY: 100 },
        ]);
        assertEqual(upCount, 1, '上滑应触发 onUp');

        // 下滑：start(100,100) → move(100,150) → end(101,200) dy=+100
        fireTouch(el, [
            { clientX: 100, clientY: 100 },
            { clientX: 100, clientY: 150 },
            { clientX: 101, clientY: 200 },
        ]);
        assertEqual(downCount, 1, '下滑应触发 onDown');

        // 不足阈值不触发：start(100,100) → move(115,100) → end(130,100) dx=30 < 50
        fireTouch(el, [
            { clientX: 100, clientY: 100 },
            { clientX: 115, clientY: 100 },
            { clientX: 130, clientY: 100 },
        ]);
        assertEqual(rightCount, 1, '不足阈值不应触发');

        detach();
        document.body.removeChild(el);
    });

    it('BUG-006: S=同内容二次导入 A=create → R=DUPLICATE 且序号保留（修复后）', () => {
        const qs = [
            { id: 5, type: 'single', question: '题5', options: ['A', 'B'], answer: 'A', explanation: '' },
            { id: 6, type: 'single', question: '题6', options: ['A', 'B'], answer: 'A', explanation: '' },
        ];

        // 第一次导入
        const r1 = LX.IOAPI.importLibrary('bug6-1', qs);
        assertOk(r1);

        // 验证序号保留（id 应为 5、6，不是 1、2）
        const lib1 = LX.LibraryAPI.get(r1.data.id).data;
        assertEqual(lib1.questions[0].id, 5, '原始 id=5 应保留');
        assertEqual(lib1.questions[1].id, 6, '原始 id=6 应保留');
        assertEqual(lib1.questions[0].uid, 1, 'uid 应为内部 1');

        // 第二次导入相同内容 → DUPLICATE
        const r2 = LX.IOAPI.importLibrary('bug6-2', qs);
        assertErr(r2, 'DUPLICATE', '同内容二次导入应触发 DUPLICATE');

        // 跳过去重检测可成功
        const r3 = LX.IOAPI.importLibrary('bug6-3', qs, { skipDuplicateCheck: true });
        assertOk(r3);
    });

    // =========================================================================
    // 真实题库兼容性 BUG-007 ~ BUG-010
    // =========================================================================
    function buildWorkbook(sheets) {
        const wb = { SheetNames: Object.keys(sheets), Sheets: {} };
        for (const name in sheets) {
            wb.Sheets[name] = window.XLSX.utils.aoa_to_sheet(sheets[name]);
        }
        return wb;
    }

    it('BUG-007: S=选项分列 Excel A=解析 → R=合并为 options（修复后）', () => {
        // 修复前：只取第一列选项，BCD 丢失 → 判定为 essay
        // 修复后：检测到「选项A」正则模式，按标签字母顺序收集所有选项列
        const wb = buildWorkbook({
            Sheet1: [
                ['序号', '题目', '选项A', '选项B', '选项C', '选项D', '正确答案'],
                [1, '第1题', '甲', '乙', '丙', '丁', 'C'],
                [2, '第2题', '一', '二', '三', '四', 'BD'],
            ],
        });
        const r = LX.IOAPI._coreParseExcelWorkbook(wb, window.XLSX);
        assertOk(r);
        const qs = r.data.questions;
        assertEqual(qs.length, 2, '应解析 2 题');
        assertEqual(qs[0].options.length, 4, 'Q1 选项应为 4 项（从选项A~D四列合并）');
        assertEqual(qs[0].type, 'single', 'Q1 单字母答案 → 推断 single');
        assertEqual(qs[0].options[2], '丙', 'Q1 选项 C=丙（按列顺序：甲/乙/丙/丁）');
        assertEqual(qs[0].answer, 'C');
        assertEqual(qs[1].type, 'multi', 'Q2 多字母答案 → 推断 multi');
        assertEqual(qs[1].answer, 'B,D', '多选字母排序规范化为 B,D');
    });

    it('BUG-008: S=无题型列 A=解析 → R=按答案推断题型（修复后）', () => {
        // 修复前：全当 essay，无法自动判分
        const wb = buildWorkbook({
            Sheet1: [
                ['序号', '题目', '选项', '答案'],
                [1, '单选1', 'A.一\nB.二\nC.三\nD.四', 'B'],
                [2, '多选2', 'A.壹\nB.贰\nC.叁\nD.肆', 'AC'],
                [3, '判断3', '', '对'],
                [4, '判断4', '', 'F'],
                [5, '主观5', '', '长解释内容'],
            ],
        });
        const r = LX.IOAPI._coreParseExcelWorkbook(wb, window.XLSX);
        assertOk(r);
        const qs = r.data.questions;
        assertEqual(qs[0].type, 'single', '答案 B → single');
        assertEqual(qs[1].type, 'multi', '答案 AC → multi');
        assertEqual(qs[2].type, 'judge', '答案 对 → judge');
        assertEqual(qs[3].type, 'judge', '答案 F → judge');
        assertEqual(qs[4].type, 'essay', '长文答案 → essay');
        assertEqual(qs[2].answer, '对', 'judge 规范化 对');
        assertEqual(qs[3].answer, '错', 'judge F 规范化为 错');
    });

    it('BUG-009: S=有类别列/仅 Sheet 名 A=解析 → R=分类正确（修复后）', () => {
        // 修复前：分类永远是"未分类"
        const wb = buildWorkbook({
            '网络安全': [
                ['序号', '题目', '题目类别', '答案'],
                [1, '题1', '研发安全', 'A'],
                [2, '题2', '研发安全', 'B'],
                [3, '题3', '隐私合规', 'C'],
            ],
        });
        const r = LX.IOAPI._coreParseExcelWorkbook(wb, window.XLSX);
        assertOk(r);
        const qs = r.data.questions;
        assertEqual(qs[0].category, '研发安全', '优先用"题目类别"列');
        assertEqual(qs[2].category, '隐私合规', '同 Sheet 内类别列不同');
        r.warnings; // no-op

        // 无类别列时，用 Sheet 名（非 Sheet\d+）
        const wb2 = buildWorkbook({
            '第1章 教育学': [
                ['序号', '题目', '答案'],
                [1, '题A', 'OK'],
            ],
        });
        const r2 = LX.IOAPI._coreParseExcelWorkbook(wb2, window.XLSX);
        assertOk(r2);
        assertEqual(r2.data.questions[0].category, '第1章 教育学', '无类别列时取 Sheet 名');
    });

    it('BUG-010: S=数字开头分类标题 A=解析 → R=不误判为数据行（修复后）', () => {
        // 修复前：parseInt("2027安徽xxx",10) === 2027 有限 → isPotentialDataRow=true
        //        → 被当数据行处理，但空题 → 分类丢失
        // 修复后：要求整列严格匹配 ^-?\d+$ 才认为是数据行
        const wb = buildWorkbook({
            Sheet1: [
                ['2027安徽教育学主观题"背书"计划表'],
                ['序号', '题目', '口诀'],
                [1, '第1章第1题', '口诀1'],
                [2, '第1章第2题', '口诀2'],
                ['2027安徽小三门主观题"背书"计划表'],
                ['序号', '题目', '口诀'],
                [1, '第2章第1题', '口诀3'],
                ['2027安徽心理学主观题"背书"计划表'],
                ['序号', '题目', '口诀'],
                [1, '第3章第1题', '口诀4'],
                [2, '第3章第2题', '口诀5'],
            ],
        });
        const r = LX.IOAPI._coreParseExcelWorkbook(wb, window.XLSX);
        assertOk(r);
        const qs = r.data.questions;
        assertEqual(qs.length, 5, '应跨 3 个标题共提取 5 题');
        assertEqual(qs[0].category.includes('教育学'), true, 'Q1 应属教育学标题');
        assertEqual(qs[0].id, 1, 'Q1 id = 1');
        assertEqual(qs[2].category.includes('小三门'), true, 'Q3 应属小三门标题');
        assertEqual(qs[2].id, 1, '跨章节重置为 id=1');
        assertEqual(qs[3].category.includes('心理学'), true, 'Q4 属心理学');
        assertEqual(qs[4].category.includes('心理学'), true, 'Q5 属心理学');
    });

    it('BUG-011: S=数据行含关键词 A=解析 → R=不误判重复表头（修复后）', () => {
        // 背书计划表每一行的第 3 列就是「口诀」，单元格通常以"口诀1/口诀2"命名
        // isHeaderLike 使用 includes('口诀') 匹配，修复前即便 id=1/2/... 纯数字，
        // 也会因为「口诀1」单元格含关键词 → isHeaderLike=true → continue，整表被清 0
        // 修复后：只有 !isPotentialDataRow(row, colMap) 时才走 isHeaderLike 分支
        const wb = buildWorkbook({
            Sheet1: [
                ['序号', '题目', '口诀', '解析'],
                [1, '题A 解析本题考查的要点', '口诀1：快速记忆', '答案为B的解释'],
                [2, '题B 答案是关键点', '口诀2：另一记忆', '答案解析详细'],
            ],
        });
        const r = LX.IOAPI._coreParseExcelWorkbook(wb, window.XLSX);
        assertOk(r);
        const qs = r.data.questions;
        assertEqual(qs.length, 2, '应解析 2 题，数据行因「口诀/解析/答案」关键词被丢弃是 bug');
        assertEqual(qs[0].mnemonic, '口诀1：快速记忆', '口诀单元格应完整保留');
        assertTrue(qs[0].question.includes('本题考查'), '题目内容不被截断');
    });
});
