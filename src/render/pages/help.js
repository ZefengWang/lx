/**
 * help.js — 使用帮助页
 * 设计：移动优先、卡片式分章节、可扫读；手势用 emoji + 文字图示
 * 入口：左侧抽屉「更多」→ 使用帮助；设置「关于」→ 查看帮助；首页空状态
 * 支持 openHelpSection(id)：跳转后滚动并高亮闪烁目标章节
 * @module render/pages/help
 */

import { h, render } from '../dom.js';
import { navigate } from '../router.js';
import { createLogo } from '../logo.js';

/** @type {string|null} */
let _pendingSection = null;
/** @type {Array<{ id: string, at: number }>} */
let _highlightLogForTest = [];
/** @type {ReturnType<typeof setTimeout>|null} */
let _flashTimer = null;

/**
 * 打开帮助并高亮指定章节（供其它页「查看完整说明」）
 * @param {string} sectionId 如 'practice-mode'
 */
export function openHelpSection(sectionId) {
    _pendingSection = String(sectionId || '').trim() || null;
    navigate('help');
}

/** 【仅测试用】 */
export function __getHighlightLogForTest() {
    return _highlightLogForTest.slice();
}

/** 【仅测试用】 */
export function __clearHighlightLogForTest() {
    _highlightLogForTest = [];
}

/** 【仅测试用】直接对当前已渲染帮助页触发高亮（不 navigate） */
export function __highlightSectionForTest(sectionId) {
    return highlightSectionIn(document, sectionId);
}

/**
 * @param {ParentNode|null} root
 * @param {string} sectionId
 * @returns {boolean}
 */
function highlightSectionIn(root, sectionId) {
    if (!root || !sectionId) return false;
    const el = root.querySelector(`[data-help-section="${sectionId}"]`);
    if (!el) return false;
    _highlightLogForTest.push({ id: sectionId, at: Date.now() });
    if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    el.classList.remove('lx-help-flash');
    // 强制重启动画
    void el.offsetWidth;
    el.classList.add('lx-help-flash');
    if (_flashTimer) clearTimeout(_flashTimer);
    _flashTimer = setTimeout(() => {
        el.classList.remove('lx-help-flash');
        _flashTimer = null;
    }, 1600);
    return true;
}

/* ---------- 小工具：构造一个章节卡片 ---------- */
function section(icon, title, children, opts = {}) {
    const id = opts.id ? String(opts.id) : '';
    return h('div', {
        class: 'lx-card',
        style: { marginBottom: '12px' },
        ...(id ? { id: `lx-help-${id}`, 'data-help-section': id } : {}),
    }, [
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
            h('div', {
                class: 'lx-text-xs lx-text-muted',
                style: { marginTop: '10px', lineHeight: '1.6' },
            }, [
                '💡 第一次用？可以在首页空状态或「设置 → 题库管理」点「加载示例题库」体验（10 个学科分类、50 题、5 种题型全覆盖）。',
            ]),
            h('div', { style: { marginTop: '10px' } }, [
                h('button', {
                    class: 'lx-button lx-button--secondary lx-button--block',
                    onclick: () => navigate('study'),
                }, ['▶ 去刷题']),
            ]),
        ], { id: 'quick-start' }));

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
        ], { id: 'gestures' }));

        // 3. 答题操作
        elements.push(section('✍️', '答题操作', [
            row('单选题', '点选项即选，再点「确认答案」提交（手机无回车键，需显式确认）。'),
            row('多选题', '依次点多个选项（再次点击取消），点「确认答案」提交。'),
            row('填空题', '在输入框填写，点「确认答案」提交。'),
            row('简答题', '写完点「确认答案」；参考答案会展开供对照。简答题不自动判对错，可手动添加答案。'),
            row('底部栏', '上一题 / 浏览 / 下一题 三键；另可一键标记掌握、错题、重置当前题。'),
        ], { id: 'answer' }));

        // 4. 浏览页
        elements.push(section('📑', '浏览页（题目级操作）', [
            row('题目列表', '底部「浏览」进入，查看全部题目并跳转。'),
            row('搜索题干', '输入后点「搜索」；可连续加关键字收窄（AND）。命中显示为「过滤标签」，点 × 可去掉；提交后输入框会清空便于继续输入。结果过多时向下滚动自动加载。离开再回来会保留过滤标签。'),
            row('只练本类 + 搜索', '若已点「只练本类」，搜索只在该类题目里过滤（不是全库）。清除分类后恢复全库搜索。'),
            row('点进结果', '从搜索结果点进某题后，刷题上下翻只在当前搜索命中内循环；关光过滤标签即退出该范围；「只练本类」上下文会保留。'),
            row('分类筛选', '按章节/分类过滤题目；「只练本类」只刷该分类。'),
            row('顺序/随机', '工具条切换顺序或随机；随机可「换一批」重洗。'),
            row('新增题目', '标题行右侧「新增」可手写补充题目。'),
        ], { id: 'browse' }));

        // 4b. 练习模式
        elements.push(section('⚡', '练习模式（快速刷题 / 背诵记忆）', [
            row('入口', '浏览页点「练习模式」；默认「背诵记忆」（不限题量）；可改选「快速刷题」并填写本轮题量后点「开始练习」。旁的「?」可看简要说明。'),
            row('选题', '优先从未标记（未开始）的题中抽；不够再从已标记题补齐。'),
            row('快速刷题', '答对马上下一题；答错停留约 5 秒再下一题（也可手动下一题）。'),
            row('背诵记忆', '答完停在当前题，下一题需自己点「下一题」或滑动；题量不限。'),
            row('回看', '「上一题」可查看刚做过的题的答案与自己的作答；再「下一题」回到当前进度。'),
        ], { id: 'practice-mode' }));

        // 5. 左侧菜单（题库级）
        elements.push(section('☰', '左侧菜单（题库级操作）', [
            row('切换题库', '点击列表中的题库即可切换，自动记忆上次使用的题库。'),
            row('上传新题库', '从文件导入（xlsx/json/csv/txt）。'),
            row('新建空题库', '手动建库后去「添加题目」逐题录入。'),
            row('删除当前', '删除题库及其进度，不可撤销。'),
            row('导出题库', '导出为 JSON / Excel / CSV，方便分享或备份。'),
            row('备份/恢复进度', '把学习进度单独导出为 json，换设备时恢复。'),
            row('重置进度', '清空当前题库的所有掌握/错题标记。'),
        ], { id: 'drawer' }));

        // 6. 主题与模式
        elements.push(section('🎨', '主题与显示模式', [
            row('色主题', '11 种主色（红橙黄绿青蓝紫…含渐变与彩虹），仅影响按钮/链接/进度条主色。'),
            row('普通模式', '浅色白底，恒为浅色，不受系统深色设置影响。'),
            row('夜间模式', '深色护眼，适合暗光环境。'),
            row('护眼模式', '米黄纸色，降低对比度缓解疲劳。'),
            row('组合', '色主题与显示模式可任意搭配，如「绿色 + 夜间」。设置入口：设置 → 主题色 / 显示模式。'),
        ], { id: 'theme' }));

        // 7. 数据安全
        elements.push(section('🔒', '数据安全', [
            row('本地存储', '所有数据保存在浏览器本地（localStorage），不上云、不联网，离线可用。'),
            row('加到主屏幕 / 离线', '支持安装为 PWA：浏览器菜单选「添加到主屏幕」后可像 App 打开；壳资源与题库数据可离线刷题（题库仍存 localStorage，清缓存会丢）。'),
            row('换设备', '换设备/清浏览器缓存会丢数据，请提前用「备份进度」导出。'),
            row('多题库', '可同时保留多个题库，互不影响；进度随题库独立保存。'),
        ], { id: 'privacy' }));

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
        ], { id: 'faq' }));

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

        const pending = _pendingSection;
        _pendingSection = null;
        if (pending) {
            // 等 DOM 挂上再滚
            requestAnimationFrame(() => {
                highlightSectionIn(_container, pending);
            });
        }
    }

    return {
        render: renderPage,
        onLeave() {
            if (_flashTimer) {
                clearTimeout(_flashTimer);
                _flashTimer = null;
            }
        },
    };
}
