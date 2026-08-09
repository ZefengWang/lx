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

#### `setStatusFilter(statusFilter): Result<void>`

- `statusFilter`：`'all' | 'none' | 'mastered' | 'review'`

#### `getMode(): 'sequential' | 'random'`

- 注意：**直接返回字符串**，不是 Result。

#### `getCategory(): string`

#### `getStatusFilter(): string`

#### `listCategories(): Result<string[]>`

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

### 5.2 重要：错题本模式下的答题流程

由于 `QuestionAPI.answer` 在 `isWrongBookMode=true` 时**不自动 setStatus**，UI 必须自行处理：

```javascript
// 错题本页面答对后
const r = LX.QuestionAPI.answer(q, userAns);
if (r.ok && r.data.correct) {
  // 答对了，从错题本移出（两种等价方式）
  LX.ProgressAPI.setStatus(q, 'mastered');        // 方式 A
  // 或
  LX.WrongBookAPI.markMastered(q);                // 方式 B（会自动检查错题数+自动 exit）
}
```

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

## 8. `IOAPI`

### 8.1 方法签名

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

## 9. UI 层调用模式（最佳实践）

### 9.1 标准答题流程

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

### 9.2 状态切换（掌握/错题/清除）

```javascript
// 标记掌握
LX.ProgressAPI.setStatus(q, 'mastered');

// 标记错题
LX.ProgressAPI.setStatus(q, 'review');

// 清除标记（回到未开始）
LX.ProgressAPI.setStatus(q, 'none');
```

**禁止传 `'pending'`** —— 这是 v2.6.1 bug 的根因。

### 9.3 事件订阅模式

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

## 10. 变更流程

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
