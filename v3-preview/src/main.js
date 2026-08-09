/**
 * 主应用入口
 * bootstrap 完成（核心层 + API 层）后，若 #app 容器存在则启动 UI Render 层
 * - index.html：旧版 API 调试模式（PC 端测试用，保留线上不变）
 * - app.html：新版移动端 Render UI（本次开发目标）
 * @module main
 */

import { bootstrap } from './bootstrap.js';
import { initUI } from './render/main-ui.js';

bootstrap()
    .then((LX) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lx:main-ready', { detail: LX }));

            // 仅当页面提供 #app 容器时才启动新版 UI（避免污染旧版 index.html 调试页）
            if (document.getElementById('app')) {
                try {
                    initUI(LX);
                    console.log('[lx] UI Render 层已启动');
                } catch (e) {
                    console.error('[lx] UI 启动失败：', e);
                }
            }
        }
    })
    .catch((e) => {
        console.error('[lx] bootstrap failed:', e);
    });
