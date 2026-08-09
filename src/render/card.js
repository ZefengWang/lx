/**
 * card.js — 题目卡片渲染（按题型分发）
 * 支持：single（单选） / multi（多选） / judge（判断） / fill（填空） / essay（简答）
 * 来源：DESIGN.md 8.1 题型渲染
 * @module render/card
 */

import { h, escapeHtml } from './dom.js';

/**
 * 题型中文显示
 */
const TYPE_LABELS = {
    single: '单选题',
    multi: '多选题',
    judge: '判断题',
    fill: '填空题',
    essay: '简答题',
};

/** 状态徽章映射 */
const STATUS_BADGE = {
    mastered: { class: 'lx-status-badge--mastered', text: '✓ 已掌握' },
    review:   { class: 'lx-status-badge--review',   text: '📕 错题' },
    pending: { class: 'lx-status-badge--pending',  text: '⏳ 未开始' },
};

/**
 * 渲染整张题目卡片
 * @param {object} q 题目对象（含 uid/id/type/question/options/answer/explanation/mnemonic/category）
 * @param {object} ctx 状态上下文 { currentStatus, selectedAnswer, revealed, onAnswer, onToggleStatus }
 * @returns {HTMLElement}
 */
export function renderQuestionCard(q, ctx = {}) {
    const status = ctx.currentStatus || 'none';
    const cardClass = [
        'lx-card',
        status === 'mastered' && 'lx-card--mastered',
        status === 'review' && 'lx-card--review',
    ].filter(Boolean).join(' ');

    const badge = STATUS_BADGE[status] || STATUS_BADGE.pending;

    const header = h('div', { class: 'lx-card__header' }, [
        h('div', { class: 'lx-card__meta' }, [
            h('span', { class: 'lx-card__id' }, `#${q.displayId ?? q.id}`),
            h('span', { class: 'lx-card__type' }, TYPE_LABELS[q.type] || '简答题'),
            q.category && h('span', { class: 'lx-card__category lx-text-light lx-text-xs' }, q.category),
        ]),
        h('button', {
            class: `lx-status-badge ${badge.class}`,
            onclick: (e) => {
                e.stopPropagation();
                if (ctx.onToggleStatus) ctx.onToggleStatus(q, status);
            },
            'aria-label': '切换状态',
            title: '点击循环切换：未开始 → 已掌握 → 错题',
        }, [badge.text]),
    ]);

    const question = h('div', { class: 'lx-card__question' }, [q.question || '（无题干）']);

    // 按题型分发渲染交互区
    let body = null;
    switch (q.type) {
        case 'single':
        case 'multi':
            body = renderOptions(q, ctx);
            break;
        case 'judge':
            body = renderJudge(q, ctx);
            break;
        case 'fill':
            body = renderFill(q, ctx);
            break;
        case 'essay':
        default:
            body = renderEssay(q, ctx);
            break;
    }

    return h('div', { class: cardClass, 'data-uid': q.uid, 'data-id': q.id }, [
        header,
        question,
        body,
    ]);
}

/**
 * 单选/多选选项渲染
 *
 * 移动端交互要点（BUG-006 修复）：
 *   - 单选：点选项立即提交判分（保留原行为）
 *   - 多选：先勾选 → 显式按「确认答案 ✓」按钮提交
 *     否则移动端没有键盘 Enter，无法触发提交
 */
function renderOptions(q, ctx) {
    const isMulti = q.type === 'multi';
    const selected = ctx.selectedAnswer || (isMulti ? [] : '');
    const revealed = !!ctx.revealed;
    const correctAnswer = q.answer || '';

    if (!q.options || q.options.length === 0) {
        return h('div', { class: 'lx-empty' }, [
            h('div', { class: 'lx-empty__desc' }, '（本题没有选项数据）'),
        ]);
    }

    const labels = 'ABCDEFGHIJ';
    const options = q.options.map((opt, i) => {
        const label = labels[i] || String(i + 1);
        const isSelected = isMulti
            ? Array.isArray(selected) && selected.includes(label)
            : selected === label;
        const isCorrect = revealed && correctAnswer.split(',').includes(label);
        const isWrong = revealed && isSelected && !isCorrect;

        const classes = ['lx-option'];
        if (isCorrect) classes.push('lx-option--correct');
        else if (isWrong) classes.push('lx-option--wrong');
        else if (isSelected) classes.push('lx-option--selected');

        return h('button', {
            class: classes.join(' '),
            type: 'button',
            onclick: () => {
                if (ctx.onAnswer) ctx.onAnswer(q, label);
            },
            disabled: revealed && !isWrong ? 'disabled' : undefined,
            'aria-pressed': isSelected ? 'true' : 'false',
        }, [
            h('span', { class: 'lx-option__label' }, [label]),
            h('span', { class: 'lx-option__text' }, [opt]),
        ]);
    });

    const children = [...options];

    // 多选：在未交卷且已勾选至少一项时显示「确认答案」按钮（移动端关键交互）
    if (isMulti && !revealed) {
        const hasSelection = Array.isArray(selected) && selected.length > 0;
        children.push(h('button', {
            class: 'lx-button lx-button--primary lx-button--block lx-submit-btn',
            type: 'button',
            // 没选时禁用但保留占位，避免布局抖动
            disabled: hasSelection ? undefined : '',
            onclick: () => {
                if (hasSelection && ctx.onAnswer) {
                    ctx.onAnswer(q, selected, { commit: true });
                }
            },
            'aria-label': '确认答案',
        }, [
            h('span', {}, [hasSelection ? `确认答案（已选 ${selected.length} 项）` : '请选择选项']),
        ]));
    }

    return h('div', { class: 'lx-options' }, children);
}

/**
 * 判断题
 */
function renderJudge(q, ctx) {
    const selected = ctx.selectedAnswer || '';
    const revealed = !!ctx.revealed;
    const correct = q.answer || '';

    const buttons = [
        { label: '对', icon: '✓', value: '对' },
        { label: '错', icon: '✗', value: '错' },
    ];

    return h('div', { class: 'lx-judge' }, buttons.map((b) => {
        const isSelected = selected === b.value;
        const isCorrect = revealed && correct === b.value;
        const isWrong = revealed && isSelected && !isCorrect;

        const classes = ['lx-judge__btn'];
        if (isCorrect) classes.push('lx-judge__btn--correct');
        else if (isWrong) classes.push('lx-judge__btn--wrong');
        else if (isSelected) classes.push('lx-judge__btn--selected');

        return h('button', {
            class: classes.join(' '),
            type: 'button',
            onclick: () => {
                if (ctx.onAnswer) ctx.onAnswer(q, b.value);
            },
            disabled: revealed && !isWrong ? 'disabled' : undefined,
        }, [
            h('span', { class: 'lx-judge__btn-icon' }, [b.icon]),
            h('span', {}, [b.label]),
        ]);
    }));
}

/**
 * 填空题
 *
 * 移动端交互要点（BUG-006 修复）：
 *   - 输入框旁加「确认」按钮，移动端没键盘也能提交
 *   - 保留 Enter 提交（PC 端友好）
 */
function renderFill(q, ctx) {
    const revealed = !!ctx.revealed;
    const selected = ctx.selectedAnswer || '';

    const input = h('input', {
        class: 'lx-fill__input',
        type: 'text',
        placeholder: '输入答案…',
        value: selected,
        // 移动端键盘的 Enter 仍可触发提交（PC 端友好），但不是唯一方式
        oninput: (e) => {
            if (ctx.onAnswer) ctx.onAnswer(q, e.target.value, { pending: true });
        },
        onkeydown: (e) => {
            if (e.key === 'Enter' && ctx.onAnswer) {
                ctx.onAnswer(q, e.target.value, { commit: true });
            }
        },
    });

    const confirmBtn = h('button', {
        class: 'lx-button lx-button--primary lx-submit-btn',
        type: 'button',
        disabled: (selected || '').trim() ? undefined : '',
        onclick: () => {
            if (ctx.onAnswer) ctx.onAnswer(q, input.value, { commit: true });
        },
        'aria-label': '确认答案',
    }, ['确认']);

    if (revealed) {
        const correct = q.answer || '';
        return h('div', { class: 'lx-fill' }, [
            h('div', { class: 'lx-fill__row' }, [input, confirmBtn]),
            h('div', { class: `lx-field__${String(selected).trim().toLowerCase() === String(correct).trim().toLowerCase() ? 'success' : 'error'}` }, [
                String(selected).trim() === String(correct).trim() ? '✓ 正确' : `✗ 正确答案：${correct}`,
            ]),
        ]);
    }

    return h('div', { class: 'lx-fill' }, [
        h('div', { class: 'lx-fill__row' }, [input, confirmBtn]),
    ]);
}

/**
 * 简答题
 *
 * 移动端交互要点（BUG-006 修复）：
 *   - textarea 让用户输入答案草稿
 *   - 「确认答案」按钮提交（移动端关键，没键盘也能用）
 *   - 提交后自动展开「答案/解析/口诀」三 Tab 让用户对比
 *   - 「跳过答题」直接展开看解析（背书模式场景）
 */
function renderEssay(q, ctx) {
    const revealed = !!ctx.revealed;
    const expanded = !!ctx.essayExpanded || revealed;
    const initialSelected = ctx.selectedAnswer || '';

    // 输入区（未提交时显示）
    // textarea 用闭包变量保存元素引用，commit 时直接读 DOM 实时值
    // （因为 pending 路径不 refreshCard，ctx.selectedAnswer 可能是旧值）
    let textareaEl = null;
    const inputArea = (!revealed) ? h('div', { class: 'lx-essay-input-area' }, [
        (textareaEl = h('textarea', {
            class: 'lx-essay-textarea',
            placeholder: '在此输入你的答案（可选）…',
            rows: 4,
            oninput: (e) => {
                if (ctx.onAnswer) ctx.onAnswer(q, e.target.value, { pending: true });
            },
        }, [initialSelected])),
        h('div', { class: 'lx-essay-actions' }, [
            h('button', {
                class: 'lx-button lx-button--ghost',
                type: 'button',
                onclick: () => {
                    // 跳过答题：直接看解析
                    if (ctx.onToggleEssay) ctx.onToggleEssay(q);
                },
            }, ['👁 直接看解析']),
            h('button', {
                class: 'lx-button lx-button--primary lx-submit-btn',
                type: 'button',
                onclick: () => {
                    // 直接从 textarea DOM 读取实时值，避免 ctx.selectedAnswer 过期
                    const value = textareaEl ? textareaEl.value : initialSelected;
                    if (ctx.onAnswer && value.trim()) ctx.onAnswer(q, value, { commit: true });
                },
            }, ['确认答案']),
        ]),
    ]) : null;

    // 折叠面板（已展开时显示答案对比）
    const panel = h('div', {
        class: `lx-essay-panel${expanded ? ' lx-essay-panel--expanded' : ''}`,
    });

    const toggle = h('button', {
        class: 'lx-essay-panel__toggle',
        type: 'button',
        onclick: () => {
            if (ctx.onToggleEssay) ctx.onToggleEssay(q);
        },
    }, [
        h('span', {}, ['💡 点按查看解析']),
        h('span', { class: 'lx-essay-panel__toggle-icon' }, [expanded ? '▴' : '▾']),
    ]);

    if (expanded) {
        // keys 对应题目字段：
        //   - 简答题参考答案存在 answerText（不是 answer），与导入 Excel「参考答案」列对应
        //   - 解析/explanation、口诀/mnemonic 复用原字段
        const tabs = ['答案', '解析', '口诀'];
        const keys = ['answerText', 'explanation', 'mnemonic'];
        const activeTab = ctx.essayActiveTab && keys.includes(ctx.essayActiveTab)
            ? ctx.essayActiveTab
            : 'answerText';
        const activeIdx = keys.indexOf(activeTab);

        const tabBtns = tabs.map((t, i) =>
            h('button', {
                class: `lx-tab${i === activeIdx ? ' lx-tab--active' : ''}`,
                type: 'button',
                onclick: () => {
                    if (ctx.onSwitchEssayTab) ctx.onSwitchEssayTab(q, keys[i]);
                },
            }, [t])
        );

        // 答案 Tab 支持"添加/编辑参考答案"（inline textarea），点击保存后回调 onEditAnswerText
        //   - 其他 Tab 文本为空时只显示占位（不提供编辑，避免误操作；需要改解析/口诀可在设置页扩展）
        const isAnswerTab = activeTab === 'answerText';
        const editing = !!(ctx.answerTextEditing && ctx.answerTextEditing.has(q.uid));
        const rawContent = q[activeTab] || '';

        let contentBox;
        if (isAnswerTab && editing) {
            let editEl = null;
            contentBox = h('div', { class: 'lx-essay-edit' }, [
                (editEl = h('textarea', {
                    class: 'lx-essay-textarea',
                    placeholder: '请输入该题的参考答案，用于后续自动判分…',
                    rows: 5,
                }, [rawContent])),
                h('div', { class: 'lx-essay-actions' }, [
                    h('button', {
                        class: 'lx-button lx-button--ghost',
                        type: 'button',
                        onclick: () => {
                            if (ctx.onCancelEditAnswer) ctx.onCancelEditAnswer(q);
                        },
                    }, ['取消']),
                    h('button', {
                        class: 'lx-button lx-button--primary lx-submit-btn',
                        type: 'button',
                        onclick: () => {
                            const value = editEl ? editEl.value : rawContent;
                            if (ctx.onSaveAnswerText) ctx.onSaveAnswerText(q, value);
                        },
                    }, ['保存参考答案']),
                ]),
            ]);
        } else if (isAnswerTab && !rawContent) {
            // 答案 Tab 为空 → 提示并提供添加按钮
            contentBox = h('div', { class: 'lx-essay-content lx-essay-content--empty' }, [
                '（暂未设置参考答案，无法自动判分）',
                h('div', { style: { marginTop: '8px' } }, [
                    h('button', {
                        class: 'lx-button lx-button--secondary',
                        type: 'button',
                        onclick: () => {
                            if (ctx.onStartEditAnswer) ctx.onStartEditAnswer(q);
                        },
                    }, ['＋ 添加参考答案']),
                ]),
            ]);
        } else if (isAnswerTab) {
            // 已有答案：显示 + "编辑"按钮
            contentBox = h('div', {}, [
                h('div', { class: 'lx-essay-content' }, [rawContent]),
                h('div', { style: { marginTop: '8px', display: 'flex', justifyContent: 'flex-end' } }, [
                    h('button', {
                        class: 'lx-button lx-button--text',
                        type: 'button',
                        onclick: () => {
                            if (ctx.onStartEditAnswer) ctx.onStartEditAnswer(q);
                        },
                    }, ['✎ 编辑参考答案']),
                ]),
            ]);
        } else {
            contentBox = h('div', {
                class: `lx-essay-content${rawContent ? '' : ' lx-essay-content--empty'}`,
            }, [rawContent || '（暂无内容）']);
        }

        const body = h('div', { class: 'lx-essay-panel__body' }, [
            h('div', { class: 'lx-tabs' }, tabBtns),
            contentBox,
        ]);

        panel.appendChild(toggle);
        panel.appendChild(body);
    } else {
        panel.appendChild(toggle);
    }

    // 顺序：未提交时先输入区再折叠；提交后只显示折叠
    const children = [];
    if (inputArea) children.push(inputArea);
    children.push(panel);
    return h('div', { class: 'lx-essay-wrap' }, children);
}

/**
 * 渲染答题结果反馈（选项下方）
 * @param {boolean|null} correct - true=正确 false=错误 null=中性（不判分的 essay）
 * @param {string} correctAnswer
 * @param {string} explanation
 * @param {object} [opts]
 * @param {boolean} [opts.neutral] - 中性灰底（用于 essay 未设置参考答案时的提示）
 * @param {string}  [opts.neutralMsg] - 中性情况下的主文案（替代对错文案）
 */
export function renderFeedback(correct, correctAnswer, explanation, opts = {}) {
    const neutral = Boolean(opts.neutral);
    const cls = neutral
        ? 'neutral'
        : (correct ? 'success' : 'error');
    const bg = neutral
        ? 'var(--lx-surface-alt)'
        : (correct ? 'var(--lx-success-light)' : 'var(--lx-danger-light)');
    const fg = neutral ? 'var(--lx-text)' : 'inherit';
    const lead = neutral
        ? (opts.neutralMsg || '已记录答案')
        : (correct ? '✓ 回答正确' : `✗ 正确答案：${correctAnswer}`);
    return h('div', {
        class: `lx-field__${cls}`,
        style: { marginTop: '12px', padding: '8px 12px', background: bg, color: fg, borderRadius: '8px' },
    }, [
        lead,
        explanation && h('div', {
            style: { marginTop: '4px', fontSize: '14px', color: 'var(--lx-text-muted)' },
        }, [explanation]),
    ]);
}
