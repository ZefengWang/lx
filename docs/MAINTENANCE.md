# 开发与维护手册

> 适用读者：接手 `lx`（刷题网页）的后续开发与维护人员。  
> 阅读顺序建议：1 → 2 → 3 → 5；4/6/7 留作排障和上线时查阅。

---

## 1. 项目简介与快速启动

### 1.1 项目定位
**纯静态网页刷题器**（零后端、零构建工具链）。所有数据保存在浏览器 `localStorage`，部署即发布为静态文件目录（GitHub Pages / Nginx / 任何静态托管）。

> 🔴 **最强约束（铁律，不得突破）**
> - **零构建**：不用 Vite / Webpack / Rollup / TS 编译。源码就是部署文件，`app.html` 直接用 `<script type="module">` 跑。
> - **零后端**：不依赖任何 HTTP API；所有持久化 = `localStorage`；导出为 xlsx/json = 浏览器端生成 Blob。
> - **零 npm 依赖**（运行时）：只有测试脚本和 dev-server 用 node/python；运行时只外链 SheetJS（CDN）。

### 1.2 目录速览
```
lx/
├── app.html                # 主入口（UI 外壳 + 挂载点 + 外链 CDN）
├── index.html              # 静态托管首页（可重定向到 app.html）
├── style.css               # 全局样式（基础/布局/按钮）
├── test.html               # 测试控制台入口（浏览器打开即跑 52 项测试）
├── test-style.css
├── version.txt             # 版本号（与 src/api/index.js VERSION 同步）
├── serve.sh                # 一行起开发服务器（推荐）
├── src/
│   ├── main.js             # render 层入口：bootstrap + 路由挂载
│   ├── bootstrap.js        # 三层装配：import core + api → 挂 window.LX
│   ├── types.js            # 全局 JSDoc 类型（无运行时代码）
│   ├── utils.js
│   ├── core/               # 基础层（零 DOM、零业务）
│   │   ├── errors.js       # Result Monad + ErrorCode 枚举
│   │   ├── events.js       # 事件总线 bus + Events 枚举
│   │   ├── id.js
│   │   ├── state.js        # 全局状态 setState / getState
│   │   ├── storage.js      # localStorage 读写 + 迁移
│   │   ├── validators/question.js
│   │   └── parsers/        # excel / json / csv / text / pdf 解析
│   ├── api/                # 业务层（装配 window.LX.*）
│   │   ├── index.js        # mountLX() 总装 + VERSION 常量
│   │   ├── library.js      # 题库 CRUD
│   │   ├── question.js     # 答题判分（核心判分逻辑）
│   │   ├── progress.js     # 题目标记（none/mastered/review）
│   │   ├── navigation.js   # 上/下题、筛选、索引
│   │   ├── wrong-book.js   # 错题本 enter / exit / markMastered
│   │   ├── category.js
│   │   ├── stats.js        # 掌握率/分类统计
│   │   ├── io.js           # 导入 / 导出（Excel/JSON/CSV）
│   │   └── test.js         # 测试用 TestAPI（仅 ?test=1 时挂载）
│   └── render/             # UI 层（零业务逻辑）
│       ├── main-ui.js      # 顶层渲染 + 路由
│       ├── router.js       # Hash 路由：#/home /study /wrong /stats ...
│       ├── card.js         # 题目卡片渲染（5 种题型 + 确认答案按钮）
│       ├── bind.js         # bindEvents / bindRefresh 事件订阅工具
│       ├── bottombar.js / topbar.js / drawer.js / logo.js
│       ├── toast.js        # toastInfo / toastSuccess / toastPrimary ...
│       ├── theme.js  / theme.css / components.css
│       ├── gestures.js     # 键盘守护 + 手势
│       ├── dom.js
│       └── pages/          # 各页面（见 §2.4）
│           ├── home.js / study.js / wrongbook.js
│           ├── catalog.js / stats.js / settings.js
│           ├── add-question.js / help.js
├── test/                   # 52 项单元/集成/回归测试
│   ├── index.js            # 测试入口（test.html 加载）
│   ├── runner.js / assert.js / helpers.js
│   ├── unit/               # 单模块测试
│   ├── integration/        # 跨模块流程（学习/错题循环/导入导出…）
│   ├── regression/         # Bug 回归锁（bugs / multi-wrongbook）
│   ├── scenarios/seed.js   # 测试用种子数据（small/large）
│   └── fixtures/           # Excel/JSON 夹具
├── docs/
│   ├── CONTRACT-core.md    # core ↔ api  接口契约（必看）
│   ├── CONTRACT-api.md     # api  ↔ UI  接口契约（必看）
│   └── MAINTENANCE.md      # 本文档
└── tools/dev-server.py     # serve.sh 调用：自定义 Python HTTP 服务器（带 no-cache + MIME）
```

### 1.3 一行起开发环境
```bash
# 推荐方式：自动开浏览器 + 自动杀旧进程 + 强制 no-cache
./serve.sh

# 只起服务器，不开浏览器
./serve.sh --no-open

# 指定端口
./serve.sh 8081
```

然后在浏览器打开：
- UI：http://127.0.0.1:8080/app.html
- 测试：http://127.0.0.1:8080/test.html  （页面加载后点「▶ 运行全部」）
- 测试模式 UI：http://127.0.0.1:8080/app.html?test=1  （挂上 `LX.TestAPI`）

---

## 2. 三层架构与代码边界

> **不要靠"默契"跨层做事**——如果不知道某行代码该写在哪一层，先读本节 + 两份 CONTRACT 文档。

### 2.1 分层依赖关系（单向依赖，禁止反向）

```
┌─────────────────────────────────────────────┐
│  render/ (UI 层)                             │  只能 import：api/  + 同层 render/
│                                              │  能直接用：window.LX.*（业务 API）
│  卡片、页面、toast、主题、路由、手势、事件订阅 │  绝对不能 import：core/
├─────────────────────────────────────────────┤
│  api/ (业务层)                               │  只能 import：core/ + 同层 api/
│                                              │  产出物：window.LX.LibraryAPI / QuestionAPI ...
│  题库 CRUD、判分、错题本流程、导入导出、统计   │  绝对不能 import：render/（不得碰 DOM）
├─────────────────────────────────────────────┤
│  core/ (基础层)                              │  只能 import：同层 core/
│                                              │  严禁使用：document / window / localStorage 之外的 BOM
│  状态机、事件总线、存储、解析器、校验、错误码   │  严禁 import：api/、render/
└─────────────────────────────────────────────┘
```

> 🧪 **快速自查某模块是否越界**：看 `import` 语句。任何 `core/xxx.js` 里出现 `import '../api/'` 或 `'../render/'` 都是违规；任何 `render/pages/xxx.js` 里出现 `import '../core/'` 都是违规。

### 2.2 各层新增功能的标准流程

以"新增一个题型（如排序题 `order`）"为例：

| 步骤 | 位置 | 做什么 |
|---|---|---|
| ① 类型与契约 | `src/types.js` + `docs/CONTRACT-core.md` | 在 `QuestionType` 枚举加 `'order'`；同步改契约 |
| ② 判分与校验 | `core/validators/question.js` + `src/api/question.js` | 为 order 写 normalize + 判分逻辑（返回 Result） |
| ③ 事件与状态 | `src/core/state.js`（如需新字段）+ `core/events.js`（如需新事件） | 一般不用动；除非需要新全局状态 |
| ④ API 暴露 | `src/api/index.js` | QuestionAPI 自动走 question.js；一般不用改，除非加新 API 域 |
| ⑤ 单元测试 | `test/unit/question.test.js` | 加 3-5 条覆盖：判对/判错/边界/顺序无关等 |
| ⑥ UI 渲染 | `src/render/card.js`（加 `renderOrder` 函数 + `renderOptions` 中分支） | 只负责画 DOM + 把用户输入通过 `ctx.onAnswer` 回传，不写判分 |
| ⑦ 各页面兼容 | `study.js` / `wrongbook.js` / `add-question.js` | 确保各页 handleAnswer 对新题型分支有默认兜底或显式处理 |
| ⑧ 集成测试 | `test/integration/study-flow.test.js` | 走一遍导入→答题→标记完整流 |
| ⑨ 版本号 | `src/api/index.js` 的 `VERSION` + `version.txt` | 保持两者同步（见 §6.1） |

### 2.3 事件总线（跨层解耦唯一通道）

**api 层绝不会直接"刷新 UI"——只会发事件；render 层只订阅事件来重绘。**

发送方（api 层）：
```js
// src/api/progress.js 内部
bus.emit(Events.QUESTION_STATUS_CHANGED, { libId, qId, oldStatus, newStatus, source });
```

订阅方（render 层）：
```js
// 任何页面
const unbind = bindEvents({
    [LX.Events.QUESTION_STATUS_CHANGED]: (payload) => refresh(),
    [LX.Events.LIBRARY_SWITCHED]:         () => refresh(),
});
// 页面退出时调用 unbind() 取消订阅（防止内存泄漏）
```

**常用事件列表**（完整见 `core/events.js` 的 `Events` 枚举 + CONTRACT-core.md）：
- `LIBRARY_SWITCHED` / `LIBRARY_CREATED` / `LIBRARY_DELETED`
- `QUESTION_ANSWERED` / `QUESTION_STATUS_CHANGED`
- `WRONGBOOK_ENTERED` / `WRONGBOOK_EXITED` / `WRONGBOOK_CLEARED`
- `THEME_CHANGED` / `MODE_CHANGED`
- `NAV_CHANGED`

### 2.4 Render 层各页面职责一览

| 页面路由 | 文件 | 职责 | 本地状态 |
|---|---|---|---|
| `#/home` | `pages/home.js` | 首页：题库列表、开始学习、错题入口 | 无 |
| `#/study` | `pages/study.js` | 核心刷题页：逐题作答、状态切换、重置 | `viewState.selectedAnswers/revealed/essayActiveTab` |
| `#/wrong` | `pages/wrongbook.js` | 错题专注模式：只展示 review 题 + 答对自动移出 | `_localState.selectedAnswers/revealed` |
| `#/catalog` | `pages/catalog.js` | 目录页：分类、状态筛选、快速跳转 | 无（全局状态驱动） |
| `#/stats` | `pages/stats.js` | 统计页：掌握率/分类型/分类概览 | 无 |
| `#/settings` | `pages/settings.js` | 设置页：主题、模式、导入导出、数据管理 | 无 |
| `#/add` | `pages/add-question.js` | 单题新增/编辑页 | 临时表单状态 |
| `#/help` | `pages/help.js` | 使用帮助（静态） | 无 |

---

## 3. 调试与排障手册

### 3.1 UI 渲染异常的标准排查步骤（SOP）

> 以刚修复的「错题本多选确认答案计数累加」为例，演示标准步骤。

**Step 1 — 先复现，再谈调试**
```
进入错题本 → 点两个选项 → 点「确认答案」→ 观察现象
 预期：确认后 revealed、选项红绿高亮、计数 2 → 按钮消失
 实装：确认后仍然可点、计数从 2 变成更大数字（累加）
```

**Step 2 — 打 2 个 log 就够（入口 + 出口）**  
不要在代码里撒 10 个 console。只打两个：
- **UI 触发处（card.js 的"确认答案"按钮 onclick）**：打印调用参数
- **业务回调处（wrongbook.js 的 handleAnswer 函数头）**：打印实际接收到的参数

```js
// card.js 确认按钮 onclick
console.log('[card:确认答案点击] selected=', selected,
    Array.isArray(selected)?'ARRAY len='+selected.length : typeof selected);

// wrongbook.js handleAnswer 开头
console.log('[wrongbook:handleAnswer] answer=', answer,
    'answerType=', Array.isArray(answer)?'ARRAY len='+answer.length : typeof answer,
    'opts=', opts);
```

对比两侧输出，**一眼看到"参数漏传/类型错误"**：
```
[card]                   selected= [A,B]   ARRAY len=2   ← 传了数组 + 隐式 commit:true
[wrongbook:handleAnswer] answer= [A,B]   opts= {}        ← opts.commit 丢了！
```

**Step 3 — 定位"丢参数"在哪一层**  
对比 study.js（正常）和 wrongbook.js（异常）的 onAnswer 包装：
```js
// study.js ✅ 正常（3 参全传）
onAnswer: (qq, answer, opts = {}) => handleAnswer(qq, answer, opts),
// wrongbook.js ❌ 旧代码（只接 2 参）
onAnswer: (qq, ans) => handleAnswer(qq, ans),
```

**Step 4 — 修复 → 浏览器再复现一遍人工验证 → 跑 52 测试 → 清理 debug log**  
修复后务必再走一遍手动流程 + 跑测试；最后删掉临时 console.log。

### 3.2 常见 UI 异常速查表

| 现象 | 最可能的根因（按概率排序） | 验证方法 |
|---|---|---|
| 点击确认答案无反应 / 无 toast | `opts.commit:true` 漏传（§7.1 BUG-013 同款） | 在 handleAnswer 头打 log 看 opts |
| 多选计数累加（已选 N 项 → N+N） | 把数组当单个元素 push（同上） | 同上 + 读 study.js 对照写法 |
| 切换题库后渲染空题库 | `filteredQIds` 懒重建未触发 | 打 `LX.NavigationAPI.current().data` |
| 刷新后回空题库 | `getLastLibraryId` 恢复逻辑异常 | 看 app storage 的 `lx:lastLibId` key |
| 多选选错没入错题本 | `isWrongBookMode` 守卫 / autoStatus 为 null | 看 `AnswerResult.autoStatus` |
| 答对仍然留在错题本 | UI 层未显式调 `ProgressAPI.setStatus(q,'mastered')` 或 `WrongBookAPI.markMastered(q)` | 检查 commit 分支是否手动 setStatus |
| 颜色/主题切换但某些组件不变 | 用了写死 HEX 而非 `var(--lx-primary)` | 全局 grep `#6366f1` / `#` 排查 |
| 选项布局抖动 | 确认按钮占位 disabled 被写死成空串而非保留高度 | 查 card.js L146 的 disabled 写法 |
| 事件订阅泄漏 + 渲染多次 | 页面 unmount 未取消订阅 | 用 `bindEvents()` 返回的 unbind 函数 |

### 3.3 调试时的强力武器：`LX.TestAPI`（测试模式）

```
访问：app.html?test=1
```

挂上 `LX.TestAPI` 后，在 DevTools Console 可直接：
```js
LX.TestAPI.reset();                                     // 清空 localStorage
LX.TestAPI.seed('small');                               // 造 10 题演示题库
LX.TestAPI.seed('large');                               // 造 100 题演示题库
const s = LX.TestAPI.snapshot();                        // 保存当前状态快照
LX.TestAPI.restore(s);                                  // 还原快照（反复复现同一状态）
LX.TestAPI.undoLast();                                  // 撤销最后一次 API 调用
```

### 3.4 日志约定

- **严禁提交带 `console.log` 的代码**（调试用一律清理，除非是 `console.info('[lx] ...')` 启动日志）。
- 生产代码允许 `console.warn('[lx] ...')` 和 `console.error('[lx] ...')` 用于可恢复异常。
- 启动日志统一前缀 `[lx]`（见 bootstrap.js L102）。

---

## 4. 测试体系

### 4.1 运行方式

浏览器打开 **test.html** → 点「▶ 运行全部」。目标：**52/52 必须全通过**，任何 1 项失败不得部署。

### 4.2 测试目录结构

```
test/
├── unit/          单模块 API：按模块单独覆盖（library/question/progress …）
├── integration/   跨模块流程：学习流、错题循环、导入导出、进度备份、多题库切换、分类合并
└── regression/    Bug 回归锁：
    ├── bugs.test.js              BUG-001 ~ BUG-011 共 13 条历史回归
    └── multi-wrongbook.test.js   多选错题本 4 条（v2.6.2 + v3.0.1）
```

### 4.3 写新测试的约定（`test/helpers.js`）

```js
import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertTrue, assertFalse } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('我的新回归', () => {
    let LX;
    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
    });

    it('场景描述（期望行为）', () => {
        // 只调用 LX.* API，不操作 DOM
        const r = LX.LibraryAPI.create(...);
        assertOk(r);
        ...
    });
});
```

> 🧪 **铁律**：render 层 bug（如 §7.1 BUG-013）只靠 API 层测试测不出来。  
> 所以**必须写 regression 测试锁 API 层不变**，再**加上 §3 的浏览器人工复现**验证 UI 契约对齐。如果将来 UI 层也需要自动化，可以考虑给 render 层写"调用参数断言"的轻量回归测试（不操作 DOM，只测包装函数是否正确透传 3 参）。

### 4.4 测试失败的标准动作

1. **先看失败项标题**（如「回归：错题本多选题流程 中的"多选题数组传参不爆炸"」）。
2. **对照 §7「历次 Bug 汇总表」** 看修复点是否被误回滚。
3. 如果是新特性破坏现有，**优先改新特性代码而非改老测试**。
4. 只有在能清晰陈述"原测试本身写错"的证据时，才允许改测试，并在 commit message 里写明理由+代码引用。

---

## 5. 契约文档（修改任何接口前必读）

| 文档 | 解决什么问题 | 什么时候读 |
|---|---|---|
| [CONTRACT-core.md](./CONTRACT-core.md) | `core/*` 对外给 `api/*` 的全部接口：Result 类型、错误码、事件枚举、全局状态结构、存储 schema、解析器返回 | 写 api 层新功能、改 core 层函数签名 |
| [CONTRACT-api.md](./CONTRACT-api.md) | `window.LX.*` 给 UI 层的 API 域：方法名、参数、返回值（`QuestionAPI.answer`、`WrongBookAPI.enter` 等）+ 事件 payload | 写 render 层新页面 / 调业务 API / 扩展 API 域 |
| [types.js](../src/types.js) | 全局 JSDoc 类型（无运行时代码），IDE 静态检查依据 | 改数据结构 / 字段名 / 枚举值 |

> 🚩 **任何一次修改契约**（增删字段、改枚举、改返回值格式）都必须三件套同步改：
> 1. `src/types.js`
> 2. `docs/CONTRACT-*.md`
> 3. 对应测试文件（加断言覆盖新行为）

---

## 6. 版本与部署流程

### 6.1 版本号
- 位置：`src/api/index.js` 的 `VERSION` 常量 + `version.txt`
- 两者必须同步，**任何代码改动上线前都 bump**：
  - 修复 bug：`3.0.0 → 3.0.1`
  - 加不破坏兼容的功能：`3.0.1 → 3.1.0`
  - 破坏性变更（API 契约 break）：`3.1.0 → 4.0.0`
- 启动日志 `[lx] ready, version: X.X.X` 校验版本一致。

### 6.2 部署（GitHub Pages：主分支 = 线上根目录 + v3-preview 预览子目录）
> 目标：线上稳定版在 `https://zefengwang.github.io/lx/`，预览版在 `/v3-preview/` 互不影响。

**Step 1 — 同步预览副本**
```bash
rsync -a --exclude='.git' --exclude='v3-preview' --exclude='node_modules' --exclude='_tmp_*' . v3-preview/
```

**Step 2 — 验证本地**
```bash
# 本地 52 测试通过（浏览器访问 test.html）
# 预览版本地验证：http://127.0.0.1:8080/v3-preview/app.html
```

**Step 3 — 提交 & 推送**
```bash
git add -A
git commit -m "feat|fix|docs|refactor(scope): 一句话说明 + 版本号
详细说明（修复链路、影响点、测试结果）。例如：

fix(wrongbook): 修复错题本多选确认答案计数累加 v3.0.1
 - 根因：wrongbook.js onAnswer 漏传 opts.commit:true
 - 52/52 通过 + 浏览器人工验证 A,B,C 确认后不累加"
git push
```

> ✅ **推到 main 分支之后 GitHub Pages 自动发布**，等 1-2 分钟即可：  
> 稳定版：https://zefengwang.github.io/lx/app.html  
> 预览版：https://zefengwang.github.io/lx/v3-preview/app.html

### 6.3 回滚
```bash
git revert <commit-hash>
git push
```
- 不要 `git push --force`。
- 预览版回滚只需再 rsync 一版旧的 v3-preview 再 push。

---

## 7. 历次 Bug 汇总与回归锁（查 Bug 先看这节）

### 7.1 完整 Bug 索引表

| ID | 标题 | 根因 | 修复位置 | 回归测试位置 |
|---|---|---|---|---|
| BUG-001 | exportLibrary xlsx 列对齐错位 | 导出表头与 data 数组映射列偏移 | `src/api/io.js`（exportLibrary） | `bugs.test.js` BUG-001 |
| BUG-002 | 含中文逗号选项被错误截断 | 解析器 `split(/[，,]/)` 全局切分导致 | `core/parsers/text.js` + `excel.js` | `bugs.test.js` BUG-002 |
| BUG-003 | localStorage 写满抛异常中断流程 | 未对 QuotaExceeded 做 Result 包装 | `core/storage.js` try/catch + `err(STORAGE_FULL)` | `bugs.test.js` BUG-003 |
| BUG-004 | 快速 100 次 setStatus 卡顿 | 每次 setState 全量写 localStorage | `ProgressAPI` 缓存命中只读 | `progress.test.js` + BUG-004 |
| BUG-005 | input/textarea 内按方向键触发切题 | 键盘监听未排除表单控件 | `attachKeyboardGuard` 忽略 editable | `bugs.test.js` BUG-005/005b/005c |
| BUG-006 | 二次导入同内容触发误报 DUPLICATE 且序号丢失 | 题库指纹比较 + 导入去重逻辑 | `IOAPI.importLibrary` | `bugs.test.js` BUG-006 |
| BUG-007 | 选项独立列（A/B/C/D 分列）未合并为 options 数组 | Excel 表头未做 column→options 合并 | `core/parsers/excel.js` 表头归一化 | `bugs.test.js` BUG-007 |
| BUG-008 | 无题型列时答案格式推断（single/multi/judge）不准 | 按答案特征（逗号分隔 / 对/错 / 单选字母）推断 | `core/parsers/excel.js` 推断逻辑 | `bugs.test.js` BUG-008 |
| BUG-009 | 分类优先取"题目类别/类别"列，缺则 Sheet 名兜底 | 旧代码只取列名之一导致错分类 | `core/parsers/excel.js` 分类字段优先级 | `bugs.test.js` BUG-009 |
| BUG-010 | 数字开头分类标题（"2027安徽xxx"）被误判数据行 | 表头识别只用文本/空白判断 | `core/parsers/excel.js` 表头/数据行分类器 | `bugs.test.js` BUG-010 |
| BUG-011 | 数据行含"口诀/解析/答案"等关键词被误识别重复表头 | 关键词匹配太宽 | `core/parsers/excel.js` 关键字黑名单收敛 | `bugs.test.js` BUG-011 |
| — *(v2.6.2)* | 错题本多选确认答案后无反馈+计数爆炸(初版) | `wrongbook.js` multi 分支未调 QuestionAPI.answer | `src/render/pages/wrongbook.js` handleAnswer multi 分支 | `multi-wrongbook.test.js` 4 条 |
| **BUG-013** **(v3.0.1)** | **错题本多选确认答案计数再次累加（本次）** | **wrongbook.js onAnswer 回调只接 2 参，漏传 opts（含 commit:true）导致 opts.commit 永远 undefined，走 toggle 分支把数组当单项 append** | **`wrongbook.js:106`**：`(qq, ans) => ...` 改为 `(qq, ans, opts={}) => handleAnswer(qq, ans, opts)` | 见 §7.2：建议补充一个 render 层参数透传测试（下文） |

### 7.2 针对 BUG-013 的防御建议（下次避免）

**所有对 `ctx.onAnswer(q, answer, opts)` 的包装，一律参考 study.js 写法，三个参数写全**：

```js
// ✅ 正确（3 参全透传，带默认值兜底）
onAnswer: (qq, answer, opts = {}) => handleAnswer(qq, answer, opts),
// ❌ 错误（2 参或遗漏 opts，任何时候都不要这样写）
onAnswer: (qq, ans) => handleAnswer(qq, ans),
```

> 这条"三参全透传"约定已经写入本文档。如果项目后续新增了新页面（例如 `flashcard.js`），**模板直接复制 study.js 的 onAnswer 行**。

### 7.3 新增 Bug 的登记流程

每次修完 bug，**立即**：
1. 在本表新增一行（ID + 标题 + 根因 + 修复位置 + 回归测试位置）。
2. 在 `test/regression/` 对应文件新增 it()，确保没有相同路径回归。
3. 如果是 render 层 bug（UI 契约问题），同时在本手册 §3.2"常见 UI 异常速查表"补一行，方便下次一眼定位。

---

## 8. 常见新功能开发范式（Copy-Paste 模板）

### 8.1 新增页面（路由 + render）
1. `src/render/pages/myfeature.js`：导出 `mount(container, destroy)` 函数（参考 `help.js`）。
2. `src/render/router.js`：在路由表加 `'/myfeature': import('./pages/myfeature.js')`。
3. `topbar.js` / `bottombar.js` / `home.js`：加跳转按钮（`navigate('myfeature')`）。
4. 记得页面卸载时 `unbind()` 事件订阅（用 `bindEvents` 工具）。

### 8.2 新增 API 域（业务能力）
1. `src/api/mydomain.js`：函数全部返回 `Result<T>`，调用 `ok()` / `err()`（见 errors.js）。
2. `src/api/index.js` 的 `mountLX()`：加一行 `MyDomainAPI,` 并 import。
3. `docs/CONTRACT-api.md`：新增 §N 详细写每个函数签名。
4. `test/unit/mydomain.test.js`：补单元测试（至少覆盖成功 + 3 类典型错误）。

### 8.3 新增主题色
1. `style.css` 的 `:root[data-theme="xxx"]` 区块，**必须同时定义**：
   - `--lx-primary` / `--lx-primary-hover` / `--lx-primary-contrast`
   - `--lx-bg`（背景微染）
   - `--lx-surface`（保持纯白或浅色，形成层次）
2. `src/render/theme.js` 的主题枚举列表中追加一项。
3. 用主题切换 toast 必须用 `toastPrimary('...')`（跟随当前色）。

### 8.4 新增事件
1. `core/events.js` 的 `Events` 枚举加新名。
2. `docs/CONTRACT-core.md`：新增事件条目 + payload 类型定义。
3. `src/types.js`：加对应 payload 的 JSDoc typedef。
4. 触发处用 `bus.emit(Events.NEW_NAME, payload)`，订阅处用 `bindEvents({ [LX.Events.NEW_NAME]: handler })`。

---

## 9. 静态网页约束 FAQ

**Q：能加 React/Vue 吗？**  
A：不能。静态网页约束 > 一切。当前 `render/card.js` 的 `h(tag, attrs, children)` + `render(container, vnodes)` 就是超轻量 vDOM，够用且零构建。

**Q：能加 npm 包（React Router / Axios）吗？**  
A：运行时绝对不行。需要的能力全部手写或用 `<script src="CDN">`（目前只用了 SheetJS 解析 Excel，已经在 app.html 里）。

**Q：能换 TypeScript 吗？**  
A：不能引入 tsc 构建链，但可以写 JSDoc + `jsconfig.json`（当前就是这么做的，`src/types.js` 提供类型定义，IDE 会做静态校验）。

**Q：localStorage 超过 5MB 怎么办？**  
A：`core/storage.js` 已经捕获 `QuotaExceededError` 并返回 `STORAGE_FULL` 的 `Result`；提示用户导出 JSON 备份后清理老题库。不要引入 IndexedDB（复杂度过高，维护灾难）。

---

## 10. 文档索引（从 README 进来的总入口）

| 文档 | 路径 |
|---|---|
| 本文档（开发与维护手册） | `docs/MAINTENANCE.md`（本文件） |
| core ↔ api 接口契约 | `docs/CONTRACT-core.md` |
| api ↔ UI 接口契约 | `docs/CONTRACT-api.md` |
| 全局类型定义（JSDoc） | `src/types.js` |
| 事件枚举与状态结构 | `src/core/events.js` + `src/core/state.js` |
| 版本号 | `version.txt` ↔ `src/api/index.js VERSION` |

> 修任何 Bug / 加任何功能之前，先打开本手册 + 两份 CONTRACT 文档 = 30 分钟读完胜过半天试错。
