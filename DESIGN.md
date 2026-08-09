# 刷题器（lx）移动端设计文档

> **版本**：v1.0
> **更新**：2026-08-09
> **核心约束**：移动端优先 · 纯静态部署（GitHub Pages）· 离线可用（PWA）
> **目标设备优先级**：手机竖屏 > 手机横屏 ≈ 平板 > 桌面

---

## 一、设计目标

把当前一屏 ~40 个交互元素的臃肿界面，重构为**移动端单手可操作**的极简卡片流。

| 指标 | 当前 | 目标 |
|------|------|------|
| 主屏可交互元素数 | ~40 | ≤ 8 |
| 首屏视觉中心 | 工具栏密集 | 题目卡片 |
| 单手可达性 | 低（按钮散落四角） | 高（核心操作集中在屏幕底部 1/3） |
| 移动端首屏完整度 | 需滚动 | 一屏看完 |
| 离线可用 | 否 | 是（PWA） |

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
| `lg` | ≥ 1024px | 平板横屏 / 小桌面 | 双列：左卡片 + 右抽屉常驻 |
| `xl` | ≥ 1280px | 桌面 | 双列居中（max-width 1100px） |

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

- 双列布局：左侧主界面（卡片 + 操作），右侧抽屉常驻。
- 桌面端启用键盘快捷键提示（hover 显示）。
- 鼠标 hover 状态生效。

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
| 长按题目（500ms） | 弹出题目操作菜单（复制/编辑/分享） | — |
| 双指捏合 | 字体大小调整（可选） | — |

**关键改进**：上下滑动手势是新增项。当前只有左右滑动 [app.js:2150-2181](file:///home/w/proj/software/lx/app.js#L2150-2181)，单手操作时仍需点击底部按钮。上下滑动让"刷题→掌握/错题"形成单手闭环。

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
         │  🖨️ 打印 PDF      │
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

**移动端行为**：
- 宽度 = `min(屏宽 - 56px, 320px)`，保留主界面右侧 56px 可见
- 背景半透明遮罩，点击关闭
- 滑动手势：抽屉打开时右滑关闭
- 锁定背景滚动（`body { overflow: hidden }`）

**桌面端行为**：
- 抽屉常驻右侧，无遮罩
- 主界面与抽屉并排，宽度比例 7:3

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
│  🖨️ 打印 PDF                    │
├─────────────────────────────────┤
│  💾 仅 JSON                     │
├─────────────────────────────────┤
│  取消                           │
└─────────────────────────────────┘
```

从底部滑入，更适合单手操作。

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
- 答错后保留可选状态，加"重做"按钮（当前缺失）

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

**入口**：顶栏 📕 图标（带角标显示错题数）。

**模式特征**：进入后 UI 进一步精简，专注刷错题：

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

**核心改动**（对比当前实现）：
1. 顶栏显示 `3/8 已清空` 进度，给目标感（当前缺失）
2. 底部只有 2 个按钮：掌握 / 跳过
3. 答对一题自动跳下一道错题（当前需手动导航）
4. 全部清空后显示庆祝动画，自动退出
5. **不修改 `statusFilter`**，退出时不需恢复状态——消灭 4 个全局变量

### 8.3 导入预览界面

任何格式文件解析后，弹预览模态框：

```
┌─────────────────────────────────┐
│  📋 解析预览  education.xlsx  ✕ │
├─────────────────────────────────┤
│  ✅ 成功 156 题                  │
│  ⚠️  3 题警告  ❌ 2 题失败       │
│                                 │
│  分类分布                       │
│  教育学基础 42  心理学 38       │
│  课程论 31    教学论 28         │
│                                 │
│  题型分布                       │
│  单选80 多选30 判断20 填空15    │
│                                 │
│  ┌─ 样题预览（前3题）──────┐   │
│  │ #1 [单选] 下列哪项...    │   │
│  │ #2 [多选] 关于皮亚杰...  │   │
│  │ #3 [判断] 建构主义...    │   │
│  └─────────────────────────┘   │
│                                 │
│  ⚠️ 警告详情（3）               │
│  • 第8行：选项不足2个           │
│  • 第15行：题型无法识别         │
│  • 第22行：选项含中文逗号截断   │
│                                 │
│  题库名：[教育学真题集     ]   │
│  ☑ 重复时提示切换               │
│                                 │
│  [取消]  [📥 转Excel]  [✅导入] │
└─────────────────────────────────┘
```

**移动端适配**：
- 全屏模态（屏宽 < 640px 时）
- 内容区滚动，标题与底部按钮固定
- "转 Excel" 按钮支持跨格式互转，不入库直接下载

### 8.4 目录

```
┌─────────────────────────────────┐
│  📋 目录 (156题)            ✕  │
│  [搜索框...]                    │
├─────────────────────────────────┤
│  #1  ✅ 下列哪项属于...        │
│  #2  ⏳ 关于皮亚杰理论...       │
│  #3  📕 建构主义强调...        │
│  ...                            │
└─────────────────────────────────┘
```

- 全屏模态
- 搜索框顶部固定
- 列表项 56px 高，状态图标在左，题号+题摘在右
- 点击跳转并关闭

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
- 重命名用 prompt 替换为内联编辑（移动端 prompt 体验差）
- 支持长按拖动排序（可选）

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
    './style.css',
    './app.js',
    './version.txt',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    // CDN 资源单独处理
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

**注册**（在 `index.html` 或 `main.js`）：

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

- **进度缓存**：`loadProgress()` 内存缓存，避免每次 `JSON.parse`（当前 O(n²) 问题）
- **增量保存**：编辑单题答案时只更新该题，不全量序列化题库
- **题库分页**：目录列表超过 100 项时虚拟滚动

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

```
lx/
├── index.html              ← 入口 HTML（内联关键 CSS）
├── style.css               ← 主样式
├── version.txt             ← 版本号
├── manifest.json           ← PWA 配置
├── sw.js                   ← Service Worker
├── icon-192.png            ← PWA 图标
├── icon-512.png            ← PWA 图标
├── DESIGN.md               ← 本文档
├── README.md
└── src/
    ├── main.js             ← 入口：init + 事件绑定
    ├── state.js            ← 集中状态管理
    ├── storage.js          ← localStorage 读写 + 缓存 + 容量保护
    ├── parsers/
    │   ├── excel.js        ← Excel 解析
    │   ├── pdf.js          ← PDF 解析
    │   ├── json.js         ← JSON 解析
    │   └── text.js         ← 文本解析 + cleanText
    ├── render/
    │   ├── card.js         ← 卡片主调度
    │   ├── essay.js        ← 简答题折叠面板
    │   ├── choice.js       ← 单选/多选
    │   ├── judge.js        ← 判断题
    │   ├── fill.js         ← 填空题
    │   ├── drawer.js       ← 侧边抽屉
    │   └── modal.js        ← 模态框/Action Sheet
    ├── library.js          ← 题库 CRUD
    ├── progress.js         ← 状态机 + 统计（带缓存）
    ├── wrong-book.js       ← 错题专注模式
    ├── category.js         ← 分类管理
    ├── io/
    │   ├── export.js       ← 导出题库
    │   ├── import-preview.js ← 导入预览
    │   └── progress-io.js  ← 进度导入导出
    └── utils.js            ← escapeHtml / copyToClipboard / shuffleArray
```

**注意**：ES Module 在 `file://` 协议下会被 CORS 拦截，必须通过 HTTP 访问。GitHub Pages 部署无问题，本地开发需 `python -m http.server` 或 `npx serve`。

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

## 十四、实施路径

按风险与收益排序，分 5 阶段：

### 阶段 1：UI 重构（核心）
- 新建 `style.css` 移动端优先样式
- 重构 `index.html` 结构（顶栏 + 卡片 + 底部操作 + 抽屉骨架）
- 重构 `renderCard` 函数（按题型拆分）
- 实现侧边抽屉
- 实现简答题折叠面板
- 移除统计圆环，改文字进度
- filter bar 移入抽屉

**风险**：中。改动量大但逻辑不变。

### 阶段 2：错题专注模式
- 新增 `wrong-book.js` 模块
- 顶栏错题入口 + 角标
- 专注模式 UI（精简布局 + 进度显示 + 庆祝动画）
- 删除 `savedCategoryBeforeWrongBook` 等 4 个全局变量
- 不再修改 `statusFilter`

**风险**：低。新增功能，不动旧逻辑。

### 阶段 3：导入导出重构
- 统一导入入口（抽屉里）
- 实现解析预览界面
- 结构化错误反馈（warnings/errors）
- 修复 Excel 导出列错位 bug
- 去掉选项解析的中文逗号分隔符
- JSON schema 标准化（加 version 字段）
- 重复检测改用指纹
- 新增模板下载
- 新增跨格式互转

**风险**：中。解析逻辑改动需充分测试。

### 阶段 4：PWA 支持
- 创建 `manifest.json`
- 创建 `sw.js`
- 生成图标（192/512）
- 注册 Service Worker
- 测试离线可用性

**风险**：低。新增独立功能。

### 阶段 5：模块拆分
- 把 `app.js`（2309 行）拆成 `src/` 下 ES Module
- 抽 `state.js` 集中状态
- 抽 `storage.js` 加缓存与容量保护
- 各题型渲染独立模块
- 解析器独立模块

**风险**：中。纯重构，需回归测试所有功能。

---

## 十五、验收标准

移动端体验验收清单：

- [ ] iPhone SE（375×667）一屏内可见顶栏 + 题目 + 底部操作
- [ ] 单手握持下拇指可达所有底部按钮
- [ ] 左右滑动切换题目流畅（60fps）
- [ ] 上下滑动标记掌握/错题可用
- [ ] 选项点击响应 < 100ms
- [ ] 抽屉滑入/滑出动画流畅
- [ ] 模态框在键盘弹起时不遮挡输入框
- [ ] 刘海屏 / 底部 Home Indicator 不遮挡内容
- [ ] 离线下可完整刷题（已缓存题库）
- [ ] 添加到主屏幕后无浏览器 UI
- [ ] 平板（768px）布局居中不撑满
- [ ] 桌面（1280px+）双列布局，抽屉常驻

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

| 快捷键 | 作用 |
|--------|------|
| `←` / `→` | 上/下一题 |
| `↑` / `↓` | 标记掌握 / 加入错题 |
| `Space` | 显示/隐藏解析 |
| `M` | 标记掌握 |
| `R` | 加入错题 |
| `Esc` | 关闭模态框 / 退出抽屉 |
| `Ctrl+K` | 打开命令面板（搜索题目、跳转） |
| `Ctrl+S` | 备份进度 |
| `?` | 显示快捷键帮助 |

### 21.2 命令面板（Ctrl+K）

桌面端独有，快速搜索 + 跳转：

```
┌─────────────────────────────────┐
│  🔍 搜索题目或命令...           │
├─────────────────────────────────┤
│  跳转到                          │
│  → #42 下列哪项属于...          │
│  → #57 简述皮亚杰...            │
│                                 │
│  命令                            │
│  → 切换到"心理学"题库           │
│  → 进入错题专注模式             │
│  → 导出当前题库                 │
└─────────────────────────────────┘
```

### 21.3 Hover 状态

桌面端鼠标 hover 时显示额外信息：
- 题目卡片 hover：显示完整题目（如被截断）
- 选项 hover：高亮预览
- 按钮 hover：显示快捷键提示

### 21.4 开发者工具

PC 端在 URL 加 `?dev=1` 时启用：
- 顶部显示 API 调用日志
- 右侧显示当前 state 快照
- 底部显示性能指标（render 耗时、storage 大小）

---

## 二十二、架构调整总结

### 22.1 文件结构（更新）

```
lx/
├── index.html              ← 主应用入口（移动端 UI）
├── test.html               ← 测试控制台入口（PC 优先）
├── style.css
├── test-style.css          ← 测试控制台样式
├── version.txt
├── manifest.json
├── sw.js
├── icon-192.png
├── icon-512.png
├── DESIGN.md
├── README.md
│
├── src/
│   ├── main.js             ← 主应用入口
│   ├── test-main.js        ← 测试控制台入口
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
│  index.html     │     │  test.html      │
│  移动端 UI       │     │  PC 测试控制台   │
│  main.js        │     │  test-main.js   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌────────────────┐
            │  src/api/      │  ← 同一套 API
            │  src/core/     │  ← 同一套核心
            └────────────────┘
```

**核心约束**：`api/` 和 `core/` 在两个入口下表现完全一致。测试控制台调用的是用户实际使用的代码，而非 mock。

### 22.3 API 启用策略

```js
// src/api/index.js
import { LibraryAPI, QuestionAPI, /* ... */ } from './';

// 始终挂载核心 API
window.LX = {
    version: APP_VERSION,
    LibraryAPI, QuestionAPI, ProgressAPI, NavigationAPI,
    WrongBookAPI, CategoryAPI, IOAPI, StatsAPI,
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

## 二十三、实施路径（更新）

### 阶段 1：核心层 + API 层（新增，最高优先级）

**先建 API，再做 UI**。这样后续 UI 重构可以直接调用 API，并同步可测。

- 抽 `core/storage.js` + 缓存 + 容量保护
- 抽 `core/state.js` + `core/events.js`
- 实现 `api/` 下所有 API（包装现有逻辑）
- 挂载 `window.LX`
- 编写单元测试骨架

**风险**：中。需把现有 IIFE 里的逻辑拆出来，但 UI 暂不动。

### 阶段 2：PC 测试控制台

- 新建 `test.html` + `test-style.css` + `test-main.js`
- 实现 REPL + 测试运行器
- 完成全部单元测试用例
- 接入 GitHub Actions

**风险**：低。新文件，不影响主应用。

### 阶段 3：移动端 UI 重构

- 用阶段 1 的 API 重写 `render/`
- 实现 DESIGN.md 第六~八章的所有 UI 设计
- 移动端为主，PC 端适配延伸

**风险**：中。改动大，但有 API 兜底，可逐步迁移。

### 阶段 4：错题专注模式 + 导入预览

- 实现 `WrongBookAPI.enter/exit`
- 实现导入预览界面
- 跨格式互转

**风险**：低。

### 阶段 5：PWA + 模块化收尾

- manifest + sw + 图标
- 删除旧 `app.js`
- 完善回归测试

**风险**：低。

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

---

**文档结束**

如需调整任何设计决策，请直接在本文件对应章节修改并更新版本号。
