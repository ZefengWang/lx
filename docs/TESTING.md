# 测试体系说明（v3.0.2+）

> **唯一测试控制台**：`test.html`（用例由 `test/index.js` 注册）。  
> 启动：`./serve.sh --no-open` → http://127.0.0.1:8080/test.html  
> **静态约束**：零构建、零运行时 npm；浏览器内自研 runner。  
>
> Agent/CI：`python3 tools/run-tests.py`（内部走 **`./serve.sh --daemon`**，默认端口 **8080**，与人工一致）无头打开 `test.html?autorun=1`，把 JSON 抄到 `test-results/latest.json`，**不是第二套框架**。  
> 锁「二次点击运行」残留：`test.html?autorun=2`（同一页连跑两轮，任一轮失败则总失败）。  
>
> 注意：DOM id **`#lx-main`** = 应用主内容区（`lx-` 产品前缀 + main），**不是**仓库目录名。

---

## 0.0 非测试同学怎么看覆盖（心智模型）

不必成为专业 QA。记住：**五层必要 + 两层加强**；SAR 是每一层的写法，不是 system 专属。

| 层 | 必要？ | 一句话 | 本仓目录 |
|---|---|---|---|
| **core** | 必要 | 底层算对不对、边界炸不炸 | `test/unit/core/` |
| **api** | 必要 | 每个 `*API` 方法：成功 + 失败码 | `test/unit/*.test.js` |
| **ui** | 必要 | 单个控件在不同初始态下的点击/输入结果 | `test/ui/` |
| **integration** | 必要 | 2～4 个 API 短串（导入→刷题等） | `test/integration/` |
| **system** | 必要 | 真 `app.html` 整页 `#app` 状态差分（iframe SAR 矩阵） | `test/system/` |
| **regression** | 加强 | 修过的坑不再犯 | `test/regression/` |
| **Playwright** | 加强 | CI/真浏览器薄烟雾；**不**替代 SAR 矩阵 | `e2e/` |

**日常只看三个数：**

1. `python3 tools/run-tests.py` → fail=0  
2. 矩阵口径：`docs/testing/UI-SAR-MATRIX.json` 的 N + iframe 可执行比例（见 `UI-STATE-SYSTEM.md`）+ DEFERRED≤5  
3. 有没有「只测 happy、不测取消/失败」的主路径（禁止）

**禁止**用「全仓 658 全绿」宣称测完了。可宣称收口的唯一标准见 [`COVERAGE-PLAN.md` §4](./COVERAGE-PLAN.md)：分层 SAR 对表勾完 + 矩阵 iframe≥90% + 无主路径只-happy。

系统测 **不能**替代 core/api/ui；反过来也不行。最低 SAR：主成功 + 一种对照初始态 + 一种失败/取消。细节见下文 §2.2。

自动化 SAR **优先打在可见预览** `#appPreview`（`app.html?test=1`，运行全部时自动展开）；无预览节点时才用隐藏 `#lxSarAppIframe`。

---

## 0. 单条复现（人工对照）——怎么跑某一条

控制台在「运行全部」之上提供 **用例目录**，之下提供 **单条复现 / 手动对照** 面板（原 REPL 升级）。

| 步骤 | 做什么 |
|---|---|
| 1 | 打开 `test.html`，在「用例目录」用搜索框或层过滤找到目标用例 |
| 2 | 点该行 **填充**：下方「运行命令」写入 `return await LXTest.runCase("套件名","用例名")`，「预期结果」按用例名里 `→ R=…` 生成（可改） |
| 3 | 点 **▶ 运行**（或目录上的 **运行** = 填充并立刻跑） |
| 4 | 看「实际结果」JSON；对照条会提示与预期是否一致——**最终由你人工判定**是否符合业务预期 |

API（挂在 `window.LXTest`，仅测试页）：

- `LXTest.runCase(suiteName, testName)` → `{ ok, status, suite, name, duration?, error? }`
- `LXTest.listCases()` / `LXTest.parseExpectedFromTestName(name)`

批量回归仍用「▶ 运行全部」或 `python3 tools/run-tests.py`。Agent/汇报复现某条时，必须给出：**套件名 + 用例名 + 上述填充命令**（禁止只写「全绿」）。

---

## 0.1 应用预览（test.html 内嵌 app）

控制台在用例目录与结果区之间提供可折叠 **应用预览**：展开后加载同源 `<iframe src="./app.html">`（真入口，不是跳转壳 `index.html`）。

| 能力 | 说明 |
|---|---|
| 刷新预览 / 新窗口打开 | 工具条按钮 |
| 当前 hash | 轮询显示 `iframe` 路由 |
| 快照 LX 状态 | `JSON.stringify`：`LibraryAPI` / `NavigationAPI.current` / 搜索播放列表 / `UiSession`（若可达） |
| Helper | 控制台页 `window.__LX_PREVIEW__`（`reload` / `snapshot` / `getLX`） |

**注意**：与控制台**共享 localStorage**。「运行全部」会 `TestAPI.reset`，预览数据会被清空——跑完后点「刷新预览」。预览加载 `app.html?test=1` **仅供观察**。系统 SAR 自动化使用专用 `#lxSarAppIframe` 采集整页 `#app`（见 [`docs/testing/UI-STATE-SYSTEM.md`](./testing/UI-STATE-SYSTEM.md)），不占用本预览框。

展开时才给预览 iframe 赋 `src`，避免 `?autorun=1` CI 双开拖慢。

---

## 0.2 CI 与 Playwright E2E

| 入口 | 需要 | 说明 |
|---|---|---|
| 本地日常 | 仅浏览器打开 `test.html` | **无需 Node / npm** |
| `python3 tools/run-tests.py` | Python + Chromium | 无头驱动同一控制台 |
| `npx playwright test` | Node + `package.json` 的 **devDependency** `@playwright/test` | `e2e/` 烟雾（真 `app.html`）；不进运行时 app |
| GitHub Actions | `.github/workflows/test.yml` | 先跑 `run-tests.py`，再 `playwright test` |

安装（通网后，仅开发机/CI）：

```bash
npm install
npx playwright install chromium   # 首次
npx playwright test
```

---

## 1. 分层目录

| 目录 | layer | 测什么 |
|---|---|---|
| `test/unit/core/` | `core` | errors / events / state / validators / storage / id / parsers |
| `test/unit/*.test.js` | `api` | 各 `*API` 域单测 |
| `test/ui/` | `ui` | render 契约模块、页面生命周期（可挂临时 DOM） |
| `test/integration/` | `integration` | 跨 API 模块用户流程 |
| `test/system/` | `system` | 端到端业务旅程（可组合 UI 契约） |
| `test/regression/` | `regression` | 历史 Bug 锁 |

`describe(name, fn, { layer, tags })` 第三参声明层级；未传时 runner 按套件名推断。

---

## 2. 强制规则（新增功能 / 接口）

1. **新增功能**：必须增加 **unit 单测**，并把该能力加入 **system**（或至少 integration）旅程。  
2. **新增 / 变更接口**：同步更新  
   - `src/types.js`  
   - `docs/CONTRACT-core.md` 或 `docs/CONTRACT-api.md`  
   - 模块设计说明（`docs/MAINTENANCE.md` 或专题 `docs/FEATURE-*.md`）  
3. **UI 行为**（如错题本收尾）：抽到 `src/render/contracts/*`，用 `test/ui/` 锁契约；禁止只靠人工点点点。  
4. **禁止**为测 UI 引入运行时 React/Vue/构建链；可选的 Playwright 等仅允许作为**本机/CI 测试工具**，不得打进 `app.html`。  
5. **SAR 用例形态（红线）** → 见 §2.2：每个功能点必须按「不同初始状态 × 可接受 action → 预期 response」覆盖，禁止只测单一 happy path。

---

## 2.1 设计即测（Testability-by-Design）——项目红线

> 🔴 **不允许「功能先做完、测试以后再说、用到才发现不可测」。**  
> 每个功能在设计/开工阶段就必须规划可观测点与测例位置；合并前测例必须挂进 `test.html`。

### 适用范围

| 层 | 必须可测什么 | 测例落点 |
|---|---|---|
| **core** | 每个公开导出（函数/错误码/存储键行为） | `test/unit/core/` |
| **api** | 每个 `*API` 公开方法：成功路径 + 典型错误码 | `test/unit/*.test.js` |
| **UI** | 每个页面的每个可点击/可输入控件（按钮、选项、开关、搜索框…） | `test/ui/pages|shell/*.buttons.test.js` |
| **交互** | api↔core 事件、api↔UI 契约、主用户旅程 | `test/integration/` + `test/system/` |

### 可侵入式测试钩子（设计阶段就要留）

| 能力 | 钩子约定 | 状态 |
|---|---|---|
| 路由导航 | `router.__setNavigateHookForTest` | ✅ 已有 |
| Toast 反馈 | `toast.__setToastSinkForTest` + `__getToastLogForTest` | ✅ 已有 |
| confirm | `confirm.__setConfirmForTest` + `appConfirm()` | ✅ 已有 |
| prompt | `prompt.__setPromptForTest` + `appPrompt()` | ✅ 已有 |
| 帮助章节高亮 | `help.__highlightSectionForTest` / `__getHighlightLogForTest` + `openHelpSection` | ✅ 已有 |
| 抽屉开关 | `drawer.__setDrawerSinkForTest` + open/close 日志 | ✅ 已有 |
| 文件下载 | `download.__setDownloadSinkForTest` + `triggerBlobDownload` | ✅ 已有 |
| 文件选择 | `TestAPI.mockFile` | 🟡 部分有 |
| 主题 | 已可用 `data-theme`；禁止测脏持久化时用测试模式 | 🟡 可用 |

**规则：**

1. **新 UI 控件** → 同 PR 增加 DOM 点击/输入用例；若无法通过文案/aria 稳定点到，必须加 `aria-label` 或测试钩子，禁止「测不了就跳过」。  
2. **新副作用**（导航、toast、弹窗、下载、开抽屉）→ 设计时同步加 `__…ForTest` 钩子（默认 null，生产零行为）。  
3. **新 API/core 导出** → 同 PR 单测；禁止只靠「集成里顺带碰到」。  
4. **禁止**用「以后再补」合并主路径功能；缺口只能记入 `docs/TESTING.md` §覆盖债，并排期。  
5. 钩子命名：`__xxxForTest`；业务代码禁止调用。

---

## 2.2 SAR 用例形态（State × Action → Response）——单测红线

> 🔴 **每个功能点的单测必须覆盖不同初始状态**；给定该状态下**可接受的 action**，断言**预期 response**。  
> 禁止：「只在默认空态点一次按钮看不崩」冒充覆盖。

### 形态（Given / When / Then）

| 段 | 含义 | 例 |
|---|---|---|
| **S 初始状态** | 库/题/进度/筛选/路由/confirm 返回值等前置 | `wrongCount=0`；`mode=random`；`confirm→false` |
| **A Action** | 公开 API 调用或 UI 控件操作（仅合法/约定入口） | `NavigationAPI.goto(1)`；点击「错题本」 |
| **R Response** | Result / 状态字段 / 事件 / toast / navigate / DOM 文案 | `{ok:false, code:OUT_OF_RANGE}`；`navigate('wrong')` |

用例命名建议：`[功能] S=… A=… → R=…`，或在 `it` 描述里写清三段。

### 最低矩阵（合并前自检）

对每个功能点至少覆盖：

1. **主成功态**（典型 S + 合法 A → 成功 R）  
2. **至少一种对照初始态**（空库 / 无错题 / 已掌握 / 已筛选 / 随机模式…）使行为分叉可观测  
3. **至少一种拒绝/失败路径**（非法入参、越界、用户取消 confirm、校验失败）→ 明确错误码或 UI 反馈  

动态列表：测「模板 + 代表项」，并对列表的**关键初始态**（空列表 / 单条 / 多分类）各至少 1 条。

### 反例（不合格）

- 只断言「按钮能点、页面还在」  
- 只测答对、不测答错 / 空输入 / 未选题库  
- 用 integration「顺带碰到」代替该功能点的 SAR 单测  

### 与分层的关系

| 层 | SAR 落点 |
|---|---|
| api/core | `test/unit/**`：同一方法多组 S→R |
| UI | `test/ui/**`：同一控件在不同页面态下的 A→R（toast/navigate/DOM） |
| 交互 | integration/system：串联多功能点的 SAR 旅程，**不能替代**单点 SAR |

---

### 当前覆盖债（诚实基线；矩阵 iframe 收口后）

| 维度 | 约覆盖 | 说明 |
|---|---|---|
| UI 控件 SAR（矩阵） | **121/121 control；293 cases** | 专用 `#lxSarAppIframe`；可执行中 **~92%** 真跑 iframe（约 22 withApiMock 回落 mountShell）；**DEFERRED=5** |
| UI 按钮级样板 | **主路径齐** | `test/ui/**/*.buttons.test.js`；手写旅程仅剩 `ui-state-risk-locks.test.js` |
| api 公开方法 | **~93%** | 含 `api-errors` + Drill/Library/WrongBook 失败码补洞；**CONTRACT 穷尽对勾仍欠** |
| core 公开导出 | **~90%** | storage/id/parsers/validators 深度 SAR 已补 |
| 跨层事件矩阵 | **~95%** | Events 主表 + system 失败注入旅程 |

Harness：`mountShell` / iframe harness / `assertToastIncludes` / `assertConfirmAsked` / `assertDrawerOpen` / `assertDownloaded`。

套件基线（本轮）：**633 pass / 0 fail / 5 skip（total 638）**；system 层 307/312（5=DEFERRED）。二次运行用 `?autorun=2`。对外「覆盖进行中」仅因 CONTRACT 穷尽对勾 + 22 mock 回落债。

---

## 3. 辅助 API

| 工具 | 用途 |
|---|---|
| `getLX` / `resetStateBeforeEach` | 取 LX、清状态 |
| `busListenerCount(event?)` | 检测订阅泄漏 |
| `createMountPoint` / `destroyMountPoint` | UI 临时挂载 |
| `createAndSwitchLibrary` | 快速建库 |
| `LX.TestAPI.busListenerCount` | 同上（挂在 TestAPI） |
| `runAll(onProgress, { layer, tag })` | 按层/标签过滤跑测 |

---

## 4. 错题本方案 B（与测试对齐）

- UI 必须：`WrongBookAPI.markMastered` 或 `onWrongBookGraded` / `markMasteredInWrongBook`  
- 禁止：错题本场景仅 `ProgressAPI.setStatus(..., 'mastered')`  
- 锁点：`test/ui/wrongbook-flow.test.js` + `test/system/wrongbook-celebration.test.js` + `test/regression/multi-wrongbook.test.js`

---

## 5. UI 按钮级测试（诚实说明）

### 5.1 土壤是否具备？

| 能力 | 状态 |
|---|---|
| 挂载单页 `createXPage().render(mount)` | ✅ `test/ui/dom-harness.js` → `mountPage` |
| 真实 DOM 点击 / 输入 | ✅ `click` / `clickText` / `clickLabel` / `type` |
| **navigate 测试钩子**（推荐） | ✅ `router.__setNavigateHookForTest` + `assertNavigatedTo` |
| 断言文案 / hash（次选） | ✅ `assertTextIncludes` / `assertHashRoute` |
| 壳层底栏六键 | ✅ `test/ui/shell/bottombar.buttons.test.js` |
| 顶栏 / 抽屉主菜单 | ✅ `topbar.buttons` + `drawer.buttons` + `mountShell` 接线 |
| toast/confirm/download 钩子 | ✅ `test/unit/test-hooks.test.js` |
| 每个动态列表每一行 | ⚠️ 用「代表项点击」覆盖模板，不枚举 N 行 |

**结论**：v3.1.x 起具备按钮级 UI 测试土壤；导航断言以**钩子观测意图**为准，不靠 hash 碰运气。

### 5.1.1 为什么加钩子？对框架冲击大吗？

| 问题 | 答案 |
|---|---|
| 为什么需要 | `test.html` 无 `#app`，不跑 `initUI`；只断言 `location.hash` 依赖 register 副作用，脆且失真 |
| 钩子做什么 | `navigate()` 入口若 `_testNavigateHook` 非空则回调；**默认 null，生产零行为变化** |
| 冲击面 | 仅 `router.js` 多 1 个可空分支 + 1 个 `__setNavigateHookForTest` 导出；不改 API 契约、不改页面 |
| 运行时开销 | 每次 navigate 一次 null 判断（纳秒级） |
| 约定 | 符号带 `__` + `ForTest` 后缀；**业务代码禁止调用** |

按钮测写：`clickText(...)` → `assertNavigatedTo('study')`。

### 5.2 目录

```
test/ui/dom-harness.js          # 基建（土壤）
test/ui/pages/*.buttons.test.js # 各页按钮
test/ui/shell/*.buttons.test.js # 顶/底/抽屉
test/ui/*-flow.test.js          # 契约（非 DOM）
```

### 5.3 规则

新增 UI 按钮 / 交互 → **必须**在对应 `*.buttons.test.js` 增加点击用例（挂 test.html）。  
禁止只写 API 测假装 UI 已覆盖。
