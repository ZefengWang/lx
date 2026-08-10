/**
 * wrongbook.js — 错题本（专注模式）
 * 进入后 NavigationAPI 自动只看错题；全部掌握后自动退出 + 庆祝
 * 来源：DESIGN.md 8.2
 * @module render/pages/wrongbook
 */

import { h, render } from '../dom.js';
import { renderQuestionCard, renderFeedback } from '../card.js';
import { toastSuccess, toastInfo, toastWarning } from '../toast.js';
import { navigate } from '../router.js';
import { bindEvents } from '../bind.js';
import { attachSwipeGestures, attachKeyboardGuard } from '../gestures.js';
import { markMasteredInWrongBook, onWrongBookGraded } from '../contracts/wrongbook-flow.js';
import { getState } from '../../core/state.js';

function getWrongBookActive() {
    try {
        return !!getState().isWrongBookMode;
    } catch (_) {
        return false;
    }
}

export function createWrongBookPage() {
    let _container = null;
    let _unbind = null;
    let _detachSwipe = null;
    let _detachKeyboard = null;
    /** 庆祝页锁定：一旦渲染 .lx-celebrate，后续 refresh / NAV / STATUS 必须 no-op，直到 onLeave */
    let _celebrateActive = false;
    let _localState = {
        revealed: new Set(),
        selectedAnswers: new Map(),
    };

    function renderPage(container) {
        _container = container;
        _celebrateActive = false;

        const LX = window.LX;
        // 进入错题本
        const enterR = LX.WrongBookAPI.enter();
        if (!enterR.ok) {
            render(_container, [renderEmpty(enterR.error)]);
            return;
        }

        // 监听退出（全部掌握会自动退出）+ 导航/状态变化刷新
        _unbind = bindEvents({
            [LX.Events.WRONGBOOK_EXITED]: (payload) => {
                _celebrateActive = true;
                render(_container, [renderCelebration(payload)]);
            },
            [LX.Events.WRONGBOOK_MARKED]: (payload) => {
                // markMastered 完成后的显式通知：无论 remaining 是否为 0，
                // 都必须刷新 UI（用户的核心诉求：按钮 → API → 发通知 → UI 更新）
                if (_celebrateActive) return; // 庆祝页已渲染，勿覆盖
                refresh();
            },
            [LX.Events.NAVIGATION_CHANGED]: () => {
                // 庆祝锁定 或 已退出错题模式 → 勿 refresh 盖掉庆祝页
                if (_celebrateActive || !window.LX || !getWrongBookActive()) return;
                refresh();
            },
            [LX.Events.QUESTION_STATUS_CHANGED]: (payload) => {
                // 新错题加入时清除庆祝锁定（用户在庆祝页时又产生了新错题）
                if (payload?.newStatus === 'review') {
                    _celebrateActive = false;
                }
                if (_celebrateActive || !window.LX || !getWrongBookActive()) return;
                refresh();
            },
        });

        // 绑定手势 + 键盘守护（错题本模式：左滑下一题，上滑标记掌握）
        if (!_detachSwipe && _container) {
            _detachSwipe = attachSwipeGestures(_container, {
                onLeft: () => LX.NavigationAPI.next(),
                onRight: () => LX.NavigationAPI.prev(),
                onUp: () => {
                    const nav = LX.NavigationAPI.current().data;
                    if (nav?.qId) {
                        const q = LX.QuestionAPI.get(nav.qId).data;
                        if (q) handleMastered(q);
                    }
                },
            });
        }
        if (!_detachKeyboard) {
            _detachKeyboard = attachKeyboardGuard({
                onPrev: () => LX.NavigationAPI.prev(),
                onNext: () => LX.NavigationAPI.next(),
            });
        }

        refresh();
    }

    function refresh() {
        if (!_container || _celebrateActive) return;
        const LX = window.LX;

        const navR = LX.NavigationAPI.current();
        if (!navR.ok || !navR.data || !navR.data.qId) {
            render(_container, [renderEmpty({ code: 'NO_WRONG' })]);
            return;
        }

        const qR = LX.QuestionAPI.get(navR.data.qId);
        if (!qR.ok) {
            render(_container, [renderEmpty({ message: '题目获取失败' })]);
            return;
        }
        const q = qR.data;
        const total = LX.WrongBookAPI.count ? (LX.WrongBookAPI.count().data || 0) : 0;

        const header = h('div', { class: 'lx-card', style: { marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', {}, [
                h('div', { class: 'lx-text-base lx-font-semibold' }, ['📕 错题专注模式']),
                h('div', { class: 'lx-text-sm lx-text-muted' }, [`剩余 ${total} 道错题`]),
            ]),
            h('button', {
                class: 'lx-button lx-button--ghost',
                onclick: () => {
                    LX.WrongBookAPI.exit();
                    navigate('home');
                },
            }, ['退出']),
        ]);

        const card = renderQuestionCard(q, {
            currentStatus: 'review',
            selectedAnswer: _localState.selectedAnswers.get(q.uid) || (q.type === 'multi' ? [] : ''),
            revealed: _localState.revealed.has(q.uid),
            essayExpanded: true,
            onAnswer: (qq, ans, opts = {}) => handleAnswer(qq, ans, opts),
            onToggleStatus: () => handleMastered(q),
            onToggleEssay: () => {},
            onSwitchEssayTab: () => {},
        });

        const elements = [header, card];

        if (_localState.revealed.has(q.uid)) {
            const userAns = _localState.selectedAnswers.get(q.uid);
            const correct = String(userAns) === String(q.answer);
            elements.push(renderFeedback(correct, q.answer || '', q.explanation));
        }

        // 底部：标记掌握 + 下一题
        elements.push(h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } }, [
            h('button', {
                class: 'lx-button lx-button--success lx-button--block',
                onclick: () => handleMastered(q),
            }, ['✓ 我已掌握']),
            h('button', {
                class: 'lx-button lx-button--secondary lx-button--block',
                onclick: () => LX.NavigationAPI.next(),
            }, ['下一题 ▶']),
        ]));

        render(_container, elements);
    }

    function handleAnswer(q, answer, opts = {}) {
        const LX = window.LX;

        // —— 多选：先逐次 toggle 勾选，{ commit:true } 时整卷提交判分（对齐 study.js 模式）
        if (q.type === 'multi') {
            const current = _localState.selectedAnswers.get(q.uid) || [];
            let next;

            if (opts.commit === true) {
                // 用户点了「确认答案」：answer 已是已选数组
                next = Array.isArray(answer) ? [...answer].sort() : current;
                _localState.selectedAnswers.set(q.uid, next);

                // Reveal + 判分（传 question 对象，见 CONTRACT-api.md §2.2）
                // 答对收尾必须走方案 B：WrongBookAPI.markMastered（见 wrongbook-flow.js）
                const r = LX.QuestionAPI.answer(q, next);
                if (r.ok) {
                    _localState.revealed.add(q.uid);
                    if (r.data.correct) {
                        const fin = onWrongBookGraded(LX, q, r);
                        if (fin.mark && !fin.mark.ok) {
                            toastWarning(fin.mark.error?.message || '移出错题本失败');
                        } else {
                            toastSuccess(fin.cleared
                                ? '✓ 全部掌握！'
                                : '✓ 答对了，已从错题本移出');
                        }
                        if (fin.cleared) return; // 庆祝页已由 EXITED 渲染
                    } else {
                        toastWarning(`✗ 正确答案：${r.data.correctAnswer}`);
                    }
                } else {
                    toastWarning(r.error?.message || '答题失败');
                }
                refresh();
                return;
            }

            // 单击选项 → toggle
            next = Array.isArray(current)
                ? (current.includes(answer)
                    ? current.filter((x) => x !== answer)
                    : [...current, answer].sort())
                : [answer];
            _localState.selectedAnswers.set(q.uid, next);
            refresh();
            return;
        }

        // —— 单选/判断/填空/简答
        _localState.selectedAnswers.set(q.uid, answer);

        if (opts.pending) {
            // 填空/简答 oninput：只存草稿，不交卷
            return;
        }

        _localState.revealed.add(q.uid);
        const r = LX.QuestionAPI.answer(q, answer);
        if (r.ok && r.data.correct) {
            // 方案 B：答对 → markMastered（清完自动 exit + WRONGBOOK_CLEARED/EXITED → 庆祝页）
            const fin = onWrongBookGraded(LX, q, r);
            if (fin.mark && !fin.mark.ok) {
                toastWarning(fin.mark.error?.message || '移出错题本失败');
            } else {
                toastSuccess(fin.cleared ? '✓ 全部掌握！' : '✓ 答对了，已从错题本移出');
            }
            if (fin.cleared) return; // 勿 refresh 覆盖庆祝页
        } else if (r.ok && !r.data.correct) {
            toastWarning(`✗ 正确答案：${r.data.correctAnswer}`);
        } else if (!r.ok) {
            toastWarning(r.error?.message || '答题失败');
        }
        refresh();
    }

    function handleMastered(q) {
        const LX = window.LX;
        // 方案 B：必须 markMastered，不能只用 ProgressAPI.setStatus
        const r = markMasteredInWrongBook(LX, q);
        if (r.ok) {
            if (r.data.cleared) {
                toastSuccess('全部掌握！');
                // 已自动 exit，庆祝页由 WRONGBOOK_EXITED 订阅渲染
                // 安全网：如果 WRONGBOOK_EXITED 订阅者因某种原因没渲染庆祝页，
                // refresh() 会检查 _celebrateActive → 若已庆祝则 no-op，否则渲染空状态
                refresh();
                return;
            }
            toastSuccess('已掌握，从错题本移出');
            LX.NavigationAPI.next();
        } else {
            toastWarning(r.error?.message || '标记失败');
        }
        refresh();
    }

    function onLeave() {
        _celebrateActive = false;
        if (_unbind) { _unbind(); _unbind = null; }
        if (_detachSwipe) { _detachSwipe(); _detachSwipe = null; }
        if (_detachKeyboard) { _detachKeyboard(); _detachKeyboard = null; }
        const LX = window.LX;
        // 仅当导航离开 wrongbook 路由时才退出错题模式
        // 同路由重入时 location.hash 仍为 #/wrong，不应 exit → enter 来回折腾
        const newHash = location.hash || '#/';
        if (newHash !== '#/wrong') {
            try {
                LX.WrongBookAPI.exit();
            } catch (_) {}
        }
    }

    return { render: renderPage, onLeave };
}

function renderEmpty(err) {
    return h('div', { class: 'lx-empty' }, [
        h('div', { class: 'lx-empty__icon' }, ['🎉']),
        h('div', { class: 'lx-empty__title' }, ['没有错题']),
        h('div', { class: 'lx-empty__desc' }, ['继续保持，太棒了！']),
    ]);
}

function renderCelebration(payload) {
    return h('div', { class: 'lx-celebrate' }, [
        h('div', { class: 'lx-celebrate__emoji' }, ['🎊']),
        h('div', { class: 'lx-celebrate__title' }, ['全部掌握！']),
        h('div', { class: 'lx-celebrate__desc' }, [
            payload?.clearedAt ? `完成于 ${new Date(payload.clearedAt).toLocaleString()}` : '所有错题已攻克',
        ]),
        h('button', {
            class: 'lx-button lx-button--primary',
            style: { marginTop: '24px' },
            onclick: () => {
                location.hash = '#/';
            },
        }, ['回到首页']),
    ]);
}
