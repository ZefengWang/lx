/**
 * wrongbook.js — 错题本（专注模式）
 * 进入后 NavigationAPI 自动只看错题；全部掌握后自动退出 + 庆祝
 * 来源：DESIGN.md 8.2
 * @module render/pages/wrongbook
 */

import { h, render } from '../dom.js';
import { renderQuestionCard, renderFeedback } from '../card.js';
import { toastSuccess, toastInfo } from '../toast.js';
import { navigate } from '../router.js';
import { attachSwipeGestures, attachKeyboardGuard } from '../gestures.js';

export function createWrongBookPage() {
    let _container = null;
    let _subs = [];
    let _detachSwipe = null;
    let _detachKeyboard = null;
    let _localState = {
        revealed: new Set(),
        selectedAnswers: new Map(),
    };

    function renderPage(container) {
        _container = container;

        const LX = window.LX;
        // 进入错题本
        const enterR = LX.WrongBookAPI.enter();
        if (!enterR.ok) {
            render(_container, [renderEmpty(enterR.error)]);
            return;
        }

        // 监听退出（全部掌握会自动退出）
        _subs.push(LX.on(LX.Events.WRONGBOOK_EXITED, (payload) => {
            render(_container, [renderCelebration(payload)]);
        }));
        _subs.push(LX.on(LX.Events.NAVIGATION_CHANGED, () => refresh()));
        _subs.push(LX.on(LX.Events.QUESTION_STATUS_CHANGED, () => refresh()));

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
        if (!_container) return;
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
            onAnswer: (qq, ans) => handleAnswer(qq, ans),
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

    function handleAnswer(q, answer) {
        const LX = window.LX;
        if (q.type === 'multi') {
            const cur = _localState.selectedAnswers.get(q.uid) || [];
            const next = cur.includes(answer)
                ? cur.filter((x) => x !== answer)
                : [...cur, answer].sort();
            _localState.selectedAnswers.set(q.uid, next);
        } else {
            _localState.selectedAnswers.set(q.uid, answer);
            _localState.revealed.add(q.uid);
            const r = LX.QuestionAPI.answer(q.uid, answer);
            if (r.ok && r.data.correct) {
                toastSuccess('答对了，自动标记为已掌握');
                LX.ProgressAPI.setStatus(q, 'mastered');
            }
        }
        refresh();
    }

    function handleMastered(q) {
        const LX = window.LX;
        const r = LX.ProgressAPI.setStatus(q, 'mastered');
        if (r.ok) {
            toastSuccess('已掌握，从错题本移出');
            // 自动下一题
            const navR = LX.NavigationAPI.next();
            if (!navR.ok) {
                // 没有下一题了，可能是全部清空 → 等 WRONGBOOK_EXITED 事件触发庆祝
            }
        }
        refresh();
    }

    function onLeave() {
        _subs.forEach((off) => off && off());
        _subs = [];
        if (_detachSwipe) { _detachSwipe(); _detachSwipe = null; }
        if (_detachKeyboard) { _detachKeyboard(); _detachKeyboard = null; }
        const LX = window.LX;
        // 离开页面时退出错题模式
        try {
            LX.WrongBookAPI.exit();
        } catch (_) {}
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
