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
import { createCatalogPage } from './pages/catalog.js';
import { createAddQuestionPage } from './pages/add-question.js';
import { createHelpPage } from './pages/help.js';
import { applyInitial as applyInitialTheme } from './theme.js';
import { toastInfo, toastSuccess, toastWarning } from './toast.js';

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
    register('catalog',  '#/catalog',     () => createCatalogPage());
    register('add-question', '#/add-question', () => createAddQuestionPage());
    register('help',     '#/help',        () => createHelpPage());

    // 3. 启动路由
    startRouter($('#lx-main'), (routeName) => {
        refreshTopbar();
        refreshBottombar(routeName);
        refreshDrawer();
    });

    // 4. 事件订阅：核心状态变化 → 重渲染顶栏
    [
        LX.Events.LIBRARY_SWITCHED,
        LX.Events.LIBRARY_CREATED,
        LX.Events.LIBRARY_DELETED,
        LX.Events.QUESTION_STATUS_CHANGED,
        LX.Events.NAVIGATION_CHANGED,
        LX.Events.PROGRESS_UPDATED,
        LX.Events.WRONGBOOK_ENTERED,
        LX.Events.WRONGBOOK_EXITED,
    ].forEach((evt) => {
        LX.on(evt, () => {
            refreshTopbar();
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
    const statusR = q ? LX.ProgressAPI.getStatus(q) : { ok: false };
    const status = statusR.ok ? statusR.data : 'pending';

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
            onReset: () => {
                if (!q) return;
                if (status === 'pending') {
                    toastInfo('当前题目尚未开始');
                    return;
                }
                LX.ProgressAPI.setStatus(q, 'pending');
            },
            onMastered: () => {
                if (!q) return;
                LX.ProgressAPI.setStatus(q, status === 'mastered' ? 'pending' : 'mastered');
            },
            onWrong: () => {
                if (!q) return;
                LX.ProgressAPI.setStatus(q, status === 'review' ? 'pending' : 'review');
            },
            onPrev: () => LX.NavigationAPI.prev(),
            onCatalog: () => {
                // BUG-007 修复：目录按钮应该跳到题目目录页（catalog），
                // 而不是 settings 页（用户在那里会迷路）
                navigate('catalog');
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
            closeDrawer();
            navigate('settings');
            setTimeout(() => {
                const btn = $('.lx-button--primary');
                if (btn) btn.click();
            }, 100);
        },
        onCreateLibrary: () => {
            // 在左侧菜单直接新建空题库：prompt 输入名 → 创建 → 切换 → 跳去添加题目
            closeDrawer();
            const name = window.prompt('请输入新题库名称：', '我的题库');
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
            if (!confirm('确定要重置当前题库的所有学习进度吗？此操作不可撤销。')) return;
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
