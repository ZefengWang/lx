/**
 * main-ui.js — UI 层主入口
 * 装配顶栏 / 主体路由容器 / 底栏 / 抽屉 / 路由
 * 由 main.js 在 bootstrap 完成后调用
 *
 * @module render/main-ui
 */

import { h, render, $ } from './dom.js';
import { renderTopbar } from './topbar.js';
import { renderBottombar } from './bottombar.js';
import { createDrawer, createOverlay, openDrawer, closeDrawer, renderDrawerContent, isDrawerOpen } from './drawer.js';
import { startRouter, register, navigate, currentRoute } from './router.js';
import { createHomePage } from './pages/home.js';
import { createStudyPage } from './pages/study.js';
import { createWrongBookPage } from './pages/wrongbook.js';
import { createStatsPage } from './pages/stats.js';
import { createSettingsPage } from './pages/settings.js';
import { createBrowsePage } from './pages/browse.js';
import { createAddQuestionPage } from './pages/add-question.js';
import { createHelpPage } from './pages/help.js';
import { applyInitial as applyInitialTheme } from './theme.js';
import { toastInfo, toastPrimary, toastSuccess, toastWarning } from './toast.js';
import { appConfirm } from './confirm.js';
import { appPrompt } from './prompt.js';
import { triggerFileImport } from './contracts/import-library-flow.js';

/**
 * UI 主初始化
 * @param {object} LX window.LX
 */
export function initUI(LX) {
    // 0. 先应用 localStorage 里持久化的主题 / 夜间 / 护眼模式（必须在首次渲染前，避免闪现）
    applyInitialTheme();

    // 1. 构建应用骨架
    const app = $('#app') || document.body;
    render(app, [
        // 顶栏
        h('div', { id: 'lx-topbar-slot' }),
        // 主体
        h('main', { class: 'lx-main', id: 'lx-main', role: 'main' }),
        // 底栏（仅 study/wrongbook 页显示）
        h('div', { id: 'lx-bottombar-slot' }),
        // 抽屉 + 遮罩
        createOverlay(),
        createDrawer(),
    ]);

    // 2. 注册路由
    register('home',     '#/',            () => createHomePage());
    register('study',    '#/study',       () => createStudyPage());
    register('wrong',    '#/wrong',       () => createWrongBookPage());
    register('stats',    '#/stats',       () => createStatsPage());
    register('settings', '#/settings',    () => createSettingsPage());
    register('browse',   '#/browse',      () => createBrowsePage());
    // 兼容旧 hash / 旧测试名
    register('catalog',  '#/catalog',     () => createBrowsePage());
    register('add-question', '#/add-question', () => createAddQuestionPage());
    register('help',     '#/help',        () => createHelpPage());

    // 3. 启动路由
    startRouter($('#lx-main'), (routeName) => {
        refreshTopbar();
        refreshBottombar(routeName);
        refreshDrawer();
    });

    // 4. 事件订阅：核心状态变化 → 重渲染顶栏/底栏/抽屉
    [
        LX.Events.LIBRARY_SWITCHED,
        LX.Events.LIBRARY_CREATED,
        LX.Events.LIBRARY_DELETED,
        LX.Events.QUESTION_STATUS_CHANGED,
        LX.Events.NAVIGATION_CHANGED,
        LX.Events.PROGRESS_UPDATED,
        LX.Events.PROGRESS_RESET,
        LX.Events.WRONGBOOK_ENTERED,
        LX.Events.WRONGBOOK_EXITED,
    ].forEach((evt) => {
        LX.on(evt, () => {
            refreshTopbar();
            refreshBottombar(currentRoute());
            refreshDrawer();
        });
    });

    // 5. 监听打开抽屉的自定义事件（来自空状态按钮）
    document.addEventListener('lx:open-drawer', () => openDrawer());
    document.addEventListener('lx:close-drawer', () => closeDrawer());

    // 6. ESC 键关闭抽屉
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isDrawerOpen()) closeDrawer();
    });

    // 7. 首次渲染顶栏
    refreshTopbar();
    refreshDrawer();
}

/**
 * 刷新顶栏
 */
function refreshTopbar() {
    const LX = window.LX;
    const slot = $('#lx-topbar-slot');
    if (!slot) return;

    const route = currentRoute();

    const libsR = LX.LibraryAPI.list();
    const libs = libsR.ok ? libsR.data : [];
    const currentId = LX.LibraryAPI.current().data;
    const current = currentId ? LX.LibraryAPI.get(currentId).data : null;
    const summary = current ? LX.StatsAPI.summary().data : { total: 0, mastered: 0, review: 0, percent: 0 };

    // 估算错题数：进入错题本前的预览数 = review 状态题数
    const wrongCount = summary.review || 0;

    render(slot, [
        renderTopbar({
            routeName: route,
            libraryName: current?.name || '未选择题库',
            wrongCount,
            masteredCount: summary.mastered,
            totalCount: summary.total,
            percent: summary.percent,
            onMenu: () => {
                if (isDrawerOpen()) closeDrawer();
                else openDrawer();
            },
            onBack: () => {
                // 一键回到刷题页
                navigate('study');
            },
            onLibraryClick: () => {
                // 跳转到设置页的题库管理
                navigate('settings');
            },
            onWrongClick: () => {
                if (wrongCount === 0) {
                    toastInfo('当前没有错题');
                    return;
                }
                navigate('wrong');
            },
            onProgressClick: () => navigate('stats'),
        }),
    ]);
}

/**
 * 刷新底栏（仅 study / wrongbook 页显示）
 */
function refreshBottombar(routeName) {
    const slot = $('#lx-bottombar-slot');
    if (!slot) return;

    const showBottombar = routeName === 'study' || routeName === 'wrong';
    if (!showBottombar) {
        render(slot, []);
        return;
    }

    const LX = window.LX;
    const currentId = LX.LibraryAPI.current().data;
    if (!currentId) {
        render(slot, []);
        return;
    }

    const navR = LX.NavigationAPI.current();
    const nav = navR.ok ? navR.data : null;
    const q = nav?.qId ? LX.QuestionAPI.get(nav.qId).data : null;
    // 注意 ProgressAPI 状态值：'none' = 未开始/未标记，'mastered' = 掌握，'review' = 错题
    // 禁止传 'pending'（API 不认识，会直接 err）
    const statusR = q ? LX.ProgressAPI.getStatus(q) : { ok: false };
    const status = statusR.ok ? statusR.data : 'none';

    // 错题本模式下底部隐藏（用页面内按钮替代）
    if (routeName === 'wrong') {
        render(slot, []);
        return;
    }

    render(slot, [
        renderBottombar({
            canPrev: true,
            canNext: true,
            isMastered: status === 'mastered',
            isWrong: status === 'review',
            canReset: status !== 'none',
            onReset: () => {
                if (!q) return;
                if (status === 'none') {
                    toastInfo('当前题目尚未开始');
                    return;
                }
                const wasMastered = status === 'mastered';
                const wasWrong = status === 'review';
                const res = LX.ProgressAPI.setStatus(q, 'none');
                if (!res.ok) {
                    toastWarning('清除失败：' + (res.error?.message || '未知错误'));
                    return;
                }
                if (wasMastered) toastPrimary('已取消「掌握」标记');
                else if (wasWrong) toastPrimary('已移出错题本');
                else toastInfo('已重置当前题目状态');
            },
            onMastered: () => {
                if (!q) return;
                LX.ProgressAPI.setStatus(q, status === 'mastered' ? 'none' : 'mastered');
            },
            onWrong: () => {
                if (!q) return;
                LX.ProgressAPI.setStatus(q, status === 'review' ? 'none' : 'review');
            },
            onPrev: () => LX.NavigationAPI.prev(),
            onCatalog: () => {
                // 浏览页：题目列表 / 搜索 / 练习入口
                navigate('browse');
            },
            onNext: () => LX.NavigationAPI.next(),
        }),
    ]);
}

/**
 * 刷新抽屉内容
 */
function refreshDrawer() {
    const LX = window.LX;
    const libsR = LX.LibraryAPI.list();
    const libs = libsR.ok ? libsR.data : [];
    const currentId = LX.LibraryAPI.current().data;

    renderDrawerContent({
        libraries: libs.map((lib) => ({
            id: lib.id,
            name: lib.name,
            questionCount: lib.questionCount,
        })),
        currentLibId: currentId,
        onSwitchLib: (libId) => {
            LX.LibraryAPI.switch(libId);
            closeDrawer();
            navigate('study');
        },
        onImportLibrary: () => {
            // 直接绑定到导入逻辑（contract），不再 navigate+点按钮这种脆弱 hack
            closeDrawer();
            triggerFileImport();
        },
        onCreateLibrary: () => {
            // 在左侧菜单直接新建空题库：prompt 输入名 → 创建 → 切换 → 跳去添加题目
            closeDrawer();
            const name = appPrompt('请输入新题库名称：', '我的题库');
            if (name == null) return; // 用户取消
            const trimmed = String(name).trim();
            if (!trimmed) {
                toastWarning('题库名不能为空');
                return;
            }
            const r = LX.LibraryAPI.create(trimmed, [], { skipDuplicateCheck: true });
            if (!r.ok) {
                toastWarning(`创建失败：${r.error?.message || '未知错误'}`);
                return;
            }
            LX.LibraryAPI.switch(r.data.id);
            toastSuccess(`已创建空题库「${trimmed}」，现在可以添加题目了`);
            navigate('add-question');
        },
        onDeleteLibrary: () => {
            closeDrawer();
            navigate('settings');
        },
        onExportLibrary: () => {
            closeDrawer();
            navigate('settings');
        },
        onExportProgress: () => {
            closeDrawer();
            navigate('settings');
        },
        onImportProgress: () => {
            closeDrawer();
            navigate('settings');
        },
        onResetProgress: () => {
            if (!appConfirm('确定要重置当前题库的所有学习进度吗？此操作不可撤销。')) return;
            const r = LX.ProgressAPI.reset();
            if (r.ok) {
                toastInfo('进度已重置');
                closeDrawer();
            }
        },
        onAbout: () => {
            closeDrawer();
            navigate('settings');
        },
        onHelp: () => {
            closeDrawer();
            navigate('help');
        },
    });
}
