/**
 * help.js — 使用帮助页
 * 设计：移动优先、卡片式分章节、可扫读；手势用 emoji + 文字图示
 * 入口：左侧抽屉「更多」→ 使用帮助；设置「关于」→ 查看帮助；首页空状态
 * @module render/pages/help
 */

import { h, render } from '../dom.js';
import { navigate } from '../router.js';
import { createLogo } from '../logo.js';

/* ---------- 小工具：构造一个章节卡片 ---------- */
function section(icon, title, children) {
    return h('div', { class: 'lx-card', style: { marginBottom: '12px' } }, [
        h('div', {
            class: 'lx-text-base lx-font-semibold',
            style: { marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' },
        }, [`${icon} ${title}`]),
        ...children,
    ]);
}

/* ---------- 小工具：一行说明（左标签 + 右内容） ---------- */
function row(label, content) {
    return h('div', {
        style: {
            display: 'flex',
            gap: '10px',
            padding: '8px 0',
            borderBottom: '1px solid var(--lx-border-light)',
            alignItems: 'flex-start',
        },
    }, [
        h('span', {
            class: 'lx-text-sm lx-font-medium',
            style: { flex: '0 0 72px', color: 'var(--lx-text)' },
        }, [label]),
        h('span', {
            class: 'lx-text-sm',
            style: { flex: 1, color: 'var(--lx-text-muted)', lineHeight: '1.6' },
        }, Array.isArray(content) ? content : [content]),
    ]);
}

/* ---------- 小工具：步骤（数字圆 + 内容） ---------- */
function step(n, title, desc) {
    return h('div', {
        style: { display: 'flex', gap: '12px', padding: '10px 0', alignItems: 'flex-start' },
    }, [
        h('div', {
            style: {
                flex: '0 0 28px', width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--lx-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 700,
            },
        }, [String(n)]),
        h('div', { style: { flex: 1 } }, [
            h('div', { class: 'lx-font-medium lx-text-base' }, [title]),
            h('div', { class: 'lx-text-sm lx-text-muted', style: { marginTop: '2px', lineHeight: '1.6' } }, [desc]),
        ]),
    ]);
}

/* ---------- 小工具：手势图示行 ---------- */
function gesture(arrow, action, desc) {
    return h('div', {
        style: {
            display: 'flex', gap: '12px', padding: '10px 0',
            alignItems: 'center', borderBottom: '1px solid var(--lx-border-light)',
        },
    }, [
        h('span', {
            style: {
                flex: '0 0 44px', fontSize: '22px', textAlign: 'center',
                color: 'var(--lx-primary)', fontWeight: 700,
            },
        }, [arrow]),
        h('div', { style: { flex: 1 } }, [
            h('div', { class: 'lx-text-sm lx-font-medium' }, [action]),
            h('div', { class: 'lx-text-xs lx-text-muted', style: { marginTop: '1px' } }, [desc]),
        ]),
    ]);
}

export function createHelpPage() {
    let _container = null;

    function renderPage(container) {
        _container = container;
        refresh();
    }

    function refresh() {
        if (!_container) return;

        const elements = [];

        // 顶部欢迎条
        elements.push(h('div', {
            class: 'lx-card',
            style: {
                marginBottom: '12px', textAlign: 'center',
                background: 'var(--lx-primary-light)',
            },
        }, [
            h('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: '8px' } }, [
                createLogo({ size: 48 }),
            ]),
            h('div', { class: 'lx-text-lg lx-font-semibold' }, ['刷题器 · 使用帮助']),
            h('div', { class: 'lx-text-xs lx-text-muted', style: { marginTop: '4px' } }, [
                '几分钟看懂全部操作',
            ]),
        ]));

        // 1. 快速上手
        elements.push(section('🚀', '快速上手', [
            step(1, '导入题库',
                '点左上角 ☰ 打开菜单 →「上传新题库」，选择 xlsx/json/csv/txt 文件；或在「设置 → 题库管理」上传。'),
            step(2, '开始刷题',
                '首页选中题库后点「▶ 开始学习」，进入答题页即可作答。'),
            step(3, '标记进度',
                '答完用底部按钮或手势标记「已掌握 / 错题」，掌握率会自动累计。'),
            h('div', { style: { marginTop: '10px' } }, [
                h('button', {
                    class: 'lx-button lx-button--primary lx-button--block',
                    onclick: () => navigate('study'),
                }, ['▶ 去刷题']),
            ]),
        ]));

        // 2. 答题手势（移动端）
        elements.push(section('👆', '答题手势（手机/平板）', [
            gesture('←', '上一题', '在题目上向右滑动（>50px），上一题循环到序列末尾'),
            gesture('→', '下一题', '在题目上向左滑动（>50px）'),
            gesture('↑', '标记掌握', '向上滑动（>80px），加入已掌握'),
            gesture('↓', '标记错题', '向下滑动（>80px），加入错题本'),
            h('div', {
                class: 'lx-text-xs lx-text-light',
                style: { marginTop: '8px', lineHeight: '1.6' },
            }, [
                '💡 桌面端可用键盘 ← → 切换题目；输入框内按方向键不会跳题。',
            ]),
        ]));

        // 3. 答题操作
        elements.push(section('✍️', '答题操作', [
            row('单选题', '点选项即选，再点「确认答案」提交（手机无回车键，需显式确认）。'),
            row('多选题', '依次点多个选项（再次点击取消），点「确认答案」提交。'),
            row('填空题', '在输入框填写，点「确认答案」提交。'),
            row('简答题', '写完点「确认答案」；参考答案会展开供对照。简答题不自动判对错，可手动添加答案。'),
            row('底部栏', '上一题 / 目录 / 下一题 三键；另可一键标记掌握、错题、重置当前题。'),
        ]));

        // 4. 目录页
        elements.push(section('📑', '目录页（题目级操作）', [
            row('题目列表', '底部「目录」按钮进入，浏览全部题目并跳转。'),
            row('分类筛选', '按章节/分类过滤题目，专注薄弱板块。'),
            row('随机模式', '开启后一次性洗牌生成固定序列，按序列顺序刷题。'),
            row('添加题目', '在目录页「＋ 添加题目」可手写补充自定义题（含简答参考答案）。'),
            row('刷新', '重置列表视图与筛选状态。'),
        ]));

        // 5. 左侧菜单（题库级）
        elements.push(section('☰', '左侧菜单（题库级操作）', [
            row('切换题库', '点击列表中的题库即可切换，自动记忆上次使用的题库。'),
            row('上传新题库', '从文件导入（xlsx/json/csv/txt）。'),
            row('新建空题库', '手动建库后去「添加题目」逐题录入。'),
            row('删除当前', '删除题库及其进度，不可撤销。'),
            row('导出题库', '导出为 JSON / Excel / CSV，方便分享或备份。'),
            row('备份/恢复进度', '把学习进度单独导出为 json，换设备时恢复。'),
            row('重置进度', '清空当前题库的所有掌握/错题标记。'),
        ]));

        // 6. 主题与模式
        elements.push(section('🎨', '主题与显示模式', [
            row('色主题', '11 种主色（红橙黄绿青蓝紫…含渐变与彩虹），仅影响按钮/链接/进度条主色。'),
            row('普通模式', '浅色白底，恒为浅色，不受系统深色设置影响。'),
            row('夜间模式', '深色护眼，适合暗光环境。'),
            row('护眼模式', '米黄纸色，降低对比度缓解疲劳。'),
            row('组合', '色主题与显示模式可任意搭配，如「绿色 + 夜间」。设置入口：设置 → 主题色 / 显示模式。'),
        ]));

        // 7. 数据安全
        elements.push(section('🔒', '数据安全', [
            row('本地存储', '所有数据保存在浏览器本地（localStorage），不上云、不联网，离线可用。'),
            row('换设备', '换设备/清浏览器缓存会丢数据，请提前用「备份进度」导出。'),
            row('多题库', '可同时保留多个题库，互不影响；进度随题库独立保存。'),
        ]));

        // 8. 常见问题
        elements.push(section('❓', '常见问题', [
            row('刷新后题库没了？',
                '应用会自动恢复上次题库；若仍为空，去「设置 → 题库管理」重新选择。'),
            row('导入报错？',
                '请检查文件格式；Excel 需含 question/options/answer 列，可先「下载导入模板」对照。'),
            row('简答题怎么算分？',
                '简答题不自动判对错，仅在已有参考答案时提示；可手动添加答案后对照。'),
            row('手势不灵？',
                '滑动需在题目卡片区域、距离足够（>50/80px）；输入框内滑动不触发切题。'),
        ]));

        // 底部操作
        elements.push(h('div', {
            class: 'lx-flex lx-gap-2',
            style: { marginTop: '4px', marginBottom: '16px' },
        }, [
            h('button', {
                class: 'lx-button lx-button--secondary lx-button--block',
                onclick: () => navigate('settings'),
            }, ['⚙️ 前往设置']),
            h('button', {
                class: 'lx-button lx-button--primary lx-button--block',
                onclick: () => navigate('study'),
            }, ['▶ 开始刷题']),
        ]));

        render(_container, elements);
    }

    return {
        render: renderPage,
        onLeave() {},
    };
}
