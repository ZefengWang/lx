/**
 * bottombar.js — 底部操作区
 * 来源：DESIGN.md 7.4
 * 手机竖屏：两行（状态 3 键 + 导航 3 键）
 * 平板及以上：单行 6 键
 * @module render/bottombar
 */

import { h } from './dom.js';

/**
 * 渲染底部操作区
 * @param {object} ctx
 * @param {boolean} [ctx.canPrev] 是否可上一题
 * @param {boolean} [ctx.canNext] 是否可下一题
 * @param {boolean} [ctx.isMastered] 当前题已掌握
 * @param {boolean} [ctx.isWrong] 当前题是错题
 * @param {boolean} [ctx.canReset] 当前题有标记可清（= 状态非 pending）；false 时「清除标记」弱化且点了无动作
 * @param {() => void} [ctx.onReset] 清除当前题的掌握/错题标记（回到未开始 pending）
 * @param {() => void} [ctx.onMastered]
 * @param {() => void} [ctx.onWrong]
 * @param {() => void} [ctx.onPrev]
 * @param {() => void} [ctx.onCatalog] 目录
 * @param {() => void} [ctx.onNext]
 * @returns {HTMLElement}
 */
export function renderBottombar(ctx = {}) {
    const barBtn = (icon, label, onClick, opts = {}) =>
        h('button', {
            class: `lx-button--bar${opts.modifier ? ` lx-button--${opts.modifier}` : ''}`,
            type: 'button',
            onclick: onClick,
            // 必须传布尔 true：h() 对 DOM 属性会走 el.disabled=val，空串 '' 是 falsy 会导致禁用失效
            disabled: opts.disabled ? true : undefined,
            'aria-label': label,
            style: opts.style || undefined,
        }, [
            h('span', { class: 'lx-button__icon' }, [icon]),
            h('span', {}, [label]),
        ]);

    const masteredBtn = h('button', {
        class: `lx-button--bar${ctx.isMastered ? ' lx-button--success' : ''}`,
        type: 'button',
        onclick: ctx.onMastered,
        'aria-label': ctx.isMastered ? '取消掌握标记' : '标记为已掌握',
        'aria-pressed': ctx.isMastered ? 'true' : 'false',
    }, [
        h('span', { class: 'lx-button__icon' }, [ctx.isMastered ? '✓' : '✅']),
        h('span', {}, [ctx.isMastered ? '已掌握' : '掌握']),
    ]);

    const wrongBtn = h('button', {
        class: `lx-button--bar${ctx.isWrong ? ' lx-button--warning' : ''}`,
        type: 'button',
        onclick: ctx.onWrong,
        'aria-label': ctx.isWrong ? '移出错题本' : '加入错题',
        'aria-pressed': ctx.isWrong ? 'true' : 'false',
    }, [
        h('span', { class: 'lx-button__icon' }, [ctx.isWrong ? '📕' : '⚠️']),
        h('span', {}, [ctx.isWrong ? '错题中' : '错题']),
    ]);

    return h('footer', { class: 'lx-bottombar', role: 'contentinfo' }, [
        h('div', { class: 'lx-bottombar__row' }, [
            // 「重置」改名「清除标记」，避免误解成"重置全部进度/回到第1题"；
            // pending 态下无标记可清，弱化样式提示用户不可用
            barBtn(
                '↩',
                '清除标记',
                ctx.onReset,
                ctx.canReset ? {} : {
                    style: {
                        opacity: 0.45,
                        cursor: 'not-allowed',
                        color: 'var(--lx-text-light)',
                    },
                    disabled: true,
                }
            ),
            masteredBtn,
            wrongBtn,
        ]),
        h('div', { class: 'lx-bottombar__row' }, [
            barBtn('◀', '上一题', ctx.onPrev, { disabled: !ctx.canPrev }),
            barBtn('📋', '浏览', ctx.onCatalog),
            barBtn('▶', '下一题', ctx.onNext, { disabled: !ctx.canNext }),
        ]),
    ]);
}
