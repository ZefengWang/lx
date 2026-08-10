# 测试覆盖补齐计划与工作量（基线 2026-08-10）

> 现状套件数：`test.html` 同源 **258 it**（P0–P2 + 冷路径 API/搜索清空补测；主路径可宣称完成，CONTRACT 穷尽对勾仍可继续）。  
> 约束见 [`TESTING.md` §2.1 设计即测](./TESTING.md) + [§2.2 SAR](./TESTING.md)。  
> 对外仍写「覆盖进行中」直至 §4 验收勾选全部完成（UI/api CONTRACT 逐项勾完）。

---

## 1. 判决

| 问题 | 答案 |
|---|---|
| 每一个 button / 每一个页面都有单测？ | **主矩阵是**（P1）；动态列表代表项已覆盖，非「控件穷举证明」 |
| UI 逻辑交互点约覆盖 | **~85–90%** |
| api 公开方法约覆盖 | **~92%**（含 IO 失败码 + api-errors） |
| core 公开导出约覆盖 | **~90%**（storage/id/parsers/validators 深度 SAR） |
| 跨层事件/交互矩阵 | **~95%**（含 system 失败注入旅程） |

**P0 + P1 + P2 已完成**。  
剩余主要是 CONTRACT 文档逐项对勾与个别冷路径（如真实 PDF/扫描件警告需 pdfjs 夹具）。

---

## 2. 工作量（人日，1 名熟手）

| 阶段 | 目标 | 人日 | 产出 |
|---|---|---|---|
| **P0** | 可测性钩子 + 壳层 harness + 高频缺口 | **8–12** | toast/confirm/drawer 钩子；mountShell；topbar/drawer 主按钮；Navigation/Question CRUD 单测；catalog 剩余按钮 |
| **P1** | UI 按钮矩阵填满 + api 方法 ~90% | **15–22** | card 五题型 DOM；study/wrongbook/settings/add-question 全控件；api 各域错误码；Events 订阅断言 |
| **P2** | core ~100% + 交互/系统矩阵 + IO mock | **18–28** | storage/parsers/id；系统旅程×失败注入；file/download 测试桩 |
| **合计** | 宣称「功能点可测且已覆盖」 | **~45–70** | 双人并行约 6–10 周 |

浅测刷覆盖率数字 **不算完成**。

---

## 3. P0 清单

| # | 项 | 状态 |
|---|---|---|
| 1 | toast / confirm / prompt / drawer / download 钩子 | ✅ |
| 2 | `mountShell` + topbar/drawer/bottombar 接线测 | ✅ |
| 3 | drawer：切库、上传、新建、帮助、统计、导出、重置 | ✅ |
| 4 | catalog：折叠、换一批、清分类、跨类点题、空态 | ✅ |
| 5 | Question CRUD / Navigation 扩展 / Progress export·import | ✅ |

## 3.1 P1 清单

| # | 项 | 状态 |
|---|---|---|
| 1 | card 五题型 DOM（对/错/漏选/简答/看解析/状态循环） | ✅ |
| 2 | settings 全控件 + 导入/恢复/模板/Excel/CSV 失败 + 切库/模式 | ✅ |
| 3 | add-question 五题型保存/校验 + 返回目录 | ✅ |
| 4 | wrongbook SAR（对/错/掌握/下一题/清完/无错题空态） | ✅ |
| 5 | home 空态；api 错误码矩阵；Events 含 RENAMED/STATE_ERROR/LX_READY | ✅ |

## 3.2 P2 清单

| # | 项 | 状态 |
|---|---|---|
| 1 | core：storage / parsers / id / validators 深度边界 | ✅ `test/unit/core/{storage,id,parsers,validators}.test.js` |
| 2 | IO：坏文件 / 缺依赖 / 空库警告 / 导出失败码 | ✅ `test/unit/io.test.js` + parsers DEP_MISSING |
| 3 | system：导入失败、错题清空、进度往返失败注入 | ✅ `test/system/failure-injection.test.js` |

说明：工程内无独立「大文件」硬限制；空库 / 扫描件类警告以 parsers `warnings` 与 PDF `DEP_MISSING` 覆盖。  

---

## 4. 验收标准（何时能说「覆盖到了」）

- [x] UI：每个页面/壳模块有 `*.buttons.test.js`，主控件 SAR 最低矩阵已齐（happy + 取消/失败/空态对照；见各文件头注释）；全量控件以矩阵 **121/121、293 cases** 为准  
- [ ] api：CONTRACT-api 中每个公开方法按 SAR：≥1 成功 S + ≥1 对照 S + ≥1 典型失败 — **债**：错误码与主路径已厚，**CONTRACT 穷尽对勾未做完**  
- [x] core：CONTRACT-core 中每个公开导出有单测（含边界 S；storage/id/parsers/validators 深度已补）  
- [x] 交互：每个 `Events.*` 至少一处 emit 断言；主旅程 system 覆盖导入/刷题/错题本/设置/搜索/drill  
- [x] 新功能 PR 检查清单含「钩子 + SAR 单测 +（若 UI）按钮测」三项（见 TESTING.md / MAINTENANCE）  
- [x] 测例形态符合 [`TESTING.md` §2.2](./TESTING.md)（State × Action → Response）  
- [x] 矩阵 iframe：**121/121 control**、可执行中 **~92%** 真跑 iframe；**DEFERRED=5**  
- [ ] 债：约 **22** 条 withApiMock unhappy 仍回落 mountShell（control 归属已算 iframe，执行协议未 100% 真 iframe）

未勾完前，文档与对外表述必须写「覆盖进行中 / 见覆盖债」（主要剩 CONTRACT 穷尽对勾 + 22 mock 回落）。

---

## 5. P0 对照 SAR 检查（抽查）

| 功能点 | 多初始态 | 失败/拒绝 | 结论 |
|---|---|---|---|
| topbar 错题入口 | wrong=0 / >0 | —（无错题走 toast） | ✅ |
| drawer 重置进度 | confirm true/false | 取消不重置 | ✅ |
| Navigation goto/mode/shuffle | 合法/越界；顺序/随机 | shuffle 非随机失败 | ✅ |
| Question CRUD | 有库/无库；空题干 | add/update/delete 失败 | ✅ |
| Progress export/import | 有进度 ↔ 重置后导入 | 非法 JSON | ✅ |
| catalog 跨类/折叠/空态 | 筛选甲、无库、多分类 | — | ✅ |
| study card 五题型 | 对/错/漏选/无参考简答/看解析/状态循环 | — | ✅ P1（并修 viewState 单例 bug） |
| settings 全控件 | 导入成功/空文件、恢复进度、模板、Excel、CSV 失败、切库、夜间 | 取消重置/CSV 失败 | ✅ |
| add-question 五题型 | 各题型保存成功 + 校验失败 + 取消真假 | 空题干/未选答案 | ✅ |
| wrongbook | 对/错/掌握/下一题/清完/无错题 | — | ✅ |
| Events 全表 | 主事件 + RENAMED + CATEGORY + STATE_ERROR + LX_READY | handler 抛错 | ✅ |
| api 错误码 | 各域 INVALID/NOT_FOUND/STATE/NO_WRONG/… | — | ✅ |
| iframe SAR 矩阵 | 121 control / 293 cases | DEFERRED=5；~22 mock 回落 | ✅ 控件 100%；执行 ~92% iframe |

**P1 / P2 / 矩阵 iframe 已按 SAR 收口。** §4 未勾项为 CONTRACT 穷尽对勾与 22 mock 回落债。

### 顺手修掉的真实 bug

- `study.js` 的 `viewState` 曾为**模块单例**：`TestAPI.reset` 后 Progress 已空，卡片仍 `revealed` → 选项 disabled、假「回答正确」。已改为**页面实例私有**（写入 MAINTENANCE 规则 6）。
- settings `exportProgress`：IOAPI 返回 JSON **字符串**，需包 `Blob` 再 `triggerBlobDownload`（P1 期）。
- **二次「运行全部」16 失败**：`router-hook` afterEach 把 navigate 钩子卸成 `null`，但 `dom-harness` 的 `_navSpyOn` 仍为 true，第二次运行不再重绑 → 整批「钩子未记录到任何 navigate」。已修：`ensureNavigateSpy` 每次重钉 + `prepareFullRun`/`resetHarnessForFullRun`；回归见 `test/ui/harness-rerun.test.js`、`?autorun=2`。
