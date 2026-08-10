/**
 * render/session — UI 会话子层出口
 *
 * 职责：跨路由仍需保留的界面上下文（搜索草稿、面板开闭等）。
 * 依赖方向：pages / shell → session →（仅同层或更底层 render 工具，禁止碰 core）
 * 领域刷题队列不在此层，见 api NavigationAPI.searchPlaylist。
 *
 * @module render/session
 */

export {
    getUiSession,
    getBrowseSearch,
    setBrowseSearch,
    clearBrowseSearch,
    getPracticeSheet,
    setPracticeSheet,
    closePracticeSheet,
    __resetUiSessionForTest,
} from './ui-session.js';
