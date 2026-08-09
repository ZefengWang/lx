/**
 * gestures.js — 移动端手势 + 键盘守护 + BACK 栈守护
 *
 * 设计依据：DESIGN.md §5.2 手势设计、§9 性能（passive listener）
 * 对应 bug：BUG-005（键盘事件守护 —— 输入框内按方向键不切题）
 *
 * 三大职责：
 *   1. attachSwipeGestures：左右滑切题 / 上下滑标记掌握·错题
 *   2. attachKeyboardGuard：方向键 ←→ 切题，输入框聚焦时禁用（BUG-005 回归）
 *   3. attachBackGuard：未提交答案前，浏览器返回/关闭需确认
 *
 * 所有 attach* 返回 detach 函数，便于视图 onLeave 时清理
 *
 * @module render/gestures
 */

/** 滑动阈值（与 DESIGN.md §5.2 一致） */
const SWIPE_THRESHOLD_X = 50; // 左右滑触发阈值
const SWIPE_THRESHOLD_Y = 80; // 上下滑触发阈值（更高，避免误触）
const SWIPE_DETECT_GAP = 20; // 进入"判定为滑动"的最小位移（防 click 误触）

/**
 * 判断元素是否处于"可编辑"状态 —— BUG-005 核心
 * 命中以下任一情况，方向键应由元素自身处理，不切题：
 *   - <input> / <textarea> / <select>
 *   - contenteditable=true 的元素
 *   - 元素处于 isContentEditable
 *
 * 抽成纯函数，便于单元测试（无需 DOM 事件）
 * @param {HTMLElement | null} el
 * @returns {boolean}
 */
export function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
    return false;
}

/**
 * 判断键盘事件是否应被忽略（不切题）
 * BUG-005：input/textarea 内按方向键不切题
 * 同时保留 Ctrl/Cmd 组合键不触发切题（如 Ctrl+Left 选词）
 * @param {KeyboardEvent} e
 * @returns {boolean} true=忽略，不切题
 */
export function shouldIgnoreKeyboard(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return true;
    return isEditableTarget(e.target);
}

/* ------------------------------------------------------------------ */
/* 1. 滑动手势                                                          */
/* ------------------------------------------------------------------ */

/**
 * 绑定滑动手势
 * @param {HTMLElement} el 接收手势的容器（通常是题目卡片外层）
 * @param {object} handlers
 * @param {() => void} [handlers.onLeft]  左滑 → 下一题
 * @param {() => void} [handlers.onRight] 右滑 → 上一题
 * @param {() => void} [handlers.onUp]    上滑 → 标记掌握
 * @param {() => void} [handlers.onDown] 下滑 → 加入错题
 * @returns {() => void} detach
 */
export function attachSwipeGestures(el, handlers = {}) {
    if (!el) return () => {};

    let startX = 0;
    let startY = 0;
    let isSwiping = false;
    let tracking = false;

    // touchstart：记录起点（passive，不阻塞滚动）
    const onStart = (e) => {
        if (e.touches.length !== 1) return; // 单指
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        isSwiping = false;
        tracking = true;
    };

    // touchmove：判定是否进入"滑动"状态，水平滑动时 preventDefault 防止卡顿
    const onMove = (e) => {
        if (!tracking) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        // 水平位移占优且超过检测阈值 → 标记滑动中，阻止默认（避免触发选项 click）
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_DETECT_GAP) {
            isSwiping = true;
            if (e.cancelable) e.preventDefault();
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_DETECT_GAP) {
            // 垂直滑动也标记，但允许页面滚动？—— 上下滑用于"标记掌握/错题"，
            // 题目卡片本身一般不滚动（内容短），所以也 preventDefault
            isSwiping = true;
            if (e.cancelable) e.preventDefault();
        }
    };

    // touchend：根据位移触发对应 handler
    const onEnd = (e) => {
        if (!tracking) return;
        tracking = false;
        if (!isSwiping) {
            startX = 0;
            startY = 0;
            return;
        }
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX > absY && absX > SWIPE_THRESHOLD_X) {
            // 水平滑动
            if (dx < 0 && handlers.onLeft) handlers.onLeft();
            else if (dx > 0 && handlers.onRight) handlers.onRight();
        } else if (absY > absX && absY > SWIPE_THRESHOLD_Y) {
            // 垂直滑动
            if (dy < 0 && handlers.onUp) handlers.onUp();
            else if (dy > 0 && handlers.onDown) handlers.onDown();
        }

        // 阻止滑动结束后的 click 误触（重要：防误触）
        // 用 capture 阶段拦截，300ms 内的 click 全部吞掉
        suppressClicks();

        startX = 0;
        startY = 0;
        isSwiping = false;
    };

    // 防误触：滑动结束后短时间内吞掉 click
    let suppressing = false;
    function suppressClicks() {
        suppressing = true;
        setTimeout(() => { suppressing = false; }, 350);
    }
    const clickCatcher = (e) => {
        if (suppressing) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    // capture 阶段拦截 click，确保先于选项 click handler
    el.addEventListener('click', clickCatcher, true);

    return () => {
        el.removeEventListener('touchstart', onStart);
        el.removeEventListener('touchmove', onMove);
        el.removeEventListener('touchend', onEnd);
        el.removeEventListener('touchcancel', onEnd);
        el.removeEventListener('click', clickCatcher, true);
    };
}

/* ------------------------------------------------------------------ */
/* 2. 键盘守护（BUG-005 回归）                                          */
/* ------------------------------------------------------------------ */

/**
 * 绑定方向键切题（桌面端便利）
 * BUG-005 守护：当焦点在 input/textarea/contenteditable 时，方向键不切题
 *
 * @param {object} handlers
 * @param {() => void} [handlers.onPrev]  ArrowLeft
 * @param {() => void} [handlers.onNext]  ArrowRight
 * @param {() => void} [handlers.onUp]     ArrowUp（可选）
 * @param {() => void} [handlers.onDown]   ArrowDown（可选）
 * @returns {() => void} detach
 */
export function attachKeyboardGuard(handlers = {}) {
    const onKeydown = (e) => {
        if (shouldIgnoreKeyboard(e)) return;
        switch (e.key) {
            case 'ArrowLeft':
                if (handlers.onPrev) { e.preventDefault(); handlers.onPrev(); }
                break;
            case 'ArrowRight':
                if (handlers.onNext) { e.preventDefault(); handlers.onNext(); }
                break;
            case 'ArrowUp':
                if (handlers.onUp) { e.preventDefault(); handlers.onUp(); }
                break;
            case 'ArrowDown':
                if (handlers.onDown) { e.preventDefault(); handlers.onDown(); }
                break;
            default:
                break;
        }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
}

/* ------------------------------------------------------------------ */
/* 3. BACK 栈守护                                                      */
/* ------------------------------------------------------------------ */

/**
 * 绑定 BACK 守护
 *
 * 应用场景：用户在简答/填空题输入了文字但未交卷，
 * 浏览器返回/关闭/刷新时弹出原生确认框，避免误丢数据。
 *
 * 注：SPA hash 路由的"应用内返回"由路由层负责；
 * 本函数只处理浏览器级的退出（beforeunload + popstate 兜底）。
 *
 * @param {() => boolean} isDirty 返回 true 表示有未保存变更
 * @returns {() => void} detach
 */
export function attachBackGuard(isDirty) {
    const onBeforeUnload = (e) => {
        try {
            if (isDirty()) {
                e.preventDefault();
                // 部分浏览器需要 returnValue
                e.returnValue = '';
                return '';
            }
        } catch (_) {}
    };

    // popstate 兜底：history 后退时若 dirty，尝试推回 hash
    // （beforeunload 在部分移动浏览器对 hash 后退不生效）
    const onPopState = (e) => {
        try {
            if (isDirty()) {
                // 不能取消 popstate，但可以提示 + 推回原 hash
                // 留给调用方在 hashchange 时自行决定（避免双重确认）
            }
        } catch (_) {}
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);

    return () => {
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('popstate', onPopState);
    };
}

/**
 * 应用内路由离开的同步守卫
 * 用于在视图 onLeave 时调用：若有未提交变更，弹原生 confirm
 * @param {() => boolean} isDirty
 * @returns {boolean} true=可以离开, false=用户取消
 */
export function confirmLeaveIfDirty(isDirty) {
    if (typeof isDirty === 'function' && isDirty()) {
        return window.confirm('当前题目有未提交的答案，确定离开吗？');
    }
    return true;
}
