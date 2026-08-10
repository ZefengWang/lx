/**
 * 系统差分测挂载：壳层（顶栏/底栏/抽屉）+ 页面同根，便于 collectUiState 一次采全。
 * @module test/system/ui-state-harness
 */

import { mountShell } from '../ui/dom-harness.js';

/**
 * @param {() => { render: (el: HTMLElement) => void, onLeave?: () => void }} pageFactory
 * @param {{ routeName?: string, showBottombar?: boolean }} [opts]
 */
export function mountShellWithPage(pageFactory, opts = {}) {
    const shell = mountShell({
        routeName: opts.routeName || 'study',
        showBottombar: opts.showBottombar,
    });
    const main = shell.root.querySelector('#lx-main');
    if (!main) throw new Error('mountShellWithPage: 缺少 #lx-main');
    const page = pageFactory();
    page.render(main);
    return {
        root: shell.root,
        shell,
        page,
        main,
        refresh() {
            shell.refresh();
        },
        setRoute(name) {
            shell.setRoute(name);
        },
        remountPage(factory) {
            try {
                if (page && typeof page.onLeave === 'function') page.onLeave();
            } catch (_) { /* ignore */ }
            main.innerHTML = '';
            const next = factory();
            next.render(main);
            return next;
        },
        destroy() {
            try {
                if (page && typeof page.onLeave === 'function') page.onLeave();
            } catch (_) { /* ignore */ }
            shell.destroy();
        },
    };
}
