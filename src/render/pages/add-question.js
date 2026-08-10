/**
 * add-question.js — 新增自定义题目页
 * 支持 5 种题型：single / multi / judge / fill / essay
 *
 * 后端：QuestionAPI.add({ question, type, options?, answer?, answerText?,
 *                         explanation?, category? })
 *
 * 表单根据题型动态显示：
 *   - single / multi : 选项编辑（动态增删）+ 正确答案选择（单选/多选）
 *   - judge          : 对 / 错 单选
 *   - fill           : 答案文本（题干用 ___ 标空位）
 *   - essay          : 参考答案 textarea
 *
 * @module render/pages/add-question
 */

import { h, render } from '../dom.js';
import { navigate } from '../router.js';
import { toastSuccess, toastWarning, toastInfo } from '../toast.js';
import { appConfirm } from '../confirm.js';

const TYPE_LABELS = {
    single: '单选题',
    multi: '多选题',
    judge: '判断题',
    fill: '填空题',
    essay: '简答题',
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function createAddQuestionPage() {
    let _container = null;

    // 表单状态
    const form = {
        type: 'single',
        category: '',
        question: '',
        options: ['', '', '', ''], // single/multi 用
        answer: '',                 // single: 'A' / multi: 'ABC' / judge: '对'/'错' / fill: 文本
        answerText: '',             // essay 参考答案
        explanation: '',
    };

    function renderPage(container) {
        _container = container;
        refresh();
    }

    function refresh() {
        if (!_container) return;
        const LX = window.LX;
        const currentLibId = LX.LibraryAPI.current().data;
        if (!currentLibId) {
            render(_container, [renderNoLibrary()]);
            return;
        }
        const libR = LX.LibraryAPI.get(currentLibId);
        const libName = libR.ok ? libR.data.name : '';

        const elements = [];

        // 顶部：返回 + 标题
        elements.push(h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } }, [
                h('button', {
                    class: 'lx-button lx-button--secondary',
                    onclick: () => navigate('browse'),
                }, ['← 返回浏览']),
                h('div', { style: { flex: 1 } }, [
                    h('div', { class: 'lx-font-semibold' }, ['➕ 新增题目']),
                    h('div', { class: 'lx-text-xs lx-text-muted' }, [`当前题库：${libName}`]),
                ]),
            ]),
        ]));

        // 表单卡片
        elements.push(h('div', { class: 'lx-card' }, [
            // 题型选择
            fieldLabel('题型'),
            h('div', { class: 'lx-addq__type-row' }, Object.keys(TYPE_LABELS).map((t) =>
                h('button', {
                    class: `lx-addq__type-btn${form.type === t ? ' lx-addq__type-btn--active' : ''}`,
                    type: 'button',
                    onclick: () => {
                        form.type = t;
                        // 切换题型时重置无关字段
                        if (t === 'single' || t === 'multi') {
                            if (form.options.length < 2) form.options = ['', ''];
                            form.answer = '';
                        } else if (t === 'judge') {
                            form.answer = '';
                        } else if (t === 'fill') {
                            form.answer = '';
                        } else if (t === 'essay') {
                            form.answerText = '';
                        }
                        refresh();
                    },
                }, [TYPE_LABELS[t]])
            )),

            // 分类（可选）
            fieldLabel('分类（可选）'),
            h('input', {
                class: 'lx-input',
                type: 'text',
                placeholder: '例如：教育学 / 第一章 ...（留空则归入「未分类」）',
                value: form.category,
                oninput: (e) => { form.category = e.target.value; },
            }),

            // 题干
            fieldLabel('题干 *'),
            h('textarea', {
                class: 'lx-input lx-textarea',
                placeholder: form.type === 'fill'
                    ? '输入题干，用 ___（三个下划线）标记空位，例如：教育的三大要素是 ___、___ 和 ___。'
                    : '输入题干内容…',
                rows: 4,
                oninput: (e) => { form.question = e.target.value; },
            }, [form.question]),

            // 动态区：根据题型
            h('div', { class: 'lx-addq__dynamic' }, [renderDynamic()]),

            // 解析（可选，所有题型通用）
            fieldLabel('解析（可选）'),
            h('textarea', {
                class: 'lx-input lx-textarea',
                placeholder: '答案解析 / 知识点说明…',
                rows: 3,
                oninput: (e) => { form.explanation = e.target.value; },
            }, [form.explanation]),

            // 操作按钮
            h('div', { class: 'lx-flex lx-gap-2', style: { marginTop: '16px' } }, [
                h('button', {
                    class: 'lx-button lx-button--secondary lx-button--block',
                    onclick: () => {
                        if (appConfirm('确定放弃当前内容并返回吗？')) navigate('browse');
                    },
                }, ['取消']),
                h('button', {
                    class: 'lx-button lx-button--primary lx-button--block',
                    onclick: () => handleSubmit(),
                }, ['💾 保存题目']),
            ]),
            // 继续添加提示
            h('div', { class: 'lx-text-xs lx-text-muted', style: { marginTop: '8px', textAlign: 'center' } }, [
                '保存后可继续添加下一题，或点「返回浏览」结束',
            ]),
        ]));

        render(_container, elements);
    }

    /** 动态区：根据 form.type 渲染不同的答案输入 */
    function renderDynamic() {
        if (form.type === 'single' || form.type === 'multi') {
            return renderOptionsEditor();
        }
        if (form.type === 'judge') {
            return renderJudgePicker();
        }
        if (form.type === 'fill') {
            return h('div', {}, [
                fieldLabel('参考答案 *'),
                h('input', {
                    class: 'lx-input',
                    type: 'text',
                    placeholder: '填空答案。多个空用 | 分隔，例如：教育者|受教育者|教育影响',
                    value: form.answer,
                    oninput: (e) => { form.answer = e.target.value; },
                }),
            ]);
        }
        // essay
        return h('div', {}, [
            fieldLabel('参考答案 *（用于简答题判分）'),
            h('textarea', {
                class: 'lx-input lx-textarea',
                placeholder: '输入参考答案。答题时用 bigram 字符相似度自动判分（阈值 50%）。',
                rows: 5,
                oninput: (e) => { form.answerText = e.target.value; },
            }, [form.answerText]),
        ]);
    }

    /** 选项编辑器（single / multi） */
    function renderOptionsEditor() {
        const isMulti = form.type === 'multi';
        const selected = isMulti
            ? new Set((form.answer || '').split('').filter((c) => LETTERS.includes(c)))
            : (form.answer || '');

        const optionRows = form.options.map((opt, i) => {
            const letter = LETTERS[i];
            const checked = isMulti ? selected.has(letter) : selected === letter;
            return h('div', { class: 'lx-addq__opt-row' }, [
                h('button', {
                    class: `lx-addq__opt-check${checked ? ' lx-addq__opt-check--active' : ''}`,
                    type: 'button',
                    'aria-pressed': checked ? 'true' : 'false',
                    onclick: () => {
                        if (isMulti) {
                            const s = new Set((form.answer || '').split('').filter((c) => LETTERS.includes(c)));
                            if (s.has(letter)) s.delete(letter);
                            else s.add(letter);
                            form.answer = Array.from(s).sort().join('');
                        } else {
                            form.answer = letter;
                        }
                        refresh();
                    },
                }, [letter]),
                h('input', {
                    class: 'lx-input lx-addq__opt-input',
                    type: 'text',
                    placeholder: `选项 ${letter} 内容`,
                    value: opt,
                    oninput: (e) => { form.options[i] = e.target.value; },
                }),
                h('button', {
                    class: 'lx-button--text',
                    style: { color: 'var(--lx-danger)', padding: '4px 8px' },
                    onclick: () => {
                        if (form.options.length <= 2) {
                            toastWarning('至少需要 2 个选项');
                            return;
                        }
                        form.options.splice(i, 1);
                        // 重置答案（字母位移后可能错位）
                        form.answer = '';
                        refresh();
                    },
                }, ['✕']),
            ]);
        });

        const children = [
            fieldLabel(`选项与正确答案${isMulti ? '（可多选）' : '（单选）'}`),
            ...optionRows,
        ];
        if (form.options.length < LETTERS.length) {
            children.push(h('button', {
                class: 'lx-button lx-button--ghost lx-button--block',
                style: { marginTop: '8px', fontSize: '13px' },
                onclick: () => {
                    form.options.push('');
                    refresh();
                },
            }, ['＋ 添加选项']));
        }
        return h('div', {}, children);
    }

    /** 判断题答案选择 */
    function renderJudgePicker() {
        const opts = [
            { v: '对', icon: '✓' },
            { v: '错', icon: '✗' },
        ];
        return h('div', {}, [
            fieldLabel('正确答案 *'),
            h('div', { class: 'lx-addq__judge-row' }, opts.map((o) =>
                h('button', {
                    class: `lx-addq__judge-btn${form.answer === o.v ? ' lx-addq__judge-btn--active' : ''}`,
                    type: 'button',
                    onclick: () => { form.answer = o.v; refresh(); },
                }, [`${o.icon} ${o.v}`])
            )),
        ]);
    }

    /** 提交保存 */
    function handleSubmit() {
        const LX = window.LX;

        // 校验
        if (!form.question.trim()) {
            toastWarning('题干不能为空');
            return;
        }
        const partial = {
            type: form.type,
            category: form.category.trim() || undefined,
            question: form.question.trim(),
            explanation: form.explanation.trim() || undefined,
            mnemonic: form.explanation.trim() || undefined,
        };

        if (form.type === 'single' || form.type === 'multi') {
            // 选项校验
            const opts = form.options.map((o) => o.trim()).filter(Boolean);
            if (opts.length < 2) {
                toastWarning('至少需要 2 个非空选项');
                return;
            }
            if (!form.answer) {
                toastWarning('请选择正确答案');
                return;
            }
            partial.options = opts;
            partial.answer = form.answer;
        } else if (form.type === 'judge') {
            if (!form.answer) {
                toastWarning('请选择对或错');
                return;
            }
            partial.answer = form.answer;
            partial.options = ['对', '错'];
        } else if (form.type === 'fill') {
            if (!form.answer.trim()) {
                toastWarning('请输入填空答案');
                return;
            }
            partial.answer = form.answer.trim();
        } else if (form.type === 'essay') {
            if (!form.answerText.trim()) {
                toastWarning('请输入参考答案');
                return;
            }
            partial.answerText = form.answerText.trim();
            partial.answer = '';
        }

        const r = LX.QuestionAPI.add(partial);
        if (!r.ok) {
            toastWarning(`保存失败：${r.error?.message || '未知错误'}`);
            return;
        }
        toastSuccess(`已添加${TYPE_LABELS[form.type]}（ID #${r.data.id}）`);

        // 重置题干与答案，保留题型与分类（方便连续录入同类题）
        form.question = '';
        form.options = ['', '', '', ''];
        form.answer = '';
        form.answerText = '';
        form.explanation = '';
        refresh();
    }

    function renderNoLibrary() {
        return h('div', { class: 'lx-empty' }, [
            h('div', { class: 'lx-empty__icon' }, ['📭']),
            h('div', { class: 'lx-empty__title' }, ['未选择题库']),
            h('div', { class: 'lx-empty__desc' }, ['请先在设置页创建或选择题库']),
            h('button', {
                class: 'lx-button lx-button--primary',
                style: { marginTop: '16px' },
                onclick: () => navigate('settings'),
            }, ['去设置']),
        ]);
    }

    return {
        render: renderPage,
        onLeave() {},
    };
}

function fieldLabel(text) {
    return h('div', { class: 'lx-text-sm lx-font-medium', style: { margin: '12px 0 6px' } }, [text]);
}
