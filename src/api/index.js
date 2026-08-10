/**
 * window.LX 装配中心
 * 将所有 API 域挂载到全局 window.LX，供 render 层和测试调用
 *
 * 注意：必须 import 命名导出的 const 对象（如 { LibraryAPI }），
 * 而非 `import * as LibraryAPI`，因为后者拿到的是 namespace，
 * 不含 `switch`/`delete` 等别名（这些只在 const 对象上）
 * @module api/index
 */

import { LibraryAPI } from './library.js';
import { QuestionAPI } from './question.js';
import { ProgressAPI } from './progress.js';
import { NavigationAPI } from './navigation.js';
import { WrongBookAPI } from './wrong-book.js';
import { CategoryAPI } from './category.js';
import { StatsAPI } from './stats.js';
import { IOAPI } from './io.js';
import { DrillAPI } from './drill.js';
import { DefaultLibraryAPI } from './default-library.js';
import { bus, Events } from '../core/events.js';

/** 应用版本（与 version.txt 保持一致） */
export const VERSION = '3.2.1';

/**
 * 装配 window.LX
 * @returns {object} LX 对象
 */
export function mountLX() {
    const LX = {
        version: VERSION,

        // API 域（const 对象，含 switch/delete 等别名）
        LibraryAPI,
        QuestionAPI,
        ProgressAPI,
        NavigationAPI,
        WrongBookAPI,
        CategoryAPI,
        StatsAPI,
        IOAPI,
        DrillAPI,
        DefaultLibraryAPI,

        // 事件总线快捷方法
        on: (event, handler) => bus.on(event, handler),
        off: (event, handler) => bus.off(event, handler),
        once: (event, handler) => bus.once(event, handler),
        emit: (event, payload) => bus.emit(event, payload),
        Events,

        // 内部标记
        _mountedAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
        window.LX = LX;
    }
    return LX;
}
