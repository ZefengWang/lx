# 刷题器（lx）移动端设计文档

> **版本**：v1.1（对齐产品现状）
> **更新**：2026-08-10
> **产品版本**：3.1.0（以 `version.txt` / `LX.VERSION` 为准）
> **核心约束**：移动端优先 · 纯静态部署（GitHub Pages）· 零后端 · localStorage
> **目标设备优先级**：手机竖屏 > 手机横屏 ≈ 平板 > 桌面
> **详设外链**：搜索 [`docs/FEATURE-search.md`](docs/FEATURE-search.md) · Drill [`docs/FEATURE-drill.md`](docs/FEATURE-drill.md) · 维护 [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md)

---

## 〇、文档状态与产品现状（v1.1）

本文早期按「单屏刷题 + 抽屉」愿景撰写。落地后产品形态与若干条目已分叉；**以本节与各章「现状」注记为准**，未勾验收项≠仍要做。

### 0.1 已落地（DESIGN 原文未写或写不全）

| 能力 | 说明 |
|------|------|
| 三层架构 + `window.LX` | `core` → `api` → `render`；入口 `app.html`（`index.html` 仅跳转） |
| Hash 多页 SPA | `#/home|study|wrong|catalog|stats|settings|add|help` + 底栏；抽屉为辅助，非唯一信息架构 |
| DrillAPI | 目录「练习模式」：快速刷题 / 背诵记忆（见 FEATURE-drill） |
| 题干搜索 v1.2 | 有序 AND 过滤链 + 多过滤标签；`limit`/`offset` 触底续载（见 FEATURE-search） |
| 错题本 | `WrongBookAPI` + 错题页；答对移出、清空庆祝等 |
| 导入导出基线 | `IOAPI` parse/import/export、模板、指纹查重；设置页 toast 反馈 |
| 主题 / 帮助 | 多主题色；用户可见能力须同步 `help.js`（项目红线） |
| 测试台 | `test.html` + unit/ui/system；GitHub Actions + Playwright E2E（§0.4 / `e2e/`） |

### 0.2 有意分叉（不按原文强追）

| 原文 | 现状决策 |
|------|----------|
| ≥1024 双列、抽屉右侧常驻 | **抽屉仍按需滑出、不常驻**（见 `components.css`） |
| 筛选/IO 全收进抽屉 | **设置/目录/统计/帮助独立成页**；抽屉保留常用入口即可 |
| 单体 `app.js` / `index.html` 真入口 | **模块化 + `app.html` 唯一真入口** |

### 0.3 明确不做（Won’t do）

以下原文章节保留示意时，一律视为**已否决**，不再排期：

- 长按题目菜单（复制/编辑/分享）
- 双指捏合改字号
- 打印 PDF
- 多选答错后独立「重做」按钮（沿用重置/再答即可）
- 目录虚拟滚动（>100 项）；用搜索 + 触底续载替代
- 完整导入预览模态（分类/题型分布、样题列表、转 Excel 大弹窗）——**保持现状：解析后 toast + 直接入库**；警告/失败走现有解析反馈

### 0.4 已落地 / Backlog

| 项 | 状态 | 说明 |
|----|------|------|
| **PWA** | **已落地** | `manifest.json` + `sw.js` + `icon-192/512.png`；`app.html` 注册 SW；帮助页说明加主屏/离线 |
| **GitHub Actions + Playwright E2E** | **已落地** | `.github/workflows/test.yml` + `e2e/` 烟雾；`package.json` 仅 `devDependencies`（零运行时 npm） |
| **应用预览台** | **已落地** | `test.html` 可折叠 iframe → `app.html`（见 `docs/TESTING.md` §0.1） |
| **PC 增强**（§二十一） | **Backlog（非阻塞）** | 目标：`Ctrl+K` 命令面板、完整快捷键（Space/M/R/Esc 等）、`?dev=1` 状态条。方向键翻题/标记**已有**；浏览页搜索已能搜题跳转。移动优先产品不依赖桌面命令面板，**不阻塞**发版与其它项 |

**仍非必须**：

- 导入后「轻量确认」：仅成功/警告/失败计数再点确认（非 §8.3 全量预览）

---

## 一、设计目标

把臃肿界面收成**移动端单手可操作**的极简卡片流；并在多页 SPA 下保持刷题主屏焦点清晰。

| 指标 | 早期现状 | 目标 / 现状 |
|------|----------|-------------|
| 主屏可交互元素数 | ~40 | ≤ 8（刷题页） |
| 首屏视觉中心 | 工具栏密集 | 题目卡片 |
| 单手可达性 | 低 | 高（核心操作在底部） |
| 移动端首屏完整度 | 需滚动 | 一屏看完（刷题页） |
| 离线可用 | 否 | **PWA 已落地**（§0.4 / §十；题库仍靠 localStorage） |

---

## 二、设计原则

1. **移动端优先（Mobile First）**：所有布局先按 375px 宽设计，再向上适配大屏。
2. **拇指法则**：高频操作放在屏幕底部 1/3 区域，单手拇指可达。
3. **渐进披露**：L1 主操作常驻，L2 次操作收进顶栏，L3 偶发操作收进抽屉。
4. **一屏一焦点**：刷题主屏只突出"当前题目"，其余元素弱化。
5. **触觉优先**：所有交互元素 ≥ 44×44px（iOS HIG）/ 48×48dp（Material）。
6. **离线即用**：核心刷题流程在断网下完整可用。
7. **零后端**：数据全部 localStorage，跨设备靠导入导出。

---

## 三、设备适配策略

### 3.1 断点系统

采用与 Tailwind 一致的断点，便于记忆：

| 断点 | 宽度 | 目标设备 | 布局策略 |
|------|------|---------|---------|
| `xs`（默认） | < 640px | 手机竖屏 | 单列布局，底部固定操作区 |
| `sm` | ≥ 640px | 手机横屏 / 小平板竖屏 | 单列，卡片加宽，底部操作区可双行 |
| `md` | ≥ 768px | 平板竖屏 | 单列居中（max-width 600px），两侧留白 |
| `lg` | ≥ 1024px | 平板横屏 / 小桌面 | 单列加宽居中；抽屉**按需滑出（不常驻）** |
| `xl` | ≥ 1280px | 桌面 | 内容区 max-width 居中；抽屉仍按需滑出 |

```css
/* 默认移动端样式，再用 min-width 媒体查询向上适配 */
.container { width: 100%; padding: 0 12px; }
@media (min-width: 640px)  { .container { padding: 0 16px; } }
@media (min-width: 768px)  { .container { max-width: 600px; margin: 0 auto; } }
@media (min-width: 1024px) { .container { max-width: 1100px; } }
```

### 3.2 各设备目标

#### 手机竖屏（375×667 ~ 430×932，主流）

- **第一设计目标**。所有功能在此可用。
- 顶栏 56px，底部操作区 88px，卡片占满中间。
- 抽屉从左侧滑入，宽度 = 屏宽 - 56px（不遮全屏，保留主界面可见）。
- 单手握持下，拇指自然落点在屏幕下方 1/3。

#### 手机横屏（667×375 ~ 932×430）

- 卡片高度受限，题目可滚动。
- 顶部 48px，底部操作区 72px。
- 抽屉宽度 = 屏宽 × 60%。
- 提示用户竖屏体验更佳（非强制）。

#### 平板竖屏（768×1024 ~ 834×1194）

- 内容居中，max-width 600px，两侧留白。
- 字号可适当放大（题目 20px → 22px）。
- 底部操作区可加宽到全宽内的 480px 居中。

#### 平板横屏 / 桌面（≥ 1024px）

- **现状**：内容加宽居中；抽屉与移动端一致，**按需滑出、不常驻**（否决「左卡右抽屉双列常驻」）。
- 桌面已支持方向键翻题 / 上下标记；完整快捷键 / 命令面板 / `?dev=1` 见 §0.4 / §二十一（**Backlog · 非阻塞**）。
- 鼠标 hover 状态可增强，非阻塞项。

### 3.3 安全区域适配

iOS 刘海屏 / 底部 Home Indicator：

```css
.app-container {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
}
```

viewport meta（已在 [index.html:5](file:///home/w/proj/software/lx/index.html#L5)）：
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

`viewport-fit=cover` 是关键，配合 `env(safe-area-inset-*)` 才能让内容延伸到安全区外。

---

## 四、视觉系统

### 4.1 颜色系统

```css
:root {
    /* 中性色 */
    --color-bg:           #f8fafc;   /* 页面背景 */
    --color-surface:      #ffffff;   /* 卡片背景 */
    --color-surface-alt:  #f1f5f9;   /* 次级背景 */
    --color-border:       #e2e8f0;   /* 边框 */
    --color-border-light: #f1f5f9;   /* 轻边框 */

    /* 文字 */
    --color-text:         #0f172a;   /* 主文字 */
    --color-text-muted:   #64748b;   /* 次文字 */
    --color-text-light:   #94a3b8;   /* 辅助文字 */

    /* 主色 */
    --color-primary:      #4f46e5;   /* 主品牌色（紫） */
    --color-primary-light:#eef2ff;   /* 主色浅底 */

    /* 状态色 */
    --color-success:      #16a34a;   /* 已掌握（绿） */
    --color-success-light:#dcfce7;
    --color-warning:      #ea580c;   /* 错题（橙） */
    --color-warning-light:#fed7aa;
    --color-danger:       #dc2626;   /* 错误（红） */
    --color-info:         #0284c7;   /* 信息（蓝） */

    /* 阴影 */
    --shadow-sm:  0 1px 2px rgba(0,0,0,0.04);
    --shadow-md:  0 4px 12px rgba(0,0,0,0.08);
    --shadow-lg:  0 20px 60px rgba(0,0,0,0.10);
}
```

**主色策略**：紫 `#4f46e5`（保留原品牌色），仅用于：主按钮、链接、focus 态、进度条。**不**大面积铺色。

**状态色语义**：
- 绿 = 已掌握
- 橙 = 错题/待复习
- 红 = 答错（瞬时反馈）
- 灰 = 未开始

### 4.2 字号系统

移动端字号比桌面稍大，确保可读性：

| Token | 字号 | 行高 | 用途 |
|-------|------|------|------|
| `text-xs` | 12px | 1.4 | 角标、辅助提示 |
| `text-sm` | 13px | 1.5 | 次要文字、徽章 |
| `text-base` | 15px | 1.6 | 正文（按钮、列表） |
| `text-lg` | 17px | 1.6 | 题目内容（小屏） |
| `text-xl` | 19px | 1.7 | 题目内容（大屏） |
| `text-2xl` | 22px | 1.3 | 标题 |
| `text-3xl` | 28px | 1.2 | 错题清空庆祝 |

```css
.card-question {
    font-size: 17px;
    line-height: 1.7;
}
@media (min-width: 768px) {
    .card-question { font-size: 19px; }
}
```

### 4.3 间距系统

采用 4px 基准网格：

| Token | 值 | 用途 |
|-------|-----|------|
| `space-1` | 4px | 紧凑间距 |
| `space-2` | 8px | 默认小间距 |
| `space-3` | 12px | 卡片内边距 |
| `space-4` | 16px | 区块间距 |
| `space-6` | 24px | 卡片大边距 |
| `space-8` | 32px | 区块大间距 |

### 4.4 圆角

```css
:root {
    --radius-sm:  8px;   /* 小按钮、徽章 */
    --radius-md:  12px;  /* 选项卡片 */
    --radius-lg:  16px;  /* 模态框 */
    --radius-xl:  24px;  /* 主卡片 */
    --radius-full: 9999px; /* 圆形按钮 */
}
```

### 4.5 阴影层级

```css
.card        { box-shadow: var(--shadow-sm); }
.card.elevated { box-shadow: var(--shadow-md); }
.modal       { box-shadow: var(--shadow-lg); }
```

---

## 五、触摸交互规范

### 5.1 触摸目标尺寸

| 元素 | 最小尺寸 | 推荐 |
|------|---------|------|
| 主要按钮 | 44×44px | 48×48px |
| 列表项 | 44px 高 | 56px 高 |
| 选项卡片 | 44px 高 | 56px 高 |
| 图标按钮 | 44×44px | 48×48px |
| 底部操作按钮 | 56px 高 | 64px 高 |

### 5.2 手势设计

| 手势 | 作用 | 触发阈值 |
|------|------|---------|
| 左滑（>50px） | 下一题 | 水平位移 >50px 且 > 垂直位移 |
| 右滑（>50px） | 上一题 | 同上 |
| 上滑（>80px） | 标记掌握 | 垂直位移 >80px 且 > 水平位移 |
| 下滑（>80px） | 加入错题 | 同上 |
| ~~长按题目~~ | ~~操作菜单~~ | **Won’t do**（§0.3） |
| ~~双指捏合~~ | ~~改字号~~ | **Won’t do**（§0.3） |

**现状**：四向滑动 + 方向键已在 `gestures.js` 落地。编辑/复制走页面内既有入口，不增加长按菜单。

### 5.3 触摸反馈

- `:active` 态：缩放至 0.96，过渡 100ms
- 选项点击：边框色 + 背景色变化（已有）
- 长按：`-webkit-tap-highlight-color: transparent` + 自定义 ripple（可选）
- 防误触：滑动检测中阻止 `click` 事件（避免滑动后误触发选项点击）

```css
.button, .option-item {
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.1s, background 0.15s;
}
.button:active, .option-item:active {
    transform: scale(0.96);
}
```

### 5.4 滚动行为

- 卡片内容超出时，卡片内部滚动（`overflow-y: auto`）
- 抽屉、模态框内部滚动，背景固定（`position: fixed` 锁定 body）
- 滚动惯性：`-webkit-overflow-scrolling: touch`（旧 iOS）
- 隐藏滚动条：`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`

### 5.5 输入框键盘适配

- 输入框聚焦时，键盘弹起可能遮挡 → 用 `Element.scrollIntoView({ block: 'center' })`
- `inputmode` 属性优化键盘类型：
  ```html
  <input inputmode="text">      <!-- 简答 -->
  <input inputmode="search">    <!-- 搜索 -->
  <input inputmode="numeric">   <!-- 数字 -->
  ```
- `enterkeyhint` 属性优化回车键文案：
  ```html
  <input enterkeyhint="done">
  <input enterkeyhint="next">
  <input enterkeyhint="search">
  ```

---

## 六、主界面布局

### 6.1 手机竖屏（默认目标）

```
┌─────────────────────────────────┐
│ ☰  📚 教育学        📕 5  23/156 │ ← 顶栏 56px
├─────────────────────────────────┤
│                                 │
│  #42  单选题          ✅ 已掌握  │ ← 状态徽章
│                                 │
│  下列哪项属于建构主义学习理论？  │
│                                 │
│  ┌─────────────────────────┐   │
│  │ A. 强化理论              │   │
│  ├─────────────────────────┤   │
│  │ B. 意义建构              │   │
│  ├─────────────────────────┤   │
│  │ C. 试误说                │   │
│  ├─────────────────────────┤   │
│  │ D. 联结主义              │   │
│  └─────────────────────────┘   │
│                                 │
│  ───────────────────            │ ← 折叠线
│  💡 点按查看解析                │
│                                 │
├─────────────────────────────────┤
│  ↩ 重置    ✅ 掌握    📕 错题   │ ← 状态三键 44px
├─────────────────────────────────┤
│  ◀ 上一题   📋 目录   ▶ 下一题 │ ← 导航三键 44px
└─────────────────────────────────┘
        ↑ 底部操作区 88px + safe-area
```

**核心改动**：
1. 顶栏从两行 → 一行：题库名 + 错题角标 + 进度文字
2. 统计圆环取消，改文字 `23/156`
3. 状态徽章移到卡片右上角
4. 答案/备注/解析合并为折叠面板
5. 底部 6 个按钮分两行（状态 + 导航），所有按钮全宽均分
6. filter bar 移到抽屉里

### 6.2 手机横屏

```
┌──────────────────────────────────────────────────────┐
│ ☰  📚 教育学                              📕 5  23/156│
├──────────────────────────────────────────────────────┤
│ #42 单选  ✅  下列哪项属于建构主义学习理论？ A.xxx B. │
│                                                      │
├──────────────────────────────────────────────────────┤
│  ↩ 重置   ✅ 掌握   📕 错题   ◀ 上题  📋 目录  ▶ 下题│
└──────────────────────────────────────────────────────┘
```

横屏高度有限，按钮单行排列，卡片内容横向滚动。

### 6.3 平板（≥ 768px）

```
┌──────────────────────────────────────────┐
│              ┌────────────────────┐      │
│              │ ☰ 📚 教育学  📕5 23/156│      │ ← 居中 600px
│              ├────────────────────┤      │
│              │                    │      │
│              │   题目卡片          │      │
│              │                    │      │
│              ├────────────────────┤      │
│              │  底部操作区         │      │
│              └────────────────────┘      │
└──────────────────────────────────────────┘
```

居中 600px，两侧留白，避免在大屏上拉得过宽难读。

### 6.4 桌面（≥ 1024px）

```
┌──────────────────────────────────────────────────────┐
│ ┌──────────────────────┐  ┌────────────────────┐    │
│ │ 主界面（卡片+操作）   │  │ 抽屉常驻            │    │
│ │                      │  │ - 题库管理          │    │
│ │                      │  │ - 筛选              │    │
│ │                      │  │ - 导入导出          │    │
│ │                      │  │ - 更多              │    │
│ └──────────────────────┘  └────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

桌面端抽屉不再需要点击 ☰ 展开，而是常驻在右侧。主界面与抽屉并排，避免移动抽屉的开合动作。

---

## 七、核心组件设计

### 7.1 顶栏（TopBar）

```
┌─────────────────────────────────┐
│ ☰  📚 教育学        📕 5  23/156 │
└─────────────────────────────────┘
   ↑   ↑                ↑    ↑
   菜单 题库名（可点切换）  错题  进度
```

- 高度 56px（手机）/ 64px（桌面）
- ☰ 菜单按钮：48×48px 触摸区，点击展开左侧抽屉
- 📚 + 题库名：点击弹出题库切换下拉
- 📕 错题入口：带数字角标，错题数=0 时灰显
- 进度文字：`23/156` 已掌握数/总数，下方副行可选 `15%` 百分比

**触摸热区划分**：
- ☰：左 0-48px
- 题库名：48px-屏宽×60%
- 📕 + 进度：右 0-40%

### 7.2 题目卡片（Card）

```
┌─────────────────────────────────┐
│ #42  单选题          ✅ 已掌握  │
│                                 │
│ 下列哪项属于建构主义学习理论？  │
│                                 │
│ ┌─────────────────────────┐    │
│ │ A. 强化理论             │    │
│ ├─────────────────────────┤    │
│ │ B. 意义建构             │    │
│ ├─────────────────────────┤    │
│ │ C. 试误说               │    │
│ ├─────────────────────────┤    │
│ │ D. 联结主义             │    │
│ └─────────────────────────┘    │
│                                 │
│ ──── 点按展开解析 ────         │
└─────────────────────────────────┘
```

**卡片状态**（边框色 + 浅底色）：
- 默认：白底 + 浅灰边框
- 已掌握：浅绿底 + 绿边框
- 错题：浅橙底 + 橙边框

**卡片右上角状态徽章**：
- ✅ 已掌握（绿）
- 📕 错题（橙）
- ⏳ 未开始（灰）
- 点击徽章可循环切换状态（替代底部状态按钮的快捷方式）

### 7.3 简答题折叠面板

简答题没有选项，下方是答案/备注/解析的折叠面板：

```
┌─────────────────────────────────┐
│ 简述皮亚杰的认知发展阶段。      │
│                                 │
│ ┌─────────────────────────┐    │
│ │ [答案] [备注] [解析] ✏️ │    │ ← Tab 切换 + 编辑
│ ├─────────────────────────┤    │
│ │ 感知运动阶段（0-2岁）   │    │
│ │ 前运算阶段（2-7岁）     │    │
│ │ 具体运算阶段（7-11岁）  │    │
│ │ 形式运算阶段（11岁以上）│    │
│ └─────────────────────────┘    │
└─────────────────────────────────┘
```

- 默认折叠，显示一行 `💡 点按查看解析`
- 展开后显示三个 Tab，默认显示"解析"
- ✏️ 编辑按钮：弹模态框统一编辑三字段
- 当前 9 个按钮（增/改/显/隐/删 × 2字段）→ 2 个元素（Tab + 编辑）

### 7.4 底部操作区

手机竖屏分两行：

```
┌─────────────────────────────────┐
│  ↩ 重置    ✅ 掌握    📕 错题   │ ← 状态行
├─────────────────────────────────┤
│  ◀ 上一题   📋 目录   ▶ 下一题 │ ← 导航行
└─────────────────────────────────┘
```

- 每行 3 个按钮均分宽度
- 按钮高 44px（含上下 padding 共 56px 行高）
- 文字 + 图标组合，图标在文字上方（移动端更易识别）
- 状态行按钮强调视觉差异：重置（灰）/ 掌握（绿）/ 错题（橙）
- 导航行按钮统一中性色

**横向适配**：横屏 / 平板时合并为一行 6 按钮。

### 7.5 侧边抽屉（Drawer）

从左侧滑入：

```
         ┌──────────────────┐
         │ ✕ 关闭             │
         ├──────────────────┤
         │ 📚 题库管理        │
         │  • 教育学 ✓       │
         │  • 心理学          │
         │  + 上传新题库     │
         │  - 删除当前题库   │
         ├──────────────────┤
         │ 🎯 筛选            │
         │  分类：全部 ▾    │
         │  状态：全部 ▾    │
         │  模式：顺序 ▾    │
         │  🔀 洗牌          │
         ├──────────────────┤
         │ 📥 导入            │
         │  📁 从文件导入    │
         │  📋 从剪贴板粘贴  │
         │  📥 下载模板      │
         │  ⏬ 导入进度       │
         ├──────────────────┤
         │ 📤 导出            │
         │  📦 题库(JSON+XLSX)│
         │  💾 备份进度      │
         │  📋 复制进度      │
         ├──────────────────┤
         │ ⚙️ 更多            │
         │  ➕ 添加题目       │
         │  ✏️ 管理分类       │
         │  🗑️ 重置进度       │
         │  ❓ 帮助           │
         └──────────────────┘
```

> **现状注记**：导入/导出/主题等主路径在**设置页**；目录/练习模式在**目录页**。抽屉为导航辅助，不必镜像上图全部条目。打印 PDF 已否决（§0.3）。

**移动端行为**：
- 宽度 = `min(屏宽 - 56px, 320px)`，保留主界面右侧 56px 可见
- 背景半透明遮罩，点击关闭
- 滑动手势：抽屉打开时右滑关闭
- 锁定背景滚动（`body { overflow: hidden }`）

**桌面端行为**：
- 与移动端相同：**按需滑出**，不常驻、无双列固定分栏（§0.2）

### 7.6 模态框（Modal）

移动端模态框规范：

```
┌─────────────────────────────────┐
│  [背景遮罩 50% 黑]              │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 标题                ✕   │   │
│  ├─────────────────────────┤   │
│  │                         │   │
│  │  内容区（可滚动）        │   │
│  │                         │   │
│  ├─────────────────────────┤   │
│  │ [取消]      [确定]      │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

- 居中显示，宽度 `min(屏宽 - 32px, 480px)`
- 圆角 16px
- 最大高度 80vh，内容区滚动
- 底部按钮固定在模态框底部
- 点遮罩关闭（部分场景禁用，如确认对话框）

**底部弹起式（Action Sheet）**：
用于"选择动作"场景（如导出格式选择）：

```
┌─────────────────────────────────┐
│                                 │
│  [背景遮罩]                     │
│                                 │
├─────────────────────────────────┤
│  请选择导出格式                 │
├─────────────────────────────────┤
│  📦 JSON + Excel                │
├─────────────────────────────────┤
│  💾 仅 JSON                     │
├─────────────────────────────────┤
│  取消                           │
└─────────────────────────────────┘
```

从底部滑入，更适合单手操作。打印 PDF **Won’t do**（§0.3）。

---

## 八、各功能模块的移动端设计

### 8.1 题型渲染

#### 单选题

- 选项纵向排列，每项 56px 高，全宽
- 选项间用 1px 分隔线（而非 gap + 阴影），更紧凑
- 点击即判定，对错即时反馈

#### 多选题

- 选项带 checkbox 风格（左侧方框）
- 底部"确认答案"按钮全宽固定
- 答错后可保留可选状态；**不单独做「重做」按钮**（Won’t do，§0.3）——用重置/再答即可

#### 判断题

- 两个大按钮"✅ 对 / ❌ 错"，各占屏宽 50%
- 按钮高 64px，触摸友好

#### 填空题

- 输入框全宽，高 56px
- `enterkeyhint="done"` 优化回车键
- 确认按钮在输入框右侧

#### 简答题

- 题目下方折叠面板（见 7.3）
- 默认隐藏答案，鼓励先思考

### 8.2 错题专注模式

**现状**：独立错题页 / WrongBook 会话；能力已落地。线框中的「仅我会了/跳过」两键与「3/8 已清空」文案为早期示意，实现以当前 UI + API 为准（答对移出、清空庆祝等）。

**入口**：底栏 / 导航进入错题本（顶栏角标为可选增强）。

**模式特征**：进入后专注刷错题：

```
┌─────────────────────────────────┐
│ ✕ 退出      错题专注  3/8 已清空 │
├─────────────────────────────────┤
│                                 │
│  #57  单选题                    │
│                                 │
│  下列哪项属于...                │
│                                 │
│  A. xxx                         │
│  B. xxx                         │
│  ...                            │
│                                 │
├─────────────────────────────────┤
│  ✅ 我会了（移出错题本）         │
│  ➡ 跳过                        │
└─────────────────────────────────┘
```

**已落实的核心约束**：
1. **不修改 `statusFilter`**，错题会话与主筛选隔离
2. 答对可移出错题本；全部清空后有庆祝反馈
3. 上图两键布局 /「3/8 已清空」文案为早期线框，**不强制改 UI 去贴线框**；以现网错题页为准

### 8.3 导入反馈（原「导入预览」——已降级）

**决策（v1.1）**：不做完整预览模态（分类/题型分布、样题、转 Excel 大弹窗）。见 §0.3。

**现状流程**（设置页）：

1. 选文件 → `IOAPI.parseFile`
2. 失败 → toast 错误；成功 → toast 摘要后 `importLibrary` 入库
3. 解析层的 warnings/errors 继续用于反馈，不单独做大预览 UI

**可选轻量（非必须）**：入库前仅确认「成功 N / 警告 M / 失败 K」——若未来题库脏数据变多再考虑。

<details>
<summary>历史设计稿（已否决，仅存档）</summary>

原方案：解析后弹全屏预览（成功/警告/失败计数、分类与题型分布、前 3 道样题、警告明细、题库名、转 Excel / 导入）。移动端全屏模态 + 底栏固定按钮。**不再排期。**

</details>

### 8.4 目录（独立页 + 搜索）

**现状**：`#/catalog` 独立页（非抽屉内全屏模态）。

- 题干搜索 v1.2：有序 AND 过滤链 + 多过滤标签；结果按分类分组
- 首屏约 50 条，触底 / sentinel 自动续载（文案「共 N 题」）
- **练习模式**单入口 → Drill（快速刷题 / 背诵）
- 点击题目跳转学习页
- **不做**虚拟滚动（§0.3）

详情：[`docs/FEATURE-search.md`](docs/FEATURE-search.md)、[`docs/FEATURE-drill.md`](docs/FEATURE-drill.md)

### 8.5 分类管理

```
┌─────────────────────────────────┐
│  📂 管理分类               ✕   │
├─────────────────────────────────┤
│  教育学基础 (42题)  [重命名]    │
│  心理学 (38题)      [重命名]    │
│  课程论 (31题)      [重命名]    │
│  ...                            │
├─────────────────────────────────┤
│  + 新建分类                     │
└─────────────────────────────────┘
```

- 列表式，每项 56px 高
- 重命名可用 prompt 或内联编辑（体验增强，非阻塞）
- 长按拖动排序：**不做**（与 §0.3 一致，保持可选则永不做）

---

## 九、上传引导界面

首次使用（无题库时）显示：

```
┌─────────────────────────────────┐
│                                 │
│          📚                     │
│       欢迎使用刷题器            │
│                                 │
│   ┌─────────────────────────┐  │
│   │                         │  │
│   │    📤 点击或拖拽上传    │  │
│   │                         │  │
│   │   支持 Excel/PDF/JSON   │  │
│   │                         │  │
│   └─────────────────────────┘  │
│                                 │
│   📋 或从剪贴板粘贴文本         │
│                                 │
│   📥 下载导入模板               │
│                                 │
└─────────────────────────────────┘
```

- 上传区域大且居中，触摸友好
- 下方两个次级入口：粘贴 / 下载模板
- 拖拽时高亮反馈

---

## 十、PWA 配置

> **状态**：**已落地**（§0.4；`manifest.json` / `sw.js` / `icon-192.png` / `icon-512.png`；`app.html` 注册）。壳资源 cache-first；CDN network-first 可降级；题库数据仍靠 localStorage。

### 10.1 manifest.json

```json
{
  "name": "刷题器",
  "short_name": "刷题",
  "description": "移动端刷题工具",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f8fafc",
  "theme_color": "#4f46e5",
  "icons": [
    {
      "src": "./icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "./icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**关键点**：
- `start_url: "./"` 和 `scope: "./"` 用相对路径，适配 GitHub Pages 子路径部署
- `display: "standalone"` 隐藏浏览器 UI，像原生 App
- `orientation: "portrait"` 默认竖屏（刷题主场景）
- `purpose: "maskable"` 让图标适配 Android 自适应裁剪

### 10.2 Service Worker

`sw.js` 缓存策略：

```js
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `lx-static-${CACHE_VERSION}`;
const STATIC_ASSETS = [
    './',
    './index.html',
    './app.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './src/main.js',
    // 其余同源资源运行时 cache.put；CDN 另池
];

// 安装：预缓存静态资源
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== STATIC_CACHE)
                    .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// 请求拦截
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    // 同源静态资源：缓存优先
    if (url.origin === location.origin) {
        e.respondWith(
            caches.match(e.request).then(cached =>
                cached || fetch(e.request).then(resp => {
                    caches.open(STATIC_CACHE).then(c => c.put(e.request, resp.clone()));
                    return resp;
                })
            )
        );
        return;
    }
    // CDN 资源（SheetJS/PDF.js）：stale-while-revalidate
    e.respondWith(
        caches.open('lx-cdn').then(cache =>
            cache.match(e.request).then(cached => {
                const fetchPromise = fetch(e.request).then(resp => {
                    cache.put(e.request, resp.clone());
                    return resp;
                });
                return cached || fetchPromise;
            })
        )
    );
});
```

**注册**（在 `app.html`）：

```js
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .catch(err => console.warn('SW 注册失败:', err));
    });
}
```

### 10.3 离线策略

- **核心刷题流程**：完全离线可用（题目、答题、状态、统计全在 localStorage）
- **CDN 库**：首次加载后缓存，离线可用
- **新增题库**：可从已缓存的文件解析，但无法从 URL 导入（`importFromUrl` 需联网）
- **进度同步**：无后端，靠手动导出/导入 JSON

### 10.4 安装提示

iOS Safari 不支持自动安装提示，需用户手动"添加到主屏幕"。Android Chrome 支持 `beforeinstallprompt` 事件，可拦截并自定义提示：

```js
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // 在 UI 某处显示"安装到桌面"按钮
    showInstallButton();
});
```

---

## 十一、性能优化

### 11.1 渲染性能

- **事件委托**：卡片容器挂一次监听器，渲染时只更新内容，不重新绑定事件
- **避免重排**：批量 DOM 操作用 `DocumentFragment`
- **图片懒加载**：题库中的图片（如有）用 `loading="lazy"`
- **CSS 硬件加速**：动画元素加 `will-change: transform`

### 11.2 数据性能

- **进度缓存**：`loadProgress()` 内存缓存，避免每次 `JSON.parse`
- **增量保存**：编辑单题答案时只更新该题，不全量序列化题库
- **目录大数据**：搜索 + `limit`/`offset` 触底续载；**不做**虚拟滚动（§0.3）

### 11.3 加载性能

- **CSS 内联关键样式**：首屏样式直接内联，避免 FOUC
- **JS defer**：`<script defer src="app.js">`
- **CDN 预连接**：`<link rel="preconnect" href="https://cdn.sheetjs.com">`
- **资源压缩**：生产环境压缩 JS/CSS（GitHub Pages 不自动压缩，需构建）

### 11.4 移动端特定优化

- **防抖动**：滑动检测用 `passive: true`，避免阻塞主线程
- **`touch-action`**：卡片区域 `pan-y`（允许垂直滚动，拦截水平滑动）
- **输入防键盘遮挡**：聚焦时 `scrollIntoView`
- **`-webkit-overflow-scrolling: touch`**：iOS 滚动惯性
- **避免 300ms 点击延迟**：viewport meta 已设 `user-scalable=no`

---

## 十二、文件结构（重构后）

> **以仓库现状为准**（详见 README / MAINTENANCE）。下表为 v1.1 对齐摘要；旧单体树已废弃。

```
lx/
├── app.html                ← 唯一真入口（UI）
├── index.html              ← 跳转壳 → app.html
├── test.html               ← 测试控制台
├── version.txt
├── DESIGN.md
├── README.md
├── docs/                   ← CONTRACT / FEATURE-* / MAINTENANCE / TESTING …
├── src/
│   ├── main.js
│   ├── api/                ← Library / Question / Progress / Navigation /
│   │                         WrongBook / Category / Stats / IO / Drill / Test
│   ├── core/               ← storage / state / events / validators …
│   └── render/             ← pages/* · drawer · gestures · theme …
└── test/                   ← unit / ui / system
```

PWA 文件（`manifest.json` / `sw.js` / 图标）**已创建**，见 §十。

**注意**：ES Module 在 `file://` 下会被 CORS 拦截，须 HTTP 访问（如 `python3 -m http.server`）。

---

## 十三、GitHub Pages 部署注意事项

| 事项 | 处理 |
|------|------|
| 子路径部署 `username.github.io/lx/` | 所有资源用相对路径 `./xxx`，不用 `/xxx` |
| Service Worker scope | 注册时 `scope: './'`，仅控制当前子路径 |
| localStorage 共享 origin | 键名加项目前缀：`lx_libraries_v1` / `lx_progress_v1` |
| HTTPS 强制 | `navigator.clipboard` 可用，保留 `execCommand` 兜底 |
| 文件大小 | 单文件软限 25MB，app.js 拆分后单文件更小 |
| CDN 依赖 | SheetJS / PDF.js 走 CDN，离线由 SW 缓存 |
| 自定义域名 | GitHub Pages 支持绑定，配置 CNAME 文件 |

---

## 十四、实施路径（旧版 · 已归档）

> **以 §二十三 为准。** 下列「UI 先」五阶段为历史路径，模块拆分与 API 优先已完成；导入完整预览 / 双列常驻抽屉等已按 §〇 否决或降级。

<details>
<summary>展开旧阶段清单（仅存档）</summary>

1. UI 重构 → 2. 错题专注 → 3. 导入导出（含完整预览）→ 4. PWA → 5. 模块拆分  

其中阶段 3 的「完整预览」改为 §8.3 轻量 toast；阶段 4/5 的 PWA 与模块拆分：单体已拆完，PWA **已落地**（§0.4 / §十）。

</details>

---

## 十五、验收标准

移动端体验验收清单（随 v1.1 修订）：

- [x] 刷题页一屏可见顶栏 + 题目 + 底部操作（目标机型以真机为准）
- [x] 核心操作集中底部，拇指可达
- [x] 左右滑动切换题目
- [x] 上下滑动标记掌握/错题
- [x] 抽屉按需滑入/滑出
- [x] safe-area 适配（theme / 布局 token）
- [x] 平板/桌面内容居中不撑满；**抽屉不常驻**（原「双列常驻」已否决）
- [x] 离线完整刷题 + 加主屏（PWA，§十 / §0.4，**已落地**）
- [ ] 模态/输入在键盘弹起时不遮挡（按需回归）

---

## 附录：设计决策记录

### A1. 为什么去掉统计圆环

- 占用 48×48px，但数字小（13px），信息密度低
- 文字 `23/156` 同样表达进度，更紧凑
- 圆环的视觉吸引力对刷题场景非必需
- 移到抽屉的"题库详情"区作为视觉元素保留（可选）

### A2. 为什么底部按钮分两行

- 单行 6 按钮在 375px 屏宽下每个仅 60px，文字会换行
- 两行 3 按钮，每个 120px，文字 + 图标舒展
- 状态行（重置/掌握/错题）与导航行（上/目录/下）语义分离
- 桌面端合并为一行（6 按钮宽度足够）

### A3. 为什么抽屉从左侧而非右侧

- 主流移动 App 抽屉多在左侧（如 Gmail、设置）
- 拇指自然划动方向：左滑关闭、右滑打开
- 与底部操作区（右侧无遮挡）无冲突

### A4. 为什么上下滑动映射为掌握/错题

- 单手刷题时，左右滑动已经用于翻页
- 上下滑动是天然未占用的手势
- "向上"语义 = 进步 = 掌握；"向下"语义 = 沉淀 = 错题，符合直觉
- 与底部按钮形成双通道操作（手势 + 按钮）

### A5. 为什么用 Action Sheet 而非下拉菜单

- 移动端下拉菜单触摸体验差（选项小、需精确点击）
- Action Sheet 从底部弹起，单手可达
- iOS / Android 原生 UI 均采用此模式，用户熟悉

---

## 十六、API 层架构（Headless Core + Thin UI）

### 16.1 设计理念

**移动端是用户体验的核心，PC 端是功能验证和测试的核心**。为此采用"无头核心 + 薄 UI"架构：

- **核心逻辑**全部封装在 `window.LX.*` API 中，不依赖 DOM
- **移动端 UI** 只是 API 的消费者，调用 API 后更新 DOM
- **PC 端测试**绕过 UI 直接调用 API，可脚本化、可自动化
- **任何 UI 能做的事，API 都能做**；任何 API 调用都能被测试

### 16.2 三层架构

```
┌──────────────────────────────────────────────┐
│  UI 层 (src/render/)                          │
│  - 调用 LX.* API                              │
│  - 订阅 LX.on 事件，更新 DOM                  │
│  - 处理触摸/键盘/手势                          │
│  - 移动端 UI 和 PC 测试 UI 各自独立           │
└──────────────────┬───────────────────────────┘
                   │ 调用 API
┌──────────────────▼───────────────────────────┐
│  API 层 (src/api/)  →  window.LX             │
│  LibraryAPI / QuestionAPI / ProgressAPI /    │
│  NavigationAPI / WrongBookAPI / CategoryAPI /│
│  IOAPI / StatsAPI / TestAPI                  │
│  - 纯逻辑，无 DOM 依赖                         │
│  - 同步优先，文件解析用 Promise                │
│  - 状态变更通过事件广播                       │
└──────────────────┬───────────────────────────┘
                   │ 调用
┌──────────────────▼───────────────────────────┐
│  核心层 (src/core/)                           │
│  storage  - localStorage + 内存缓存           │
│  state    - 集中状态 store                    │
│  parsers  - excel/pdf/json/text              │
│  validators - 数据校验                        │
│  events   - 事件总线                          │
└──────────────────────────────────────────────┘
```

### 16.3 命名空间

```js
window.LX = {
    version: '2.4.0',

    // 命名空间 API
    LibraryAPI,      // 题库管理
    QuestionAPI,     // 题目管理 + 答题判分
    ProgressAPI,    // 状态/进度
    NavigationAPI,   // 题目导航
    WrongBookAPI,    // 错题专注模式
    CategoryAPI,    // 分类管理
    IOAPI,           // 导入导出
    StatsAPI,        // 统计
    TestAPI,         // 测试辅助（重置/注入/快照）

    // 事件总线
    on, off, emit,
};
```

### 16.4 返回值规范

所有 API 返回统一的 `{ ok, data?, error? }` 结构：

```js
// 成功（同步）
{ ok: true, data: { id: 'lib_123', name: '...' } }

// 失败（同步）
{ ok: false, error: { code: 'NOT_FOUND', message: '题库不存在' } }

// 文件解析（异步）
Promise<{
    ok: true,
    data: { questions: [...], stats: {...} },
    warnings: [{ row: 8, message: '...' }],
    errors: [{ row: 22, message: '...' }]
}>
```

错误码枚举：

```js
const ErrorCode = {
    NOT_FOUND: 'NOT_FOUND',
    INVALID_INPUT: 'INVALID_INPUT',
    DUPLICATE: 'DUPLICATE',
    STORAGE_FULL: 'STORAGE_FULL',
    PARSE_ERROR: 'PARSE_ERROR',
    STATE_ERROR: 'STATE_ERROR',
};
```

### 16.5 事件系统

状态变更通过事件总线广播，UI 订阅更新：

```js
LX.on('library:switched', (e) => {
    // e = { libId, libName }
    updateTopBar(e.libName);
});
LX.on('question:statusChanged', (e) => {
    // e = { libId, qId, oldStatus, newStatus }
    updateCardBadge(e.newStatus);
});
LX.on('wrongbook:cleared', () => {
    showCelebration();
});
LX.on('progress:updated', (e) => {
    // e = { mastered, review, total, percent }
    updateStatsText(e);
});
```

**关键收益**：UI 不主动查询状态，而是被动响应事件。这样多个 UI 入口（移动端、PC 测试、未来扩展）都能保持一致。

---

## 十七、API 接口规范

### 17.1 LibraryAPI（题库管理）

```js
// 列出所有题库
LX.LibraryAPI.list()
// → { ok: true, data: [{ id, name, questionCount, masteredCount, reviewCount }] }

// 获取当前题库 ID
LX.LibraryAPI.current()
// → { ok: true, data: 'lib_xxx' | null }

// 获取题库详情
LX.LibraryAPI.get(libId)
// → { ok: true, data: { id, name, questions: [...] } }

// 创建题库（自动去重检测）
LX.LibraryAPI.create(name, questions)
// → { ok: true, data: { id } }
// → { ok: false, error: { code: 'DUPLICATE', data: { matchingLibId } } }

// 切换当前题库
LX.LibraryAPI.switch(libId)
// → { ok: true }，触发 'library:switched' 事件

// 删除题库
LX.LibraryAPI.delete(libId)
// → { ok: true }，触发 'library:deleted'

// 重命名题库
LX.LibraryAPI.rename(libId, newName)
// → { ok: true, data: { name } }
```

### 17.2 QuestionAPI（题目管理 + 答题）

```js
// 列出题目（支持筛选）
LX.QuestionAPI.list({ category?, status?, mode? })
// → { ok: true, data: { questions: [...], total } }

// 获取单题
LX.QuestionAPI.get(qId)
// → { ok: true, data: { id, question, type, options, answer, ... } }

// 添加题目
LX.QuestionAPI.add({ type, question, options, answer, explanation, ... })
// → { ok: true, data: { id } }

// 更新题目字段
LX.QuestionAPI.update(qId, { answerText?, remarks?, explanation? })
// → { ok: true }

// 删除题目
LX.QuestionAPI.delete(qId)
// → { ok: true }

// 提交答案并自动判分（核心）
LX.QuestionAPI.answer(qId, userAnswer)
// → {
//     ok: true,
//     data: {
//         correct: true|false,
//         correctAnswer: 'B',
//         explanation: '...',
//         autoStatus: 'mastered'|'review',  // 自动设置的进度状态
//     }
// }
// 同时触发 'question:statusChanged' 事件

// 重做题目（重置可答状态）
LX.QuestionAPI.resetAttempt(qId)
// → { ok: true }
```

### 17.3 ProgressAPI（状态/进度）

```js
// 获取单题状态
LX.ProgressAPI.getStatus(qId)
// → { ok: true, data: 'none'|'mastered'|'review' }

// 设置状态
LX.ProgressAPI.setStatus(qId, status)
// → { ok: true }，触发 'question:statusChanged' + 'progress:updated'

// 重置当前题库进度
LX.ProgressAPI.reset(libId?)
// → { ok: true }，触发 'progress:reset'

// 获取统计
LX.ProgressAPI.stats(libId?)
// → { ok: true, data: { total, mastered, review, percent } }

// 导出全部进度
LX.ProgressAPI.export()
// → { ok: true, data: '{...JSON string...}' }

// 导入进度（覆盖）
LX.ProgressAPI.import(jsonString)
// → { ok: true }，触发 'progress:imported'
```

### 17.4 NavigationAPI（导航）

```js
// 当前题目索引
LX.NavigationAPI.current()
// → { ok: true, data: { index, qId, total } }

// 跳转到指定索引
LX.NavigationAPI.goto(index)
// → { ok: true }，触发 'navigation:changed'

// 下一题（循环）
LX.NavigationAPI.next()
// → { ok: true }

// 上一题
LX.NavigationAPI.prev()
// → { ok: true }

// 随机跳转
LX.NavigationAPI.random()
// → { ok: true }

// 设置模式
LX.NavigationAPI.setMode('sequential'|'random')
// → { ok: true }

// 洗牌
LX.NavigationAPI.shuffle()
// → { ok: true }
```

### 17.5 WrongBookAPI（错题专注模式）

```js
// 进入错题专注模式
LX.WrongBookAPI.enter()
// → { ok: true, data: { wrongCount } }，触发 'wrongbook:entered'
// → { ok: false, error: { code: 'NO_WRONG' } }

// 退出
LX.WrongBookAPI.exit()
// → { ok: true }，触发 'wrongbook:exited'

// 错题列表
LX.WrongBookAPI.list()
// → { ok: true, data: { questions: [...], count } }

// 错题数
LX.WrongBookAPI.count()
// → { ok: true, data: number }

// 标记掌握（移出错题本）
LX.WrongBookAPI.markMastered(qId)
// → { ok: true, data: { remaining } }
// 若 remaining === 0，触发 'wrongbook:cleared'
```

### 17.6 CategoryAPI（分类管理）

```js
// 分类列表（含题目数）
LX.CategoryAPI.list()
// → { ok: true, data: [{ name, count }] }

// 重命名分类（支持合并）
LX.CategoryAPI.rename(oldName, newName)
// → { ok: true }，触发 'category:renamed'
```

### 17.7 IOAPI（导入导出）

```js
// 解析文件（不入库，仅返回结果）
LX.IOAPI.parseFile(file)
// → Promise<{ ok: true, data: { questions, stats }, warnings, errors }>

// 解析文本
LX.IOAPI.parseText(text)
// → { ok: true, data: { questions, stats }, warnings, errors }

// 导入题库（含去重检测）
LX.IOAPI.importLibrary(name, questions)
// → { ok: true, data: { id } }
// → { ok: false, error: { code: 'DUPLICATE', data: { matchingLibId } } }

// 导出题库
LX.IOAPI.exportLibrary(libId, format)
// format: 'json' | 'xlsx' | 'print'
// → { ok: true }（触发文件下载 / 打印窗口）

// 下载导入模板
LX.IOAPI.downloadTemplate()
// → { ok: true }（下载 Excel 模板）

// 跨格式转换
LX.IOAPI.convert(questions, toFormat)
// → { ok: true, data: Blob }
```

### 17.8 StatsAPI（统计）

```js
// 当前题库完整统计
LX.StatsAPI.summary()
// → { ok: true, data: { total, mastered, review, percent, byCategory, byType } }

// 按分类统计
LX.StatsAPI.byCategory()
// → { ok: true, data: [{ category, total, mastered, review }] }

// 按题型统计
LX.StatsAPI.byType()
// → { ok: true, data: { single: {total, mastered}, multi: {...}, ... } }
```

### 17.9 TestAPI（测试专用）

仅用于测试环境，生产环境可通过 `?test=1` 参数开启：

```js
// 完全重置（清空所有 localStorage）
LX.TestAPI.reset()
// → { ok: true }

// 注入测试数据
LX.TestAPI.seed(scenarioName)
// scenarioName: 'empty' | 'small' | 'large' | 'withWrong' | 'allTypes'
// → { ok: true, data: { libIds: [...] } }

// 数据快照
LX.TestAPI.snapshot()
// → { ok: true, data: snapshotString }

// 恢复快照
LX.TestAPI.restore(snapshotString)
// → { ok: true }

// 断言辅助
LX.TestAPI.assert(condition, message)
// → { ok: true, data: { passed: true } }

// Mock 文件（生成测试用 File 对象）
LX.TestAPI.mockFile(content, name, type)
// → File 对象
```

---

## 十八、测试方案

### 18.1 测试金字塔

```
                    ┌──────────┐
                    │  E2E     │  Playwright，覆盖关键用户流程
                    │  10%     │  （导入→答题→错题→导出）
                    └──────────┘
                ┌──────────────┐
                │  集成测试    │  API 串联，跨模块流程
                │  30%         │
                └──────────────┘
        ┌────────────────────────┐
        │  单元测试              │  每个 API 函数，纯逻辑
        │  60%                   │
        └────────────────────────┘
```

### 18.2 测试入口（三种）

#### 入口 1：浏览器控制台（开发时随手测）

```js
// 任何页面打开后即可用
LX.LibraryAPI.list()
LX.QuestionAPI.answer(5, 'B')
LX.StatsAPI.summary()
```

#### 入口 2：PC 端测试控制台 `/test.html`

独立页面，可视化测试工具，不依赖主 UI：

```
┌──────────────────────────────────────────────────────┐
│  刷题器 API 测试控制台          v2.4.0               │
├──────────────┬───────────────────────────────────────┤
│  API 目录     │  REPL 控制台                          │
│  ───────     │  ───────                              │
│  ▸ Library   │  > LX.LibraryAPI.list()              │
│    list      │  ← { ok: true, data: [{ id: 'lib_1'..│
│    create    │                                       │
│    delete    │  > LX.QuestionAPI.answer(5, 'B')     │
│  ▸ Question  │  ← { ok: true, data: { correct: ...  │
│    answer    │                                       │
│    ...       │  [运行]  [清空]  [导出报告]          │
├──────────────┼───────────────────────────────────────┤
│  测试套件     │  运行结果                              │
│  ───────     │  ───────                              │
│  [全部运行]  │  ✓ Library API        12/12 通过      │
│  [单元]      │  ✓ Question API       15/15 通过      │
│  [集成]      │  ✗ Progress API        8/9  失败 1    │
│  [回归]      │  ✓ WrongBook API       7/7  通过      │
│              │                                       │
│              │  失败详情：                            │
│              │  ✗ Progress.reset 后 stats 应为 0      │
│              │    at test/progress.js:45              │
└──────────────┴───────────────────────────────────────┘
```

PC 端测试控制台特性：
- 左侧 API 目录树，点击插入到 REPL
- 中间 REPL 控制台，支持多行编辑、历史记录
- 右侧测试套件运行器
- 底部失败详情，含堆栈

#### 入口 3：自动化测试（Playwright）

`/test.html` 既是人工测试工具，也是自动化测试的运行宿主：

```js
// e2e/basic-flow.spec.js
import { test, expect } from '@playwright/test';

test('完整刷题流程', async ({ page }) => {
    await page.goto('http://localhost:8080/test.html');

    // 重置 + 注入数据
    await page.evaluate(() => LX.TestAPI.reset());
    await page.evaluate(() => LX.TestAPI.seed('small'));

    // 创建题库
    const result = await page.evaluate(() =>
        LX.LibraryAPI.create('测试题库', [{
            type: 'single',
            question: '1+1=?',
            options: ['1', '2', '3', '4'],
            answer: 'B',
        }])
    );
    expect(result.ok).toBe(true);

    // 答题
    const answer = await page.evaluate(() =>
        LX.QuestionAPI.answer(1, 'B')
    );
    expect(answer.data.correct).toBe(true);
    expect(answer.data.autoStatus).toBe('mastered');

    // 验证统计
    const stats = await page.evaluate(() => LX.StatsAPI.summary());
    expect(stats.data.mastered).toBe(1);
});
```

### 18.3 测试用例组织

```
test/
├── unit/                       ← 单元测试（纯 API 调用）
│   ├── library.test.js
│   ├── question.test.js
│   ├── progress.test.js
│   ├── navigation.test.js
│   ├── wrong-book.test.js
│   ├── category.test.js
│   ├── io.test.js
│   └── stats.test.js
├── integration/               ← 集成测试（跨模块流程）
│   ├── study-flow.test.js     ← 完整学习流程
│   ├── import-export.test.js  ← 导入→导出往返一致性
│   └── wrong-book-cycle.test.js ← 错题入→清空→退出
├── e2e/                        ← E2E（Playwright）
│   └── basic-flow.spec.js
├── fixtures/                   ← 测试数据
│   ├── sample-education.json
│   ├── sample-multi-type.json
│   ├── malformed.xlsx
│   └── scanned.pdf
└── scenarios/                  ← TestAPI.seed 场景
    ├── empty.js
    ├── small.js
    ├── large.js
    ├── with-wrong.js
    └── all-types.js
```

### 18.4 关键测试用例示例

#### 单元测试示例

```js
// test/unit/question.test.js
export const QuestionTests = {
    '单选题答对应自动标记 mastered': () => {
        LX.TestAPI.reset();
        LX.TestAPI.seed('small');
        const result = LX.QuestionAPI.answer(1, 'B');
        assert(result.ok, '应答成功');
        assert(result.data.correct === true, '应判定正确');
        assert(result.data.autoStatus === 'mastered', '应自动标记掌握');
        const status = LX.ProgressAPI.getStatus(1);
        assert(status.data === 'mastered', '进度应为已掌握');
    },

    '多选题漏选判错并标 review': () => {
        LX.TestAPI.reset();
        LX.TestAPI.seed('all-types');
        // 正确答案 A,C，用户只选 A
        const result = LX.QuestionAPI.answer(2, ['A']);
        assert(result.data.correct === false, '应判定错误');
        assert(result.data.autoStatus === 'review', '应自动加入错题');
    },

    '填空题大小写不敏感': () => {
        const result = LX.QuestionAPI.answer(3, 'BEIJING');
        assert(result.data.correct === true, '大小写不敏感');
    },

    '重复检测：相同内容不能重复入库': () => {
        LX.TestAPI.reset();
        const q = [{ question: '1+1', answer: '2', type: 'fill' }];
        LX.LibraryAPI.create('题库A', q);
        const dup = LX.LibraryAPI.create('题库B', q);
        assert(dup.ok === false, '应拒绝重复');
        assert(dup.error.code === 'DUPLICATE', '错误码应为 DUPLICATE');
    },
};
```

#### 集成测试示例：导入导出往返一致性

```js
// test/integration/import-export.test.js
export const ImportExportTests = {
    'JSON 导出再导入数据一致': async () => {
        LX.TestAPI.reset();
        LX.TestAPI.seed('small');
        const original = LX.LibraryAPI.list().data[0];

        // 导出
        const exportResult = LX.IOAPI.exportLibrary(original.id, 'json');
        const blob = exportResult.data;
        const text = await blob.text();

        // 删除原题库
        LX.LibraryAPI.delete(original.id);

        // 重新导入
        const file = LX.TestAPI.mockFile(text, 'restored.json', 'application/json');
        const parsed = await LX.IOAPI.parseFile(file);
        const imported = LX.IOAPI.importLibrary('restored', parsed.data.questions);

        // 验证数据一致（忽略 ID 和 uid）
        const restored = LX.LibraryAPI.get(imported.data.id).data;
        assert(restored.questions.length === original.questions.length, '题数应一致');
        assert(restored.questions[0].question === original.questions[0].question, '题目文本一致');
    },
};
```

#### 回归测试示例：bug 修复后

```js
// test/regression/excel-export-columns.test.js
// 对应 bug：导出 Excel 时表头与数据列错位
export const RegressionTests = {
    'BUG-001: Excel 导出列与表头对齐': async () => {
        LX.TestAPI.reset();
        LX.TestAPI.seed('all-types');
        const lib = LX.LibraryAPI.list().data[0];

        const result = LX.IOAPI.exportLibrary(lib.id, 'xlsx');
        const arrayBuffer = await result.data.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // 表头第 2 列应为"题型"
        assert(rows[0][1] === '题型', '表头第 2 列应为"题型"');
        // 数据行第 2 列应为题型值（single/multi/...）
        assert(['single','multi','judge','fill','essay'].includes(rows[1][1]),
            '数据行第 2 列应为题型值');
    },
};
```

### 18.5 测试覆盖率目标

| API 域 | 单元覆盖 | 集成覆盖 | 优先级 |
|--------|---------|---------|--------|
| LibraryAPI | 100% | ✓ | P0 |
| QuestionAPI（含 answer 判分） | 100% | ✓ | P0 |
| ProgressAPI | 100% | ✓ | P0 |
| IOAPI（解析 + 导出） | 90% | ✓ | P0 |
| WrongBookAPI | 90% | ✓ | P1 |
| NavigationAPI | 80% | — | P2 |
| CategoryAPI | 80% | — | P2 |
| StatsAPI | 90% | — | P2 |

---

## 十九、PC 端测试控制台

### 19.1 设计目标

PC 端不仅是适配，更是**测试床**。专用 `/test.html` 提供独立于主 UI 的测试环境：

- **不依赖主 UI**：即使主 UI 出 bug，测试控制台仍能调用 API
- **可视化操作 API**：点击 API 目录自动生成调用代码
- **运行测试套件**：一键运行所有测试用例
- **失败可复现**：每条失败用例可单独重跑，含数据快照

### 19.2 页面结构

```
┌──────────────────────────────────────────────────────────┐
│  刷题器 API 测试控制台                  v2.4.0  [GitHub]  │
├────────────┬────────────────────────────┬────────────────┤
│            │                            │                │
│  API 目录   │   REPL 控制台              │  测试运行器    │
│            │                            │                │
│  ▸ Library │   > LX.LibraryAPI.list()   │  [全部运行]   │
│   • list   │   ← { ok: true, data: [..]│  [单元测试]   │
│   • create │                            │  [集成测试]   │
│   • delete │   > LX.QuestionAPI.       │  [回归测试]   │
│  ▸ Question│      answer(5, 'B')       │                │
│   • answer │   ← { ok: true, data: {   │  Library    ✓  │
│  ▸ Progress│       correct: true, ...   │  Question   ✓  │
│  ▸ Nav     │     }                       │  Progress   ✗  │
│  ▸ Wrong   │                            │  WrongBook  ✓  │
│  ▸ IO      │   [运行] [清空] [历史]    │  IO         ✓  │
│  ▸ Stats   │                            │                │
│  ▸ Test    │                            │  通过 23/24   │
│            │                            │  用时 1.2s    │
└────────────┴────────────────────────────┴────────────────┘
```

### 19.3 功能清单

1. **API 目录树**：左侧列出所有 API 方法，点击插入到 REPL
2. **REPL 控制台**：中间区域，支持多行 JS 编辑、自动补全、历史记录
3. **结果可视化**：返回值自动 pretty-print，支持展开嵌套对象
4. **测试运行器**：右侧测试套件，一键运行，实时显示通过/失败
5. **失败详情**：底部展开失败用例的断言、期望值、实际值、堆栈
6. **数据快照**：每个测试前后自动 snapshot，失败时可恢复现场
7. **Mock 工具**：生成测试用 File 对象、模拟键盘事件、模拟触摸事件
8. **导出报告**：测试结果导出为 JSON / HTML 报告
9. **网络模拟**：模拟离线场景（断 SW），测试 PWA 离线能力
10. **多设备模拟**：内嵌 device mode，模拟手机/平板视口

### 19.4 与主应用的关系

```
lx/
├── index.html         ← 主应用（移动端 UI 优先）
├── test.html          ← 测试控制台（PC 优先）
├── src/
│   ├── api/           ← 共享 API 层
│   ├── core/          ← 共享核心层
│   ├── render/        ← 主应用 UI
│   └── test-ui/       ← 测试控制台 UI
└── test/
    └── ...            ← 测试用例
```

`test.html` 与 `index.html` 共享 `api/` 和 `core/`，只 UI 不同。这保证测试的就是用户实际使用的代码。

---

## 二十、CI 自动化测试

### 20.1 GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Test
on:
    push:
        branches: [main, dev]
    pull_request:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with: { node-version: '20' }
            - run: npx playwright install --with-deps chromium
            - run: npx http-server -p 8080 &  # 启动静态服务器
            - run: npx playwright test         # 跑 E2E 测试
            - uses: actions/upload-artifact@v4
              if: always()
              with:
                  name: test-report
                  path: test-results/
```

### 20.2 测试触发时机

| 触发 | 运行内容 |
|------|---------|
| 每次 push 到 dev | 单元测试 + 集成测试 |
| PR 到 main | 全部测试（含 E2E） |
| main 分支 push | 全部测试 + 部署到 GitHub Pages |
| 手动触发 | 可选测试范围 |

### 20.3 测试报告

测试失败时，GitHub Actions 自动：
1. 上传 HTML 报告为 artifact
2. 在 PR 评论中显示失败摘要
3. 标记 PR 为 `tests-failed`

---

## 二十一、PC 端特性

PC 端除了作为测试床，还为桌面用户提供额外能力：

### 21.1 键盘快捷键

| 快捷键 | 状态 | 作用 |
|--------|------|------|
| `←` / `→` | **已有** | 上/下一题 |
| `↑` / `↓` | **已有** | 标记掌握 / 加入错题 |
| `Space` / `M` / `R` / `Esc` / `Ctrl+S` / `?` | **Backlog** | 完整快捷键矩阵（§0.4 非阻塞） |
| `Ctrl+K` | **Backlog** | 命令面板（§0.4 / §21.2 非阻塞） |

### 21.2 命令面板（Ctrl+K）

> **状态**：**Backlog（非阻塞）**（§0.4）。浏览页搜索已覆盖部分「搜题跳转」；命令面板额外提供键盘优先的跳转与命令。方向键已有。

### 21.3 Hover 状态

桌面端可增强 hover（截断题干、快捷键提示），非阻塞。

### 21.4 开发者工具

`?dev=1` 开发条：**Backlog（非阻塞）**（§0.4）。日常调试仍用 `test.html`（含应用预览）+ `window.LX`。

---

## 二十二、架构调整总结

### 22.1 文件结构（更新）

> 与 §十二一致：真入口为 **`app.html`**；PWA 文件已落地。下列树保留架构意图，细节以仓库为准。

```
lx/
├── app.html                ← 主应用唯一真入口
├── index.html              ← 跳转壳
├── test.html               ← 测试控制台入口（PC 优先）
├── test-style.css
├── version.txt
├── DESIGN.md
├── README.md
│
├── src/
│   ├── main.js             ← 主应用入口
│   ├── test-main.js        ← 测试控制台入口（若存在）
│   │
│   ├── api/                ← API 层（共享）
│   │   ├── index.js        ← window.LX 装配
│   │   ├── library.js
│   │   ├── question.js
│   │   ├── progress.js
│   │   ├── navigation.js
│   │   ├── wrong-book.js
│   │   ├── category.js
│   │   ├── io.js
│   │   ├── stats.js
│   │   └── test.js         ← TestAPI（仅 ?test=1 启用）
│   │
│   ├── core/               ← 核心层（共享）
│   │   ├── storage.js      ← localStorage + 缓存 + 容量保护
│   │   ├── state.js        ← 集中状态
│   │   ├── events.js       ← 事件总线
│   │   ├── parsers/
│   │   │   ├── excel.js
│   │   │   ├── pdf.js
│   │   │   ├── json.js
│   │   │   └── text.js
│   │   └── validators/
│   │       └── question.js
│   │
│   ├── render/             ← 主应用 UI
│   │   ├── card.js
│   │   ├── drawer.js
│   │   ├── modal.js
│   │   └── ...
│   │
│   ├── test-ui/            ← 测试控制台 UI
│   │   ├── repl.js
│   │   ├── runner.js
│   │   └── ...
│   │
│   └── utils.js
│
├── test/                   ← 测试用例
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   └── scenarios/
│
├── .github/workflows/
│   └── test.yml
│
└── playwright.config.js
```

### 22.2 双入口共享核心

```
┌─────────────────┐     ┌─────────────────┐
│  app.html       │     │  test.html      │
│  移动端 UI       │     │  PC 测试控制台   │
│  main.js        │     │  test runner    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌────────────────┐
            │  src/api/      │  ← 同一套 API（含 DrillAPI）
            │  src/core/     │  ← 同一套核心
            └────────────────┘
```

**核心约束**：`api/` 和 `core/` 在两个入口下表现完全一致。测试控制台调用的是用户实际使用的代码，而非 mock。

### 22.3 API 启用策略

```js
// src/api/index.js（示意；以仓库实现为准）
import { LibraryAPI, QuestionAPI, DrillAPI, /* ... */ } from './';

// 始终挂载核心 API
window.LX = {
    version: APP_VERSION,
    LibraryAPI, QuestionAPI, ProgressAPI, NavigationAPI,
    WrongBookAPI, CategoryAPI, IOAPI, StatsAPI, DrillAPI,
    on, off, emit,
};

// TestAPI 仅在测试入口或带参数时启用
if (location.pathname.endsWith('test.html') ||
    new URLSearchParams(location.search).has('test')) {
    const { TestAPI } = await import('./test');
    window.LX.TestAPI = TestAPI;
}
```

这样生产环境的 `window.LX` 不含 TestAPI，避免用户误调用 `LX.TestAPI.reset()` 清空数据。

---

## 二十三、实施路径（更新 · 含完成态）

| 阶段 | 内容 | 状态（v3.1.0） |
|------|------|----------------|
| 1 | 核心层 + API + `window.LX` | **完成**（含 DrillAPI 等后续扩展） |
| 2 | PC 测试控制台 + 用例 | **主体完成**；GitHub Actions / Playwright E2E **已落地**（§0.4） |
| 3 | 移动端 UI（多页 SPA） | **完成**（形态相对原文单屏抽屉有分叉，§0.2） |
| 4 | 错题本 + 导入 | **错题完成**；完整导入预览 **Won’t do**（§8.3） |
| 5 | PWA + 旧单体清理 | 单体已拆完；**PWA 已落地**（§十 / §0.4） |
| — | PC 增强（§二十一） | 方向键已有；命令面板 / 完整快捷键 / `?dev=1` **Backlog · 非阻塞**（§0.4） |

### 阶段 1：核心层 + API 层 — 完成

- `core/storage` · `state` · `events` · validators …
- `api/*` + `window.LX`（含 Drill / 搜索契约）
- 单元 / UI / system 测例持续扩充

### 阶段 2：PC 测试控制台 — 主体完成

- `test.html` + runner + 套件目录 / `runCase`
- CI（Actions）与 Playwright E2E：**已接**（§0.4）——在真实浏览器跑主流程，与 `test.html` 互补

### 阶段 3：移动端 UI — 完成（有分叉）

- `render/pages/*` + topbar / bottombar / drawer / gestures
- 不强制复刻第六~八章全部线框；以 §〇 为准

### 阶段 4：错题 + 导入 — 部分完成

- WrongBook：完成
- 导入：parse + toast + 入库；**不做**完整预览模态

### 阶段 5：PWA — 已落地

- manifest + sw + 图标 + 加主屏 / 离线（§0.4 / §十）
- 旧 `app.js`：已不存在

### PC 增强（穿插，§二十一）— Backlog（非阻塞）

- `Ctrl+K`、完整快捷键、`?dev=1`（方向键已完成；不阻塞发版）

---

## 附录补充

### A6. 为什么 API 优先于 UI 重构

- UI 重构期间没有 API 兜底，每次改动都得手动点 UI 验证，效率低
- 先建 API，UI 重构时可同步写测试，改动后跑测试即可验证
- API 层稳定后，UI 可以迭代多次而不破坏功能
- PC 测试控制台能在 UI 还没完工时验证核心逻辑

### A7. 为什么 TestAPI 默认不启用

- `reset()` / `seed()` 等方法若被用户误调用会清空数据
- 生产环境 `window.LX.TestAPI` 为 undefined，从入口杜绝
- 测试控制台 `test.html` 自动启用，开发时加 `?test=1` 启用

### A8. 为什么用事件总线而非双向绑定

- 双向绑定（如 Vue/React）需要框架，本项目刻意保持原生 JS
- 事件总线是观察者模式的最简实现，约 20 行代码
- API 发事件，UI 订阅，单向数据流，调试简单
- 多个 UI 入口（移动端、PC 测试）订阅同一事件，状态天然同步

### A9. 为什么 PC 端测试控制台独立成 test.html

- 主 UI 出 bug 时，测试控制台仍能调用 API 验证问题
- 测试控制台可以加载额外的测试库（断言、Mock），不污染主应用
- 可以独立部署为 `username.github.io/lx/test.html`，永远可访问
- PC 端优先布局与移动端完全不同，分文件更清晰

### A10. 为什么不用现成测试框架（Jest/Vitest）

- 它们需要 Node 环境 + 构建步骤，与"纯静态部署"约束冲突
- 测试用例用原生 JS + 极简断言即可，无需框架
- Playwright 仅用于 E2E（在真实浏览器跑），不依赖 Node 测试运行时
- 如未来引入构建工具，可平滑迁移到 Vitest

### A11. 为什么砍掉长按菜单 / 捏合 / PDF / 重做 / 虚拟滚动 / 完整导入预览（v1.1）

- **长按 / 捏合**：收益低、易与滑动手势冲突；编辑与字号有其它入口或可后补设置项
- **打印 PDF**：导出 JSON/Excel 已覆盖备份与再编辑；PDF 排版成本高
- **多选「重做」**：重置/再答足够，少一个非常用控件
- **虚拟滚动**：题量通常可控；搜索 AND + 触底续载已解决目录可浏览性
- **完整导入预览**：自维护题库场景下 toast + 解析警告足够；大弹窗增加维护与测例成本。若脏数据变多，再考虑「仅计数确认」轻量版（仍非必须）

### A12. 为什么信息架构改成多页 SPA

- 设置、目录、帮助、统计各自足够重，塞进单屏抽屉会再次臃肿
- Hash 路由便于深链与测试定位页面
- 刷题页仍遵守「一屏一焦点」；其它能力用底栏切换

---

**文档结束**

如需调整任何设计决策，请直接在本文件对应章节修改并更新版本号（当前 **v1.1**）。功能细则以 `docs/FEATURE-*.md` 与 `docs/CONTRACT-api.md` 为准。
