# lx — 纯静态刷题网页

> **零后端、零构建、零运行时 npm 依赖**：源码即部署文件，`app.html` 直接在浏览器跑。所有数据保存在浏览器 localStorage。  
> 仓库根目录可有 `package.json`，但**仅**承载 Playwright 等开发/CI 工具（`devDependencies`），不参与用户侧加载。

## 快速开始

```bash
# 一行启动本地开发服务器（自动开浏览器 + 带 no-cache 清缓存）
./serve.sh

# 只起服务器
./serve.sh --no-open
```

然后打开：
- UI：http://127.0.0.1:8080/app.html（支持 PWA：`manifest.json` + Service Worker，可加到主屏幕 / 离线刷题）
- 测试控制台：http://127.0.0.1:8080/test.html （点「▶ 运行全部」，目标 **全通过**；支持 `?autorun=1` 无头跑测；可展开「应用预览」内嵌真 app）

> **第一次用？** 打开 `app.html` 后，首页空状态点「📚 加载示例题库」即可体验（内置 10 学科分类、50 题、5 种题型全覆盖，可随时删除）。

在线预览：
- 稳定版：https://zefengwang.github.io/lx/app.html
- 预览版（v3-preview）：https://zefengwang.github.io/lx/v3-preview/app.html

**测试与 CI**：日常只需打开 `test.html`（零 npm）。CI / 可选 E2E 需要 Node：`npm install` 后 `npx playwright test`（仅 `devDependencies`，不进运行时）。详见 [`docs/TESTING.md`](docs/TESTING.md) §0.1 / §0.2。

## 文档总入口（开发者 & 维护者必读）

> **所有接手人员先从下面 4 个文档读起**，顺序：MAINTENANCE → CONTRACT-core → CONTRACT-api → types.js。

| 文档 | 说明 | 路径 |
|---|---|---|
| **📘 开发与维护手册** | **总入口**：架构说明、调试排障 SOP、测试体系、版本与部署流程、历次 Bug 索引表、新增功能范式、FAQ | [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md) |
| 🔗 core ↔ api 接口契约 | core 层（基础层）对外给 api 层（业务层）的函数、错误码、事件、状态结构 | [`docs/CONTRACT-core.md`](docs/CONTRACT-core.md) |
| 🔗 api ↔ UI 接口契约 | `window.LX.*` 给 UI 层的全部 API（LibraryAPI、QuestionAPI、WrongBookAPI…）| [`docs/CONTRACT-api.md`](docs/CONTRACT-api.md) |
| 🏷️ 全局类型定义（JSDoc） | 无运行时代码，只做 IDE 静态检查；所有题目 / Result / AnswerResult 等类型 | [`src/types.js`](src/types.js) |
| 🧪 测试体系 | 分层测例、设计即测红线、覆盖债 | [`docs/TESTING.md`](docs/TESTING.md) |
| 📋 覆盖补齐计划 | UI/api/core/交互工作量与 P0–P2 | [`docs/COVERAGE-PLAN.md`](docs/COVERAGE-PLAN.md) |
| 🔎 题干搜索 | 已实现（v3.1.0）；方案与测例清单 | [`docs/FEATURE-search.md`](docs/FEATURE-search.md) |

**一句话快速判断该看哪份：**
- "这个 bug 怎么修 / 测试怎么跑 / 怎么部署？" → **看 MAINTENANCE.md**
- "QuestionAPI.answer 的参数到底传字符串还是数组？返回什么？" → **看 CONTRACT-api.md**
- "localStorage 存什么 key / 错误码 STORAGE_FULL 怎么返回？" → **看 CONTRACT-core.md**
- "为什么 IDE 报类型不匹配？" → **看 src/types.js**

## 版本号

当前版本：**3.2.0**（[version.txt](version.txt) ↔ [src/api/index.js](src/api/index.js) 的 `VERSION` 常量，两者必须同步）

**唯一测试控制台**：[`test.html`](test.html)（见 [`docs/TESTING.md`](docs/TESTING.md)）。  
Agent 可用 `python3 tools/run-tests.py` 无头驱动同一页面并落盘 JSON，**不是第二套框架**。  

**项目约束（红线）**：  
1. 新增功能必须加单测，并纳入 system/integration；新增接口同步 CONTRACT / types / 设计文档。  
2. **设计即测**：每个功能开工前规划可测钩子与测例；UI 每个控件、core/api 每个导出同 PR 覆盖；禁止「做完再补、用到才发现不可测」。  
3. **SAR 单测**：每个功能点覆盖不同初始状态 S，给定可接受 action A，断言预期 response R（见 `TESTING.md` §2.2）；禁止只测 happy path。  
4. 当前覆盖仍有债（UI/api/core 均未 100%）——以 `TESTING.md` §覆盖债为准，不得对外宣称已全覆盖。  
5. **帮助同步**：用户可见的新功能或行为变更，必须同 PR 更新 [`src/render/pages/help.js`](src/render/pages/help.js) 对应说明；禁止只改代码不改帮助。  
6. **测例可复现**：汇报/验收某条测例时，须给出套件名、用例名，以及在 `test.html` 用例目录「填充」后的 `LXTest.runCase(...)` 命令（见 [`docs/TESTING.md`](docs/TESTING.md) §0）；禁止只报「全绿」。

## 三层架构一览（单向依赖，禁止反向）

```
render/  (UI 层)      ← 只能 import api/；产出 DOM、toast、主题、路由
  └ session/         ← UI 会话子层（跨页搜索草稿/面板等；pages 可依赖，api 禁止依赖）
   ▲ 单向调用（window.LX.*）
api/     (业务层)     ← 只能 import core/；产出 QuestionAPI / WrongBookAPI ...
   ▲ 单向调用（Result + 事件）
core/    (基础层)     ← 零 DOM、零业务依赖；状态机、存储、解析、校验、错误码
```

**禁止反向依赖：** core 不能 import api/render，render 不能 import core；api 不能 import `render/session`。详细规则见 `docs/MAINTENANCE.md` §2 / §2.1.1。

## 入口文件约定（防止版本不一致）

> 🔴 **维护铁律**：任何 HTML 修改（改 `<title>`、改 CDN 顺序、改启动脚本）**只改 app.html 这一份**，禁止把 app.html 拷回 index.html。

| 文件 | 职责 | 为什么这么做 |
|---|---|---|
| **app.html** | **唯一真入口**：UI 外壳 + 外链 CDN + `<script src="./src/main.js">` 启动应用 | 实际加载 UI 的页面，所有改动集中在此 |
| **index.html** | **纯跳转壳**：`<meta http-equiv="refresh" content="0; url=./app.html">` 0 秒跳到 app.html，附带无自动跳转时的兜底链接 | GitHub Pages / 静态托管访问目录路径（`/lx/`）时默认找 index.html；**绝对不要把 app.html 内容复制一份到 index.html**（过去两份拷贝踩过"只改一份导致线上版本漂移"的坑） |

v3-preview/ 子目录同样遵守"index 只跳转、app 才是真入口"的约定（详见 `docs/MAINTENANCE.md` §9 FAQ）。
