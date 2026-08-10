# API 层契约（api/ ↔ render/）

> 本文档定义 `window.LX.*` API 对 UI（render/）层的接口契约。  
> 任何 render 层调用 API 必须遵守此契约；api 层改动必须同步更新本文档。  
> 静态网页强约束：render 层只能通过 `window.LX.*` 访问业务能力，**禁止直接 import `core/`**。

---

## 0. 全局对象 `window.LX`

```javascript
window.LX = {
  version: string,                  // '3.0.0' 形式，与 version.txt 一致
  _mountedAt: number,               // 启动时间戳

  // 业务 API
  LibraryAPI, QuestionAPI, ProgressAPI, NavigationAPI,
  WrongBookAPI, CategoryAPI, StatsAPI, IOAPI,

  // 事件总线（直通 core/events.js 的 bus）
  on, off, once, emit, Events,

  // 测试用（生产环境也保留，UI 慎用）
  TestAPI,
};
```

### 0.1 调用方契约（铁律）

1. **所有 API 函数返回 Result**：`{ ok, data? | error? }`。调用方必须**先检查 `r.ok`**：
   ```javascript
   const r = LX.LibraryAPI.list();
   if (!r.ok) { toastWarning(r.error.message); return; }
   const libs = r.data;  // 只有 ok:true 才能访问
   ```

   > ⚠️ **唯一 3 个例外**（历史包袱，不改了）：`NavigationAPI.getMode() / getCategory() / getStatusFilter()`
   > 直接返回字符串**（不是 Result）**，调用时写 `const cat = LX.NavigationAPI.getCategory() || 'all'` 即可。
   > 不要写 `r.ok ? r.data : 'all'`——这是 BUG-014（跨分类永远走全库分支）。
2. **禁止跨层调用**：render 不能 `import storage/state/events`，必须通过 `LX.on/LX.emit` 和 `LX.*API`。
3. **API 不会 throw**：所有错误通过 `err(code, message)` 返回；除非是程序员错误（如 typo）。
4. **状态值是枚举字符串**：禁止自创（如 `'pending'`），见 [§1 ProgressAPI](#1-progressapi)。

---

## 1. `ProgressAPI`

### 1.1 状态值枚举（铁律）

```typescript
type QuestionStatus = 'none' | 'mastered' | 'review';
// none      = 未开始/未标记（API 默认值，禁止用 'pending'）
// mastered  = 已掌握
// review    = 错题
```

**禁止值**：`'pending'`、`'correct'`、`'wrong'`、`null`、`undefined`。  
**v2.6.1 bug 教训**：render 层曾传 `'pending'` 被直接 `err(INVALID_INPUT)` 拒绝，导致清除标记按钮失效。

### 1.2 方法签名

#### `getStatus(q): Result<QuestionStatus>`

- **入参**：`q` 必须是 **question 对象**（含 `uid` 或 `id` 字段）；裸 id 字符串仅作向后兼容，新代码禁止使用。
- **返回**：`{ ok:true, data: 'none'|'mastered'|'review' }`，未选题库时返回 `'none'`。
- **示例**：
  ```javascript
  const q = LX.QuestionAPI.get(navR.data.qId).data;
  const s = LX.ProgressAPI.getStatus(q).data;  // 'mastered' 等
  ```

#### `setStatus(q, status, context?): Result<void>`

- **入参**：
  - `q`：question 对象（推荐）或 id
  - `status`：`'none' | 'mastered' | 'review'`
  - `context`（可选）：`{ libId?, source?, questions? }`
    - `questions`：传整个题库的题目数组，让统计**增量更新**（O(1)）；不传则下次 `stats()` 时重算。
    - `source`：触发来源标记，如 `'answer'`、`'wrong-book'`、`'api'`，仅用于事件 payload。
- **返回**：`{ ok:true }` 或 `{ ok:false, error: { code, message } }`。
- **副作用**：emit `QUESTION_STATUS_CHANGED` + `PROGRESS_UPDATED` 事件。
- **失败场景**：未选题库（`STATE_ERROR`）、status 值非法（`INVALID_INPUT`）、无法解析 id（`INVALID_INPUT`）。

#### `stats(libId?, questions?): Result<StatsSummary>`

- **返回**：`{ ok:true, data: { total, mastered, review, percent } }`

#### `reset(libId?): Result<void>`

- 重置整个题库的进度。

#### `exportProgress(): Result<string>`

- 返回 JSON 字符串。

#### `importProgress(jsonString): Result<void>`

- 覆盖式导入。emit `PROGRESS_IMPORTED` + `PROGRESS_UPDATED`。

#### `invalidateCache(): void`

- 清内存缓存，下次访问重读 localStorage。

#### `removeLibraryProgress(libId): Result<void>`

- 删除指定题库进度（题库删除时联动调用）。

### 1.3 事件 payload

| 事件 | Payload |
|---|---|
| `QUESTION_STATUS_CHANGED` | `{ libId, qId, oldStatus, newStatus, source }` |
| `PROGRESS_UPDATED` | `{ libId, stats: StatsSummary \| null }` |
| `PROGRESS_RESET` | `{ libId }` |
| `PROGRESS_IMPORTED` | `{ progress: object }` |

### 1.4 私有 API（仅 TestAPI/StatsAPI 用，UI 禁调）

- `_setLibraryProgressRaw(libId, progressObj)`
- `_getProgressMap()`

---

## 2. `QuestionAPI`

### 2.1 题型枚举

```typescript
type QuestionType = 'single' | 'multi' | 'judge' | 'fill' | 'essay';
```

### 2.2 方法签名

#### `list(filter?): Result<{ questions, total }>`

- `filter`: `{ category?, status?, mode? }`，所有字段可选。

#### `search(keyword, options?): Result<{ questions, total }>`（v3.1.0+；v1.2 AND）

- **只读**：不写 localStorage、不 emit 事件。
- `keyword`：`string` 或 `string[]`；亦可由 `options.keywords`（非空数组）优先提供。
- 有效关键字 `terms`：`keywords`（若非空）否则 `keyword` 数组/单串；各项 trim，去掉空串。`terms.length === 0` → `{ questions: [], total: 0 }`（不返回全库）。
- `options`：
  - `fields?`：`'question'|'options'|'explanation'|'category'`[]，默认 `['question']`（v1 题干）
  - `category?` / `status?`：与 `list` 相同筛选语义
  - `limit?`：默认 `50`（通用调用护栏）
  - `offset?`：默认 `0`；与 `limit` 组合做分页切片。`total` 为命中总数，可大于本页 `questions.length`
  - `keywords?`：有序 AND 关键字列表（v1.2）
- 匹配：对选中字段做大小写不敏感 `includes`；**每一项 term 都必须命中**（AND）。
- 浏览页（`#/browse`）：首屏 `limit=50`，触底自动增大 `offset` 续载（无「加载更多」按钮）。
- 未选题库 → 空结果。
- 无效 `fields` → `INVALID_INPUT`。
- UI 跳转契约见 `src/render/contracts/catalog-search.js`：点命中进入 `NavigationAPI.searchPlaylist`（按当前 keywords **及** category/status 范围拉全量 uid）；上下翻只在该集合内；**不**清掉「只练本类」。跨页过滤标签由 `UiSession.browseSearch` 保留。
- 浏览页 UI：显式点「搜索」/ Enter 才提交；若已「只练本类」则 `QuestionAPI.search({ category })` 只在该类内搜。见 [`docs/FEATURE-search.md`](./FEATURE-search.md)。

#### `get(qId): Result<Question>`

- 入参 `qId` 通常是 `NavigationAPI.current().data.qId`（即 `q.uid`）。
- 返回 `{ ...found }`（浅拷贝）。

#### `add(partial): Result<{ id, question }>`

- 入参 `partial`：`{ question, options?, answer, type, explanation?, answerText?, category? }`
- 自动分配 uid（取 maxUid+1）。

#### `update(qId, patch): Result<void>`

- 允许更新的字段：`['answerText', 'remarks', 'explanation', 'mnemonic', 'options', 'answer', 'question', 'type', 'category']`
- `explanation` 与 `mnemonic` 双向同步：改一个，另一个跟随。

#### `delete(qId): Result<void>`

#### `answer(qIdOrQuestion, userAnswer): Result<AnswerResult>`

- **入参**：
  - `qIdOrQuestion`：question 对象（推荐）或 id
  - `userAnswer`：
    - `single/judge/fill`：字符串（如 `'A'`、`'对'`、`'北京'`）
    - `multi`：**字符串数组**（如 `['A','B','C']`）或逗号分隔字符串
    - `essay`：文本字符串
- **返回**：
  ```typescript
  interface AnswerResult {
    correct: boolean;
    notGraded: boolean;       // essay 未设参考答案时为 true
    similarity?: number;      // essay 时的相似度
    correctAnswer: string;
    explanation: string;
    autoStatus: 'mastered' | 'review' | null;  // null = 未自动设置状态（notGraded）
  }
  ```
- **副作用**：
  - emit `QUESTION_ANSWERED`
  - **非错题本模式下**：自动 `ProgressAPI.setStatus(q, correct ? 'mastered' : 'review')`
  - **错题本模式下**：不自动设置状态，由 UI 显式调用 `ProgressAPI.setStatus`（见 [§5 WrongBookAPI](#5-wrongbookapi)）
- **判分规则**：
  - `single`：精确匹配（忽略大小写）
  - `multi`：选项集合相等（顺序无关）
  - `judge`：精确匹配
  - `fill`：忽略大小写
  - `essay`：有 `answerText` 时 bigram 相似度 ≥ 0.5 判对；无 `answerText` 时 `notGraded=true`，不影响状态。

#### `resetAttempt(qId): Result<void>`

- 仅 emit `QUESTION_UPDATED` 事件，UI 收到后清除本地 `revealed/selectedAnswers` 状态。

### 2.3 事件 payload

| 事件 | Payload |
|---|---|
| `QUESTION_ADDED` | `{ libId, qId }` |
| `QUESTION_UPDATED` | `{ libId, qId, patch }` |
| `QUESTION_DELETED` | `{ libId, qId }` |
| `QUESTION_ANSWERED` | `{ libId, qId, correct, notGraded, userAnswer, correctAnswer, type }` |

---

## 3. `LibraryAPI`

### 3.1 方法签名

#### `list(): Result<LibrarySummary[]>`

```typescript
interface LibrarySummary {
  id: string;
  name: string;
  questionCount: number;
  masteredCount: number;
  reviewCount: number;
  percent: number;
}
```

#### `get(libId): Result<Library>`

```typescript
interface Library {
  id: string;
  name: string;
  questions: Question[];
  createdAt: string;  // ISO 时间
}
```

#### `current(): Result<string | null>`

- 返回当前题库 ID。

#### `create(name, questions, options?): Result<{ id }>`

- `questions`：题目数组（raw，未归一化）
- `options.skipDuplicateCheck`：跳过指纹去重

#### `switch(libId): Result<void>`

- 重置 state（lastIndex、category、mode 等）
- emit `LIBRARY_SWITCHED`
- 调用 `ProgressAPI.invalidateCache()`

#### `delete(libId): Result<void>`

- 联动删除该库进度
- 若删的是当前库，清空 `currentLibId`

#### `rename(libId, newName): Result<{ name }>`

#### `findMatchingLibrary(questions): { matchingLibId }`

- 注意：**返回值不是 Result**，直接返回 `{ matchingLibId }` 对象。

#### `currentQuestions(): Result<Question[]>`

- 便捷方法，等价于 `LibraryAPI.get(LibraryAPI.current().data).data.questions`。

### 3.2 事件 payload

| 事件 | Payload |
|---|---|
| `LIBRARY_SWITCHED` | `{ libId, libName }` |
| `LIBRARY_CREATED` | `{ id, name, questionCount }` |
| `LIBRARY_DELETED` | `{ libId, libName }` |
| `LIBRARY_RENAMED` | `{ libId, name }` |

---

## 4. `NavigationAPI`

### 4.1 方法签名

#### `current(): Result<{ index, qId, total }>`

- 实时计算（每次调用都跑筛选逻辑），返回当前位置。
- `qId` 为 `null` 表示当前筛选下无题目。

#### `goto(index): Result<{ index, qId, total }>`

- 越界返回 `OUT_OF_RANGE`。

#### `next(): Result<{ index, qId, total }>`

- 循环：到末尾后回到 0。

#### `prev(): Result<{ index, qId, total }>`

- 循环：到 0 后回末尾。

#### `random(): Result<{ index, qId, total }>`

- 随机跳一个位置。

#### `setMode(mode): Result<{ mode }>`

- `mode`：`'sequential' | 'random'`
- 切换后回到序列 [0]。

#### `shuffle(): Result<{ total }>`

- 仅随机模式可用，重新洗牌并回到 [0]。

#### `setCategory(category): Result<void>`

- `category`：传入 `'all'` 或 `null / undefined` 都等价于"清除分类筛选（全库模式）"。
- 调用后序列回到 0，触发 `NAVIGATION_CHANGED`（source=`category-change`）。

#### `setStatusFilter(statusFilter): Result<void>`

- `statusFilter`：`'all' | 'none' | 'mastered' | 'review'`
- 传入 `'all'` 或空值 = 清除状态过滤。
- 调用后序列回到 0，触发 `NAVIGATION_CHANGED`（source=`status-change`）。

#### `getMode(): 'sequential' | 'random'`

- 注意：**直接返回字符串**，不是 Result。

#### `getCategory(): string`

- 直接返回字符串。`'all'` 代表"未过滤 / 全库模式"；否则就是当前选中的分类名。
- 🔴 **调用方注意**：`LX.NavigationAPI.getCategory()` 不返回 Result，**不要**写 `r.ok ? r.data : 'all'`，否则你会永远拿到 fallback 而出 bug（这是踩过的坑，BUG-014）。

#### `getStatusFilter(): string`

- 直接返回字符串。`'all'` 代表"未过滤"，和上一条注意事项一致。

#### `listCategories(): Result<string[]>`

#### `getActiveList(): Result<Question[]>`

- **新增（v3.0.1）**：返回当前「分类筛选 + 状态筛选 + 错题本模式 + 顺序/随机洗牌」过滤后的 active 题对象数组（不仅仅是 uid）。
- **什么时候用**：当你手上只有一个「全库题对象/uid」（比如目录页 catalog 是全库视图），但你需要把它映射到 `goto(index)` 的过滤后下标时，就用它：
  ```javascript
  const listR = LX.NavigationAPI.getActiveList();
  if (listR.ok) {
    const index = listR.data.findIndex((q) => q.uid === targetUid);
    if (index >= 0) LX.NavigationAPI.goto(index);
  }
  ```
- **顺序一致性**：`random` 模式下会用和内部 `computeFilteredQIds` 同一份洗牌序列，保证 `goto(n)` → activeList[n].uid 和 current 里的 qId 一致。

### 4.2 事件 payload

`NAVIGATION_CHANGED`：`{ index?, qId?, total?, source }`  
`source` 取值：`'api'`、`'mode-change'`、`'category-change'`、`'status-change'`、`'shuffle'`、`'wrongbook-enter'`、`'wrongbook-exit'`、`'wrongbook-mark'`

---

## 5. `WrongBookAPI`

### 5.1 方法签名

#### `enter(): Result<{ wrongCount }>`

- 失败场景：未选题库（`STATE_ERROR`）、无错题（`NO_WRONG`）
- 副作用：state.isWrongBookMode=true，快照当前 navigation 状态。
- emit `WRONGBOOK_ENTERED` + `NAVIGATION_CHANGED`。

#### `exit(): Result<void>`

- 从快照恢复 navigation 状态。
- emit `WRONGBOOK_EXITED` + `NAVIGATION_CHANGED`。

#### `list(): Result<{ questions, count }>`

#### `count(): Result<number>`

#### `markMastered(qIdOrQuestion): Result<{ remaining, cleared }>`

- **错题本模式专属**：非错题本模式调用返回 `NOT_IN_WRONG_BOOK`。
- 副作用：`ProgressAPI.setStatus(q, 'mastered')`；若 `remaining === 0` 自动 `exit()` + emit `WRONGBOOK_CLEARED`。

### 5.2 重要：错题本模式下的答题流程（方案 B，v3.0.2+）

由于 `QuestionAPI.answer` 在 `isWrongBookMode=true` 时**不自动 setStatus**，UI 必须自行处理。

> 🔴 **铁律（v3.0.2）**：错题本内「答对移出 / 我已掌握」**必须**调用 `WrongBookAPI.markMastered`（或 render 契约 `onWrongBookGraded` / `markMasteredInWrongBook`）。  
> **禁止**仅调用 `ProgressAPI.setStatus(q, 'mastered')`：它只会改进度，**不会**在 `remaining===0` 时自动 `exit` + `WRONGBOOK_CLEARED`，庆祝页无法触发。

```javascript
// 错题本页面答对后（唯一正确路径）
const r = LX.QuestionAPI.answer(q, userAns);
if (r.ok && r.data.correct) {
  const mark = LX.WrongBookAPI.markMastered(q);
  // mark.data.cleared === true 时已自动 exit，UI 订 WRONGBOOK_EXITED 渲染庆祝页
}

// 推荐：页面与测试共用契约模块，避免分叉
// import { onWrongBookGraded } from '../contracts/wrongbook-flow.js';
// const fin = onWrongBookGraded(LX, q, r);
```

| 路径 | 改进度 | remaining===0 自动 exit + CLEARED | UI 是否允许 |
|---|---|---|---|
| `WrongBookAPI.markMastered`（方案 B） | ✅ | ✅ | **必须** |
| `ProgressAPI.setStatus(..., 'mastered')` | ✅ | ❌ | **禁止**（错题本场景） |

### 5.3 事件 payload

| 事件 | Payload |
|---|---|
| `WRONGBOOK_ENTERED` | `{ wrongCount }` |
| `WRONGBOOK_EXITED` | `{}` |
| `WRONGBOOK_CLEARED` | `{ libId }` |

---

## 6. `CategoryAPI`

### 6.1 方法签名

#### `list(): Result<Array<{ name, count }>>`

#### `rename(oldName, newName): Result<{ changedCount }>`

- 若 `newName` 已存在，自动合并（题目归到 newName 下）。

### 6.2 事件 payload

`CATEGORY_RENAMED`：`{ libId, oldName, newName, changedCount }`

---

## 7. `StatsAPI`

### 7.1 方法签名

#### `summary(): Result<StatsSummary>`

```typescript
interface StatsSummary {
  total: number;
  mastered: number;
  review: number;
  percent: number;
  byCategory: Record<string, CategoryStat>;
  byType: Record<QuestionType, CategoryStat>;
}
interface CategoryStat {
  total: number;
  mastered: number;
  review: number;
}
```

- **必须传 currentLibId 已设置**，否则返回零值。

---

## 8. `DrillAPI`（快速刷题 / 背诵记忆）

> 设计说明见 [`docs/FEATURE-drill.md`](./FEATURE-drill.md)。会话期间 `NavigationAPI.next/prev` 委托本 API；`computeFilteredQIds` 返回本轮固定 `queue`。

### 8.1 方法签名

#### `start({ mode, count?, category? }): Result<{ mode, total, qId, index }>`

- `mode`：`'quick'` | `'memory'`
- `count`：默认 `100`，不超过候选题数
- 选题：优先 `ProgressAPI` 状态 `none`，不足再补已标记；开会话前若在错题本则 `WrongBookAPI.exit()`

#### `isActive(): boolean` / `current(): Result<DrillView|null>`

#### `recordAnswer(qId, payload)` / `afterAnswer({ correct })` / `advanceProgress()`

- `afterAnswer`：仅 `quick` 且在进度题上返回 `delayMs`（对 0 / 错 5000）；`memory` 不推进

#### `prev()` / `next()` / `exit()`

- `prev`：回看已访问题；`next`：从回看回到进度，或在已答时推进进度
- `scheduleAdvance` / `cancelScheduledAdvance`：UI 答后定时推进

---

## 9. `IOAPI`

### 9.1 方法签名

#### `parseFile(file): Result<{ questions, warnings }>`

- 解析 Excel/JSON/CSV/TXT 文件。
- 失败场景：`DEP_MISSING`（SheetJS/pdf.js 未加载）、`PARSE_ERROR`。

#### `parseText(text, format?): Result<{ questions, warnings }>`

#### `importLibrary(name, questions, options?): Result<{ id }>`

- 等价于 `LibraryAPI.create`，但跳过部分检查（导入场景）。

#### `exportLibrary(libId, format): Result<{ blob, filename }>`

- `format`：`'json' | 'excel' | 'csv'`

#### `downloadTemplate(format): Result<{ blob, filename }>`

#### `convert(questions, fromFormat, toFormat): Result<{ blob, filename }>`

#### `exportProgress(): Result<{ blob, filename }>`

#### `importProgress(jsonString): Result<void>`

- 等价于 `ProgressAPI.import`。

---

## 10. UI 层调用模式（最佳实践）

### 10.1 标准答题流程

```javascript
// 1. 拿到当前题
const nav = LX.NavigationAPI.current();
if (!nav.ok || !nav.data.qId) return;
const q = LX.QuestionAPI.get(nav.data.qId).data;

// 2. 渲染卡片
renderCard(q, {
  selectedAnswer: viewState.selectedAnswers.get(q.uid) ?? defaultForType(q.type),
  revealed: viewState.revealed.has(q.uid),
  onAnswer: (qq, ans, opts) => handleAnswer(qq, ans, opts),
});

// 3. handleAnswer 内部
function handleAnswer(q, ans, opts = {}) {
  if (q.type === 'multi') {
    if (opts.commit) {
      const r = LX.QuestionAPI.answer(q, ans);  // ans 是数组
      if (r.ok) {
        viewState.revealed.add(q.uid);
        // isWrongBookMode 下 r.data.autoStatus 会是 null，需要 UI 显式设置
      }
    } else {
      // toggle 单个选项
    }
  } else {
    const r = LX.QuestionAPI.answer(q, ans);
    // ...
  }
}
```

### 10.2 状态切换（掌握/错题/清除）

```javascript
// 标记掌握
LX.ProgressAPI.setStatus(q, 'mastered');

// 标记错题
LX.ProgressAPI.setStatus(q, 'review');

// 清除标记（回到未开始）
LX.ProgressAPI.setStatus(q, 'none');
```

**禁止传 `'pending'`** —— 这是 v2.6.1 bug 的根因。

### 10.3 事件订阅模式

```javascript
const events = [
  LX.Events.LIBRARY_SWITCHED,
  LX.Events.QUESTION_STATUS_CHANGED,
  LX.Events.PROGRESS_UPDATED,
  LX.Events.NAVIGATION_CHANGED,
];

const unsubs = events.map(evt => LX.on(evt, refreshFn));

// 离开页面时
function onLeave() {
  unsubs.forEach(off => off && off());
}
```

未来推荐使用 `bindRefresh()` 工具（见 [render/bind.js](../src/render/bind.js)）统一管理。

---

## 11. 变更流程

**任何对 api 层的接口变更**（新增/删除方法、改签名、改返回 shape、改事件 payload）必须：

1. 同步更新本文件；
2. 全代码库 grep 受影响的 UI 调用点，逐一修正；
3. 跑全量测试（`test.html`）；
4. 加测试用例锁住新行为（`test/` 目录）；
5. 升级版本号：
   - 仅加方法 / 加可选参数：patch（2.7.0 → 2.7.1）
   - 改签名 / 改返回值：minor（2.7.1 → 2.8.0）
   - 删方法 / 删字段：major（2.x → 3.0.0）
6. commit message 带前缀 `api:` 或 `contract:`。
