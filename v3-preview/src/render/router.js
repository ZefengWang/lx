/**
 * router.js — 极简 hash 路由
 * 设计：基于 location.hash，无需后端配合，GitHub Pages 直接可用
 * 路由表：
 *   #/               → home     首页（题库列表 + 统计卡）
 *   #/study          → study    答题页（核心）
 *   #/wrong          → wrongbook 错题本
 *   #/stats          → stats    进度统计
 *   #/library        → library  题库管理
 *   #/settings       → settings 设置（导入/导出/关于）
 *
 * @module render/router
 */

/** @typedef {(params: Record<string,string>) => {render: () => void, onLeave?: () => void, title?: string}} RouteHandler */

const routes = new Map();
let _current = null; // { handler, params, view }
let _container = null;
let _onNavigate = null; // 顶栏高亮等回调

/**
 * 注册路由
 * @param {string} name 路由名（home/study/wrong/...）
 * @param {string} pattern hash 模式（如 '#/study' 或 '#/study/:libId'）
 * @param {RouteHandler} handler
 */
export function register(name, pattern, handler) {
    routes.set(name, { pattern, handler });
}

/**
 * 把 hash 与 pattern 匹配，提取参数
 * @param {string} pattern
 * @param {string} hash
 * @returns {Record<string,string> | null}
 */
function matchPattern(pattern, hash) {
    // pattern: '#/study/:libId' → regex: ^#/study/([^/]+)$
    const paramNames = [];
    const regexStr = pattern.replace(/:([a-zA-Z]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
    });
    const re = new RegExp('^' + regexStr + '$');
    const m = re.exec(hash);
    if (!m) return null;
    const params = {};
    paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1]);
    });
    return params;
}

/**
 * 找到匹配的路由
 * @param {string} hash
 * @returns {{name: string, handler: RouteHandler, params: object} | null}
 */
function resolve(hash) {
    if (!hash || hash === '#') hash = '#/';
    for (const [name, { pattern, handler }] of routes) {
        const params = matchPattern(pattern, hash);
        if (params) return { name, handler, params };
    }
    return null;
}

/**
 * 切换路由
 * @param {string} name 路由名
 * @param {Record<string,string>} [params={}]
 */
export function navigate(name, params = {}) {
    const route = routes.get(name);
    if (!route) {
        console.warn('[lx:router] 未知路由：', name);
        return;
    }
    // 反向生成 hash
    let hash = route.pattern.replace(/:([a-zA-Z]+)/g, (_, key) =>
        encodeURIComponent(params[key] ?? '')
    );
    if (hash !== location.hash) {
        location.hash = hash; // 触发 hashchange → handle()
    } else {
        handle(); // 同地址，手动触发
    }
}

/**
 * 处理当前 hash，渲染对应视图
 */
function handle() {
    const hash = location.hash || '#/';
    const match = resolve(hash);

    if (!match) {
        // 未匹配，回退首页
        if (hash !== '#/') {
            location.hash = '#/';
            return;
        }
        return;
    }

    // 销毁上一个视图
    if (_current && _current.onLeave) {
        try {
            _current.onLeave();
        } catch (e) {
            console.error('[lx:router] onLeave 报错：', e);
        }
    }

    const { handler, params } = match;
    try {
        const view = handler(params);
        _current = view;

        if (_container && typeof view.render === 'function') {
            view.render(_container);
        }

        // 通知顶栏更新高亮
        if (_onNavigate) _onNavigate(match.name, params);
    } catch (e) {
        console.error('[lx:router] 视图渲染失败：', e);
        if (_container) {
            _container.innerHTML = `<div class="lx-empty"><div class="lx-empty__icon">⚠️</div><div class="lx-empty__title">页面加载失败</div><div class="lx-empty__desc">${e.message}</div></div>`;
        }
    }
}

/**
 * 启动路由
 * @param {HTMLElement} container 视图渲染容器
 * @param {(name: string, params: object) => void} [onNavigate] 路由切换回调
 */
export function startRouter(container, onNavigate) {
    _container = container;
    _onNavigate = onNavigate;

    window.addEventListener('hashchange', handle);
    handle(); // 首次渲染
}

/**
 * 停止路由（测试用）
 */
export function stopRouter() {
    window.removeEventListener('hashchange', handle);
    _container = null;
    _onNavigate = null;
    _current = null;
}

/**
 * 当前路由名
 */
export function currentRoute() {
    const hash = location.hash || '#/';
    const match = resolve(hash);
    return match?.name || 'home';
}
