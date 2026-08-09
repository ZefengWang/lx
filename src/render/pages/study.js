/**
 * study.js — 答题页（核心）
 * 数据流：LX.QuestionAPI.get(currentUid) → 渲染卡片 → 用户答题 → LX.QuestionAPI.answer → 重渲染
 * @module render/pages/study
 */

import { h, render } from '../dom.js';
import { renderQuestionCard, renderFeedback } from '../card.js';
import { toastSuccess, toastWarning, toastInfo } from '../toast.js';
import {
    attachSwipeGestures,
    attachKeyboardGuard,
    attachBackGuard,
    confirmLeaveIfDirty,
} from '../gestures.js';

/**
 * 答题页本地视图状态（仅 UI 用，不污染 LX 核心）
 * 之所以放在 render 层而不是 core/state.js，是因为这些是瞬时视觉状态
 */
const viewState = {
    selectedAnswers: new Map(), // uid -> 'A' | ['A','B'] | '对' | 'text'
    revealed: new Set(),         // uid set：已交卷显示答案
    essayExpanded: new Set(),   // uid set：简答题展开
    essayActiveTab: new Map(),   // uid -> 'answerText' | 'explanation' | 'mnemonic'
    // essay 判分结果（提交时由 QuestionAPI.answer 算出，复用给反馈渲染）
    //   形如： { correct, notGraded, similarity, correctAnswer }
    essayResults: new Map(),
    // essay「答案」Tab 是否处于 inline 编辑：uid set
    answerTextEditing: new Set(),
    // 分类选择下拉是否展开（练习设置工具条）
    categoryPickerOpen: false,
    // 未提交的填空/简答草稿：uid -> { type, value }
    // 用于 BACK 守护：避免误操作丢失已输入但未交卷的答案
    pendingDrafts: new Map(),
};

/**
 * 创建答题页
 * @returns {{render: (container: HTMLElement) => void, onLeave?: () => void}}
 */
export function createStudyPage() {
    let _container = null;
    let _unsubscribe = null;
    let _detachSwipe = null;
    let _detachKeyboard = null;
    let _detachBackGuard = null;

    function renderPage(container) {
        _container = container;

        // 监听导航变化，重渲染
        const LX = window.LX;
        if (!_unsubscribe) {
            _unsubscribe = LX.on(LX.Events.NAVIGATION_CHANGED, () => {
                if (_container) refreshCard();
                refreshBottombarStatus();
            });
            LX.on(LX.Events.QUESTION_STATUS_CHANGED, () => {
                if (_container) refreshCard();
            });
            LX.on(LX.Events.LIBRARY_SWITCHED, () => {
                viewState.selectedAnswers.clear();
                viewState.revealed.clear();
                viewState.essayExpanded.clear();
                viewState.pendingDrafts.clear();
                if (_container) refreshCard();
            });
            LX.on(LX.Events.WRONGBOOK_EXITED, () => {
                if (_container) refreshCard();
            });
        }

        refreshCard();

        // 绑定手势 / 键盘守护 / BACK 守护（重复进入只绑一次）
        if (!_detachSwipe && _container) {
            _detachSwipe = attachSwipeGestures(_container, {
                onLeft: () => goNext(),
                onRight: () => goPrev(),
                onUp: () => markMastered(),
                onDown: () => markWrong(),
            });
        }
        if (!_detachKeyboard) {
            _detachKeyboard = attachKeyboardGuard({
                onPrev: () => goPrev(),
                onNext: () => goNext(),
            });
        }
        if (!_detachBackGuard) {
            _detachBackGuard = attachBackGuard(() => viewState.pendingDrafts.size > 0);
        }
    }

    /**
     * 切到下一题（先尝试提交草稿）
     */
    function goNext() {
        commitPendingIfAny();
        window.LX.NavigationAPI.next();
    }

    /**
     * 切到上一题（先尝试提交草稿）
     */
    function goPrev() {
        commitPendingIfAny();
        window.LX.NavigationAPI.prev();
    }

    /**
     * 标记当前题为已掌握
     */
    function markMastered() {
        const LX = window.LX;
        const nav = LX.NavigationAPI.current().data;
        if (!nav?.qId) return;
        const q = LX.QuestionAPI.get(nav.qId).data;
        if (!q) return;
        const r = LX.ProgressAPI.setStatus(q, 'mastered');
        if (r.ok) toastSuccess('标记为已掌握');
    }

    /**
     * 加入错题
     */
    function markWrong() {
        const LX = window.LX;
        const nav = LX.NavigationAPI.current().data;
        if (!nav?.qId) return;
        const q = LX.QuestionAPI.get(nav.qId).data;
        if (!q) return;
        const r = LX.ProgressAPI.setStatus(q, 'review');
        if (r.ok) toastWarning('加入错题');
    }

    /**
     * 提交当前题的草稿（填空/简答）
     * 填空题可判分；简答题仅记录
     */
    function commitPendingIfAny() {
        const LX = window.LX;
        const nav = LX.NavigationAPI.current().data;
        if (!nav?.qId) return;
        const q = LX.QuestionAPI.get(nav.qId).data;
        if (!q) return;
        const draft = viewState.pendingDrafts.get(q.uid);
        if (draft == null) return;
        // 提交到核心层
        const r = LX.QuestionAPI.answer(q.uid, draft.value);
        if (r.ok) {
            viewState.revealed.add(q.uid);
        }
        viewState.pendingDrafts.delete(q.uid);
    }

    /**
     * 练习设置工具条
     *   - 分类选择器（点击展开下拉，列出当前题库的所有分类）
     *   - 顺序 / 随机 模式切换
     *   - 随机模式下显示「🎴 换一批」（重新洗牌）
     *
     * 后端：NavigationAPI.setCategory / setMode / shuffle / listCategories / getMode / getCategory
     * 切换后会 emit NAVIGATION_CHANGED，study.js 已监听 → 自动 refreshCard
     */
    function renderStudyToolbar() {
        const LX = window.LX;
        const mode = LX.NavigationAPI.getMode();           // 'sequential' | 'random'
        const category = LX.NavigationAPI.getCategory();   // 'all' | 分类名
        const catsR = LX.NavigationAPI.listCategories();
        const cats = (catsR && catsR.ok && catsR.data) ? catsR.data : [];
        const isRandom = mode === 'random';
        const categoryLabel = category === 'all' ? '全部分类' : category;
        const pickerOpen = viewState.categoryPickerOpen;

        const btn = (text, onClick, opts = {}) =>
            h('button', {
                class: `lx-toolbar__btn${opts.active ? ' lx-toolbar__btn--active' : ''}`,
                type: 'button',
                onclick: onClick,
                'aria-pressed': opts.active ? 'true' : 'false',
            }, [text]);

        const children = [
            btn(`📁 ${categoryLabel} ▾`, () => {
                viewState.categoryPickerOpen = !viewState.categoryPickerOpen;
                refreshCard();
            }, { active: category !== 'all' }),
            btn(isRandom ? '🔀 随机' : '➡️ 顺序', () => {
                LX.NavigationAPI.setMode(isRandom ? 'sequential' : 'random');
                viewState.categoryPickerOpen = false;
                toastInfo(isRandom ? '已切换为顺序模式' : '已切换为随机模式（已洗牌）');
            }, { active: isRandom }),
        ];
        if (isRandom) {
            children.push(btn('🎴 换一批', () => {
                LX.NavigationAPI.shuffle();
                toastInfo('已重新洗牌');
            }));
        }

        // 分类下拉（展开时显示）
        if (pickerOpen) {
            const options = [
                h('button', {
                    class: `lx-toolbar__option${category === 'all' ? ' lx-toolbar__option--active' : ''}`,
                    type: 'button',
                    onclick: () => {
                        LX.NavigationAPI.setCategory('all');
                        viewState.categoryPickerOpen = false;
                        toastInfo('已显示全部分类');
                    },
                }, ['📁 全部分类']),
                ...cats.map((cat) => h('button', {
                    class: `lx-toolbar__option${category === cat ? ' lx-toolbar__option--active' : ''}`,
                    type: 'button',
                    onclick: () => {
                        LX.NavigationAPI.setCategory(cat);
                        viewState.categoryPickerOpen = false;
                        toastInfo(`已切换到分类：${cat}`);
                    },
                }, [`📁 ${cat}`])),
            ];
            children.push(h('div', { class: 'lx-toolbar__dropdown' }, options));
        }

        return h('div', { class: 'lx-study-toolbar' }, children);
    }

    function refreshCard() {
        const LX = window.LX;
        if (!_container) return;

        // 1. 检查是否有当前题库
        const currentLibId = LX.LibraryAPI.current().data;
        if (!currentLibId) {
            render(_container, [renderEmptyLibrary()]);
            return;
        }

        // 2. 取当前导航题目
        const navR = LX.NavigationAPI.current();
        if (!navR.ok) {
            render(_container, [renderNoQuestion()]);
            return;
        }
        const nav = navR.data;
        // NavigationAPI.current() 返回 { index, qId, total }；qId 即题目 uid
        if (!nav || !nav.qId) {
            render(_container, [renderNoQuestion()]);
            return;
        }

        // 3. 取题目内容
        const qR = LX.QuestionAPI.get(nav.qId);
        if (!qR.ok) {
            render(_container, [renderNoQuestion()]);
            return;
        }
        const q = qR.data;

        // 4. 取当前状态
        const statusR = LX.ProgressAPI.getStatus(q);
        const status = statusR.ok ? statusR.data : 'pending';

        // 5. 渲染卡片
        const ctx = {
            currentStatus: status,
            selectedAnswer: viewState.selectedAnswers.get(q.uid) || (q.type === 'multi' ? [] : ''),
            revealed: viewState.revealed.has(q.uid),
            essayExpanded: viewState.essayExpanded.has(q.uid),
            essayActiveTab: viewState.essayActiveTab.get(q.uid) || 'answerText',
            answerTextEditing: viewState.answerTextEditing,
            onAnswer: (qq, answer, opts = {}) => handleAnswer(qq, answer, opts),
            onToggleStatus: (qq, current) => handleToggleStatus(qq, current),
            onToggleEssay: (qq) => handleToggleEssay(qq),
            onSwitchEssayTab: (qq, tab) => handleSwitchEssayTab(qq, tab),
            onStartEditAnswer: (qq) => {
                viewState.answerTextEditing.add(qq.uid);
                refreshCard();
            },
            onCancelEditAnswer: (qq) => {
                viewState.answerTextEditing.delete(qq.uid);
                refreshCard();
            },
            onSaveAnswerText: (qq, text) => handleSaveAnswerText(qq, text),
        };

        const card = renderQuestionCard(q, ctx);

        // 6. 练习设置工具条（分类筛选 + 顺序/随机 + 换一批）
        //    放卡片上方，进入答题页第一眼可见当前练习范围与模式
        const toolbar = renderStudyToolbar();

        // 7. 已交卷时附加反馈
        //   - 单选/多选/判断/填空：直接判分
        //   - 简答：仅当题目设置了参考答案（有 answerText）时才判分；
        //     未设置参考答案的简答（notGraded=true）只提示用户自行对比，不打对错红绿
        const elements = [toolbar, card];
        if (viewState.revealed.has(q.uid)) {
            if (q.type === 'essay') {
                const r = viewState.essayResults.get(q.uid);
                if (r && r.notGraded) {
                    // 未设置参考答案 → 不打对错，只提示"自判"
                    elements.push(renderFeedback(null, '', q.explanation, { neutral: true, neutralMsg: '已记录答案，暂未设置参考答案，由老师/自行判定 ✍️' }));
                } else if (r) {
                    const simText = typeof r.similarity === 'number' ? `（相似度 ${Math.round(r.similarity * 100)}%）` : '';
                    elements.push(renderFeedback(r.correct, r.correctAnswer || '', `${q.explanation || ''}${simText ? ` ${simText}` : ''}`));
                }
            } else {
                const correctAnswer = q.answer || '';
                const userAnswer = viewState.selectedAnswers.get(q.uid);
                const correct = checkAnswer(q, userAnswer, correctAnswer);
                elements.push(renderFeedback(correct, correctAnswer, q.explanation));
            }
        }

        render(_container, elements);

        // 7. 更新底栏状态
        refreshBottombarStatus();
    }

    function handleAnswer(q, answer, opts = {}) {
        const LX = window.LX;

        // 多选：累积选择；commit 时统一提交数组
        if (q.type === 'multi') {
            const current = viewState.selectedAnswers.get(q.uid) || [];
            let next;
            if (opts.commit === true) {
                // 用户点「确认答案」按钮，answer 已是数组
                next = Array.isArray(answer) ? [...answer].sort() : current;
                viewState.selectedAnswers.set(q.uid, next);
                // 真正提交判分
                const r = LX.QuestionAPI.answer(q.uid, next);
                if (r.ok) {
                    viewState.revealed.add(q.uid);
                    const data = r.data;
                    if (data.correct) {
                        toastSuccess('✓ 正确');
                    } else {
                        toastWarning(`✗ 正确答案：${data.correctAnswer}`);
                    }
                } else {
                    toastWarning(r.error?.message || '答题失败');
                }
                refreshCard();
                return;
            }
            // 单击某选项：toggle
            next = Array.isArray(current)
                ? (current.includes(answer) ? current.filter((x) => x !== answer) : [...current, answer].sort())
                : [answer];
            viewState.selectedAnswers.set(q.uid, next);
            refreshCard();
            return;
        }

        // 填空/简答：记录到 selectedAnswers + 草稿
        viewState.selectedAnswers.set(q.uid, answer);

        if (opts.pending) {
            // oninput：仅存草稿，不立即交卷（标记 dirty 给 BACK 守护用）
            viewState.pendingDrafts.set(q.uid, { type: q.type, value: answer });
            // pending 不需要 refreshCard（输入框已经显示用户输入了，避免刷新打断输入法）
            return;
        }

        // essay 类型：调用核心判分（有 answerText → 模糊判分；无 answerText → 返回 notGraded=true，不自动改掌握/错题状态）
        if (q.type === 'essay') {
            viewState.revealed.add(q.uid);
            viewState.essayExpanded.add(q.uid);
            viewState.pendingDrafts.delete(q.uid);
            const r = LX.QuestionAPI.answer(q.uid, answer);
            if (r.ok) {
                viewState.essayResults.set(q.uid, {
                    correct: r.data.correct,
                    notGraded: r.data.notGraded,
                    similarity: r.data.similarity,
                    correctAnswer: r.data.correctAnswer || (q.answerText || ''),
                });
                if (r.data.notGraded) {
                    toastInfo('已记录答案，暂未设置参考答案，由您自行判定 ✍️');
                } else if (r.data.correct) {
                    toastSuccess(`✓ 答案匹配（相似度 ${Math.round((r.data.similarity || 0) * 100)}%）`);
                } else {
                    toastWarning(`✗ 相似度 ${Math.round((r.data.similarity || 0) * 100)}%，建议对照参考答案补充`);
                }
            } else {
                toastWarning(r.error?.message || '答题失败');
            }
            refreshCard();
            return;
        }

        // 填空：commit === true 或非 pending → 调核心层判分
        const r = LX.QuestionAPI.answer(q.uid, answer);
        if (r.ok) {
            viewState.revealed.add(q.uid);
            viewState.pendingDrafts.delete(q.uid);
            const data = r.data;
            if (data.correct) {
                toastSuccess('✓ 正确');
            } else if (data.autoStatus === 'review') {
                toastWarning(`✗ 已加入错题（正确答案：${data.correctAnswer}）`);
            } else {
                toastWarning(`✗ 正确答案：${data.correctAnswer}`);
            }
        } else {
            if (q.type === 'fill') {
                viewState.pendingDrafts.delete(q.uid);
                toastSuccess('已记录答案');
            } else {
                toastWarning(r.error?.message || '答题失败');
            }
        }

        refreshCard();
    }

    function handleToggleStatus(q, current) {
        const LX = window.LX;
        // 循环：pending → mastered → review → pending
        const next = current === 'pending' ? 'mastered'
                   : current === 'mastered' ? 'review'
                   : 'pending';
        const r = LX.ProgressAPI.setStatus(q, next);
        if (r.ok) {
            if (next === 'mastered') toastSuccess('标记为已掌握');
            else if (next === 'review') toastWarning('标记为错题');
        }
        refreshCard();
    }

    function handleToggleEssay(q) {
        if (viewState.essayExpanded.has(q.uid)) {
            viewState.essayExpanded.delete(q.uid);
        } else {
            viewState.essayExpanded.add(q.uid);
        }
        refreshCard();
    }

    function handleSwitchEssayTab(q, tab) {
        viewState.essayActiveTab.set(q.uid, tab);
        refreshCard();
    }

    /**
     * 保存简答题「参考答案 answerText」
     *   - 无参考答：清空后自动进入 notGraded 模式（不打掌握/错题）
     *   - 有参考答：下次答题时按 bigram 阈值 0.5 判分
     *   - 保存完顺便刷新当前题（已交卷则重新判分一次）
     */
    function handleSaveAnswerText(q, text) {
        const LX = window.LX;
        const nextText = String(text || '').trim();
        const r = LX.QuestionAPI.update(q.uid, { answerText: nextText });
        if (!r.ok) {
            toastWarning(r.error?.message || '保存参考答案失败');
            return;
        }
        viewState.answerTextEditing.delete(q.uid);
        toastSuccess(nextText ? '参考答案已保存' : '参考答案已清空，后续该题将不自动判分');

        // 已提交的简答题：重新判分一次（使用新的 answerText）
        if (viewState.revealed.has(q.uid)) {
            const userAnswer = viewState.selectedAnswers.get(q.uid);
            if (userAnswer != null) {
                const ar = LX.QuestionAPI.answer(q.uid, userAnswer);
                if (ar.ok) {
                    viewState.essayResults.set(q.uid, {
                        correct: ar.data.correct,
                        notGraded: ar.data.notGraded,
                        similarity: ar.data.similarity,
                        correctAnswer: ar.data.correctAnswer || nextText,
                    });
                }
            }
        }
        refreshCard();
    }

    function refreshBottombarStatus() {
        // 由 main-ui 统一更新底栏，这里只负责卡片
        // （避免双重渲染冲突）
    }

    return {
        render: renderPage,
        onLeave() {
            // 应用内路由离开的 BACK 守护：若有未提交草稿，提示确认
            // 浏览器级的关闭/刷新由 attachBackGuard 的 beforeunload 兜底
            if (!confirmLeaveIfDirty(() => viewState.pendingDrafts.size > 0)) {
                // 用户取消 → 重新渲染当前页（保留草稿）
                // 但路由已经切换，需把 hash 推回 study
                if (location.hash !== '#/study') {
                    location.hash = '#/study';
                }
                return;
            }
            // 解绑手势/键盘/BACK 守护（下次进入会重新绑定）
            // 但保留事件总线订阅，避免重复绑定的开销
            if (_detachSwipe) { _detachSwipe(); _detachSwipe = null; }
            if (_detachKeyboard) { _detachKeyboard(); _detachKeyboard = null; }
            if (_detachBackGuard) { _detachBackGuard(); _detachBackGuard = null; }
        },
    };
}

/**
 * 检查答案是否正确（仅用于显示反馈）
 * 注意：core 层 QuestionAPI.answer 才是权威判分；这里只是 UI 层快速反馈
 */
function checkAnswer(q, userAnswer, correctAnswer) {
    if (q.type === 'multi') {
        if (!Array.isArray(userAnswer)) return false;
        const ua = [...userAnswer].map(x => String(x).trim().toUpperCase()).sort().join(',');
        const ca = String(correctAnswer || '')
            .split(/[,，;；]/).map(s => s.trim().toUpperCase()).filter(Boolean).sort().join(',');
        return ua === ca && ua !== '';
    }
    if (q.type === 'judge' || q.type === 'single') {
        return String(userAnswer).trim().toUpperCase() === String(correctAnswer).trim().toUpperCase();
    }
    if (q.type === 'fill') {
        return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
    }
    // essay：不判分
    return false;
}

/**
 * 空题库占位
 */
function renderEmptyLibrary() {
    return h('div', { class: 'lx-empty' }, [
        h('div', { class: 'lx-empty__icon' }, ['📚']),
        h('div', { class: 'lx-empty__title' }, ['还没有题库']),
        h('div', { class: 'lx-empty__desc' }, ['点击左上角 ☰ 上传第一个题库开始学习']),
        h('button', {
            class: 'lx-button lx-button--primary',
            style: { marginTop: '16px' },
            onclick: () => {
                // 触发抽屉打开
                document.dispatchEvent(new CustomEvent('lx:open-drawer'));
            },
        }, ['＋ 上传题库']),
    ]);
}

/**
 * 无题目占位
 */
function renderNoQuestion() {
    const LX = window.LX;
    const navR = LX.NavigationAPI.current();
    // NavigationAPI.current() 返回 { index, qId, total }；用 qId 判空（修复 BUG：原用 uid）
    const isEmpty = !navR.ok || !navR.data || !navR.data.qId || navR.data.total === 0;

    return h('div', { class: 'lx-empty' }, [
        h('div', { class: 'lx-empty__icon' }, [isEmpty ? '📭' : '🔚']),
        h('div', { class: 'lx-empty__title' }, [isEmpty ? '当前题库为空' : '已学完所有题目']),
        h('div', { class: 'lx-empty__desc' }, [
            isEmpty ? '请重新导入或选择其他题库' : '太棒了！可以切换题库或重置进度从头再来',
        ]),
        !isEmpty && h('button', {
            class: 'lx-button lx-button--primary',
            style: { marginTop: '16px' },
            onclick: () => {
                // 修复 BUG：原调用不存在的 NavigationAPI.first()，应用 goto(0)
                LX.NavigationAPI.goto(0);
            },
        }, ['回到第 1 题']),
    ]);
}
