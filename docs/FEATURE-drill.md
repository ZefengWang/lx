# 功能设计：快速刷题 / 背诵记忆（Drill）

> 状态：**已实现**  
> 约束：零后端 / 零构建；轻交互（目录仅「练习模式」单入口）

## 目标

- **快速刷题**：默认 100 题（可改）；答对立即下一题；答错停留约 5 秒再下一题
- **背诵记忆**：同选题规则；答完**不**自动切题，仅用户 prev/next
- 选题优先未标记（`none`）；不足再全局补齐
- 上一题可回看答案与作答；下一题回到进度题（不重随机）

## 入口

浏览页 → **练习模式** → 应用内面板（默认背诵，题量置灰；快速可改题量）→ `DrillAPI.start` → `#/study`

## 搜索续载（相关）

目录搜索：`limit=50` + `offset` 触底自动续载；文案仅 `共 N 题`。见 CONTRACT `QuestionAPI.search`。

## 测例

- `test/unit/drill.test.js`
- `test/unit/question-search.test.js`（offset）
- `test/ui/pages/catalog.buttons.test.js`（练习模式入口 / 续载）
- `test/ui/pages/help.buttons.test.js`（帮助文案）
