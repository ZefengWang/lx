/**
 * 目录页搜索 UI 状态机（纯函数，无 DOM）— v1.2 AND 过滤链
 * - filters[]：有序 AND 条件；add / removeAt
 * - 命中题按分类分组
 * @module render/contracts/catalog-search-state
 */

/**
 * @param {string[]} filters
 * @returns {boolean}
 */
export function isSearchMode(filters) {
    return Array.isArray(filters) && filters.length > 0;
}

/**
 * 追加过滤词。空串失败；与末尾相同则不重复 append。
 * @param {string[]} filters
 * @param {string} draft
 * @returns {{ ok: true, filters: string[] } | { ok: false, error: { code: string, message: string }, filters: string[] }}
 */
export function addFilter(filters, draft) {
    const prev = Array.isArray(filters) ? filters.slice() : [];
    const t = String(draft ?? '').trim();
    if (!t) {
        return {
            ok: false,
            error: { code: 'INVALID_INPUT', message: '请输入搜索关键字' },
            filters: prev,
        };
    }
    const next = prev.slice();
    if (next[next.length - 1] !== t) next.push(t);
    return { ok: true, filters: next };
}

/**
 * 删除第 index 级条件（可删中间级）。
 * @param {string[]} filters
 * @param {number} index
 * @returns {{ ok: true, filters: string[] } | { ok: false, error: { code: string, message: string }, filters: string[] }}
 */
export function removeFilterAt(filters, index) {
    const prev = Array.isArray(filters) ? filters.slice() : [];
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= prev.length) {
        return {
            ok: false,
            error: { code: 'OUT_OF_RANGE', message: '过滤级索引无效' },
            filters: prev,
        };
    }
    const next = prev.slice();
    next.splice(i, 1);
    return { ok: true, filters: next };
}

/**
 * 将命中题目按分类分组。
 * @param {Array<{ category?: string }>} hits
 * @param {string[]} [categoryOrder]
 * @returns {Array<{ category: string, questions: any[] }>}
 */
export function groupHitsByCategory(hits, categoryOrder = []) {
    const list = Array.isArray(hits) ? hits : [];
    /** @type {Map<string, any[]>} */
    const map = new Map();
    for (const q of list) {
        const cat = (q && q.category) ? String(q.category) : '未分类';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push(q);
    }

    const order = [];
    const seen = new Set();
    const prefer = Array.isArray(categoryOrder) ? categoryOrder : [];
    for (const c of prefer) {
        const name = String(c || '未分类');
        if (map.has(name) && !seen.has(name)) {
            order.push(name);
            seen.add(name);
        }
    }
    for (const name of map.keys()) {
        if (!seen.has(name)) {
            order.push(name);
            seen.add(name);
        }
    }

    return order.map((category) => ({
        category,
        questions: map.get(category) || [],
    }));
}

/**
 * @param {Array<{ category?: string }>} questions
 * @returns {string[]}
 */
export function categoryOrderFromQuestions(questions) {
    const order = [];
    const seen = new Set();
    for (const q of questions || []) {
        const cat = (q && q.category) ? String(q.category) : '未分类';
        if (!seen.has(cat)) {
            seen.add(cat);
            order.push(cat);
        }
    }
    return order;
}
