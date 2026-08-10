# UI 状态差分系统测

## 诚实覆盖说明（必读）

- **矩阵目标态**：同源 iframe 加载真入口 `app.html?test=1`，对 iframe 内整页 `#app` 做状态采集与差分（见 `test/system/app-iframe-harness.js`）。
- **过渡态**：少数需父页 `withApiMock` 的 unhappy case 仍回落 `mountShell` / `mountShellWithPage`（**不是**整棵真 app `#app`）。文档与代码必须区分二者，禁止把 mountShell 说成「已全量 iframe 整页」。
- **手写旅程 ≠ 全量 SAR**。矩阵落地后，手写样板仅保留高风险稀有锁：`test/system/ui-state-risk-locks.test.js`（playlist / celebrate / drill）。**禁止**再说「一堆 ui-state-* 已覆盖 121 控件」。
- **全量 SAR 目标集**由矩阵驱动：`docs/testing/UI-SAR-MATRIX.json`（`tools/gen-ui-sar-matrix.py` 从 inventory 生成）。
- 矩阵规模以生成结果为准（当前 **controlCount=121**，**caseCount=293**）。其中：
  - **executable**：`test/system/ui-sar-matrix/matrix.test.js` 实际执行并做状态差分的条目（N − D）
  - **deferred**：环境无法稳定复现的极少路径（多指触摸 / IME composition / loading 竞态等），列入 `perform.js` 的 `DEFERRED`（**当前 D=5**，目标 ≤ 15），`matrix.test` **仅**对这些 id 使用 `it.skip`
- **禁止**宣称「全套 364 条已覆盖 121 控件 SAR」。364 是历史全仓用例量级；控件 SAR 以矩阵 N / executable M / deferred D 为准。

重新生成矩阵：

```bash
python3 tools/gen-ui-sar-matrix.py
```

## iframe 整页 vs mountShell（当前分批）

| 协议 | 含义 | 现状 |
|------|------|------|
| **iframe 整页** | **优先可见** `#appPreview` → `app.html?test=1`（跑测时自动展开，人眼可见变化）；无预览节点时回退隐藏 `#lxSarAppIframe`。必须带 `?test=1`。`collectAppUiState` / `probeUi` 采 `#app` | **121/121** controlId；handlers：`perform-iframe.js` + `perform-iframe-rest.js`；冒烟 `ui-iframe-smoke.test.js` |
| **mountShell 过渡** | 父页拼装顶栏/底栏/抽屉 + 单页 | **约 22** 条需父页 `withApiMock` 的 unhappy case 回落 mountShell（见 `perform-iframe.js` → `shouldFallbackMountShell`）；DEFERRED 仍 `it.skip` |

统计口径（以 regenerate 后的 `UI-SAR-MATRIX.json` + `IFRAME_CONTROL_IDS` 为准）：

| 指标 | 数值 |
|------|------|
| 控件覆盖 | **121/121（100% control）** |
| 矩阵 cases | **293/293**（含 DEFERRED skip） |
| DEFERRED | **5** |
| 可执行中真跑 iframe | **约 92%**（约 22 条 withApiMock 回落 mountShell；不改变 controlId 归属统计） |

`collectUiState(root, adapter?)`：iframe 必须传 adapter（或 iframe 内 `probeUi`），**禁止**用父页 `getState()` / `getUiSession()` / `isDrawerOpen()` 读子页面。

## 文件选择（`<input type=file>`）

浏览器原生文件对话框是 **OS 级 UI**，自动化（含 Playwright / 本仓 system 测）**无法**可靠地点「打开/取消」对话框本身。

正确测法（矩阵已走这条路径）：

1. **选中文件**：`TestAPI.mockFile(...)` + `DataTransfer` 赋给 `input.files`，再 `dispatchEvent('change')`（`perform.js` / `perform-rest.js` 的 `assignFile`）。
2. **取消选文件**：触发会调用 `fileInput.click()` 的按钮（或直接点上传），**不**给 input 赋值、不派发带文件的 change → 断言库数/进度不变。

禁止把「点 OS 文件框取消」写成可执行 SAR；unhappy「取消选文件」= 触发 click 但不赋值。

## 产物

| 文件 | 用途 |
|------|------|
| [`UI-CONTROLS.inventory.json`](./UI-CONTROLS.inventory.json) | 全量控件清单（121）+ 快照 schema |
| [`UI-SAR-MATRIX.json`](./UI-SAR-MATRIX.json) | 全量 SAR 矩阵（happy + unhappy） |
| [`../../test/system/ui-state-collector.js`](../../test/system/ui-state-collector.js) | `collectUiState` / `assertStateDelta`（支持 iframe adapter） |
| [`../../test/system/app-iframe-harness.js`](../../test/system/app-iframe-harness.js) | iframe 整页：ensure / reset+seed / navigate / collect |
| [`../../test/system/ui-state-harness.js`](../../test/system/ui-state-harness.js) | `mountShellWithPage`：壳 + 页同根（过渡） |
| [`../../test/system/ui-sar-matrix/`](../../test/system/ui-sar-matrix/) | 矩阵 cases + `perform.js` + `perform-iframe.js` + `perform-iframe-rest.js` + `matrix.test.js` |
| `test/system/ui-state-risk-locks.test.js` | 手写高风险稀有锁（playlist / celebrate / drill）；≠ 全量 SAR |
| `test/system/ui-iframe-smoke.test.js` | iframe 真 app 冒烟（重置顶栏 / 错题庆祝 / 底栏掌握） |

## 矩阵驱动协议

1. seed → `collectUiState` / `collectAppUiState` 得 baseline  
2. 按 `controlId`（及 kind/title 关键字）执行 action → 再采集  
3. `assertStateDelta(before, after, expectDelta, expectUnchanged)`  
4. 改进度的操作必须断言 `chrome.progressText` 与 `domain.progress` 一致  
5. **目标**：iframe 整页；过渡期允许少数 mountShell（withApiMock）  
6. confirm/prompt 取消、API `!ok`、空输入、无库、文件取消等 unhappy 路径进矩阵并尽量可执行  

## N / M / D（读法）

- **N** = `UI-SAR-MATRIX.json` → `stats.caseCount`（当前 **293**）  
- **M** = N − |DEFERRED|（executable；`matrix.test` 实际跑差分；当前 **288**）  
- **D** = `perform.js` → `DEFERRED.size`（当前 **5**，目标 ≤ 15）  

iframe 子集另计：`|cases whose controlId ∈ IFRAME_CONTROL_IDS|` / N = **293/293**（100% control 归属）。其中约 22 条执行时回落 mountShell。

## 已落地手写样板（非全量）

| 套件文件 | 覆盖旅程 |
|----------|----------|
| `ui-state-risk-locks.test.js` | playlist / celebrate / drill 高风险稀有路径锁 |
| `ui-iframe-smoke.test.js` | iframe 真 app：重置顶栏 / 错题庆祝 / 底栏掌握 / hash / probeUi |

> 历史手写 `ui-state-delta/shell/browse/settings/study-wrong/addq` 已由矩阵 iframe SAR 覆盖，不再单独注册（见 `test/index.js`）。

## 采集字段（摘要）

- `meta`：hash / drawerOpen / toastLast / confirmAsked / downloads  
- `chrome`：progressText / wrongBadge / libraryTitle / bottombar  
- `domain`：lib / nav / progress / drill / wrongbook / searchPlaylist / uiSession  
- `page`：practiceModalOpen / filterChipCount / celebrateVisible / catalogItemCount …

重新生成控件清单：`python3 tools/gen-ui-inventory.py`（会覆盖手改；优先改生成脚本）。
