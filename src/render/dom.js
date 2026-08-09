/**
 * dom.js — Render 层 DOM 操作工具
 * 设计原则：
 *   - 不引入框架，全部用原生 DOM
 *   - 安全：所有插入用户文本都走 escapeHtml / textContent，避免 XSS
 *   - 性能：批量操作用 DocumentFragment，避免逐次重排
 * @module render/dom
 */

import { escapeHtml } from '../utils.js';

/**
 * 选择单个元素
 * @param {string} sel
 * @param {ParentNode} [parent=document]
 * @returns {HTMLElement | null}
 */
export function $(sel, parent = document) {
    return parent.querySelector(sel);
}

/**
 * 选择多个元素
 * @param {string} sel
 * @param {ParentNode} [parent=document]
 * @returns {HTMLElement[]}
 */
export function $$(sel, parent = document) {
    return Array.from(parent.querySelectorAll(sel));
}

/**
 * 创建元素 + 设置属性 + 子节点
 * @example
 * h('div', { class: 'card', 'data-id': 5 }, [
 *     h('h2', { class: 'card__title' }, '标题'),
 *     '文本节点',
 * ])
 * @param {string} tag
 * @param {object} [props]
 * @param {(Node|string|number|null|false)[]} [children]
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, children = []) {
    const el = document.createElement(tag);

    for (const key in props) {
        const val = props[key];
        if (val == null || val === false) continue;

        if (key === 'class' || key === 'className') {
            el.className = val;
        } else if (key === 'style' && typeof val === 'object') {
            for (const k in val) el.style[k] = val[k];
        } else if (key === 'dataset' && typeof val === 'object') {
            for (const k in val) el.dataset[k] = val[k];
        } else if (key.startsWith('on') && typeof val === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'html') {
            // 显式注入 HTML（调用方需自行 escape）
            el.innerHTML = val;
        } else if (key in el && key !== 'list') {
            // 原生属性（value/checked/disabled 等）
            try {
                el[key] = val;
            } catch (_) {
                el.setAttribute(key, val);
            }
        } else {
            el.setAttribute(key, val);
        }
    }

    appendChildren(el, children);
    return el;
}

/**
 * 安全追加子节点（支持字符串/数字/Node/数组/嵌套/false/null 过滤）
 * @param {ParentNode} parent
 * @param {(Node|string|number|null|false|Array)[]} children
 */
export function appendChildren(parent, children) {
    if (children == null) return;
    if (!Array.isArray(children)) children = [children];

    const frag = document.createDocumentFragment();
    for (const child of children) {
        if (child == null || child === false) continue;
        if (typeof child === 'string' || typeof child === 'number') {
            frag.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof Node) {
            frag.appendChild(child);
        } else if (Array.isArray(child)) {
            appendChildren(frag, child);
        }
    }
    parent.appendChild(frag);
}

/**
 * 清空元素的所有子节点
 * @param {HTMLElement} el
 */
export function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * 重新渲染：清空 + 插入新内容
 * @param {HTMLElement} el
 * @param {(Node|string|number|null|false)[]} children
 */
export function render(el, children) {
    clear(el);
    appendChildren(el, children);
}

/**
 * 安全注入 HTML 字符串（调用方必须自行 escapeHtml）
 * 用于结构已知、性能敏感的批量渲染
 * @param {HTMLElement} el
 * @param {string} html
 */
export function setHTML(el, html) {
    el.innerHTML = html;
}

/**
 * 根据字符串创建元素（仅 HTML 片段，无 props）
 * @param {string} html
 * @returns {HTMLElement}
 */
export function fromHTML(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
}

/**
 * 委托：在父元素上监听子元素事件
 * @param {HTMLElement} parent
 * @param {string} eventType
 * @param {string} selector
 * @param {(ev: Event, target: HTMLElement) => void} handler
 * @returns {() => void} 取消监听
 */
export function delegate(parent, eventType, selector, handler) {
    const listener = (ev) => {
        const target = ev.target.closest(selector);
        if (target && parent.contains(target)) {
            handler(ev, target);
        }
    };
    parent.addEventListener(eventType, listener);
    return () => parent.removeEventListener(eventType, listener);
}

/**
 * 防止快速连续点击（去抖）
 * @param {() => void} fn
 * @param {number} delay
 */
export function debounceClick(fn, delay = 300) {
    let last = 0;
    return (...args) => {
        const now = Date.now();
        if (now - last < delay) return;
        last = now;
        fn(...args);
    };
}

/**
 * 安全 escape（再导出一次，便于 render 模块统一 import 自 dom.js）
 */
export { escapeHtml };

/**
 * 判断元素是否可见（用于滚动到视窗前的判断）
 */
export function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

/**
 * 平滑滚动到视窗中央（用于答错反馈后让用户看清选项）
 * @param {HTMLElement} el
 * @param {ScrollIntoViewOptions} [opts]
 */
export function scrollIntoView(el, opts = { behavior: 'smooth', block: 'nearest' }) {
    if (el && el.scrollIntoView) el.scrollIntoView(opts);
}
