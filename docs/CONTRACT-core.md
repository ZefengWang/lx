# 核心层契约（core/ ↔ api/）

> 本文档定义 `src/core/*` 模块对外暴露给 `src/api/*` 的接口契约。  
> 任何 api 层调用 core 层必须遵守此契约；core 层改动必须同步更新本文档。  
> 静态网页强约束：core 层**禁止 import DOM/BOM API**（除 `localStorage`、`window.addEventListener('storage')`），**禁止 import 任何 api/ 或 render/ 模块**。

---

## 0. 分层约定

```
┌──────────────────────────────────────────────────────┐
│  render/   (UI 层 — 仅 import api/)                   │
├──────────────────────────────────────────────────────┤
│  api/      (业务层 — 仅 import core/ + 同层 api/)     │
├──────────────────────────────────────────────────────┤
│  core/     (基础层 — 零业务依赖、零 DOM 依赖)         │
└──────────────────────────────────────────────────────┘
```

**禁止反向依赖**：core 不能 import api/render。  
**允许横向依赖**：api 之间可以互相 import（如 library.js 调用 progress.js）。

---

## 1. `core/errors.js`

### 1.1 导出

| 名称 | 类型 | 说明 |
|---|---|---|
| `ErrorCode` | `ReadonlyObject` | 错误码枚举，见下表 |
| `ok(data?)` | 函数 | 构造成功 Result |
| `err(code, message, extra?)` | 函数 | 构造失败 Result |
| `isResult(r)` | 函数 | 判断对象是否为 Result |

### 1.2 ErrorCode 枚举

```
NOT_FOUND            // 找不到资源（题库/题目不存在）
INVALID_INPUT        // 入参不合法（状态值无效、字段缺失等）
DUPLICATE            // 重复创建（题库指纹命中）
STORAGE_FULL        // localStorage 写满
STORAGE_ERROR        // localStorage I/O 异常
PARSE_ERROR          // JSON/Excel/CSV 解析失败
STATE_ERROR          // 状态机不合法（未选题库就调答题等）
DEP_MISSING          // 依赖缺失（如 SheetJS 未加载）
NO_WRONG             // 错题本为空
NOT_IN_WRONG_BOOK    // 非错题本模式却调用了错题本专属 API
OUT_OF_RANGE         // 索引越界（如 navigation goto(-1)）
```

### 1.3 Result 类型契约

```typescript
// 所有 api/ 函数必须返回 Result，禁止 throw（除非是程序员错误如 typo）
type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; error: { code: ErrorCode; message: string; [key: string]: any } };
```

**调用方契约**：api 层调用方必须**先检查 `r.ok`** 才能访问 `r.data`，否则应处理 `r.error`。  
**反例**：`storage.getLibraries().data` —— 直接 `.data` 没检查 ok，会被静态检查拦截。

---

## 2. `core/events.js`

### 2.1 导出

| 名称 | 类型 | 说明 |
|---|---|---|
| `Events` | `ReadonlyObject` | 事件名枚举（见下表） |
| `bus` | 对象 | 全局事件总线单例 |
| `createBus()` | 函数 | 创建独立事件总线（测试用） |

### 2.2 `bus` 接口

```typescript
interface Bus {
  on(event: string, handler: (payload: any) => void): () => void;  // 返回取消订阅函数
  off(event: string, handler: Function): void;
  once(event: string, handler: (payload: any) => void): () => void;
  emit(event: string, payload?: any): void;  // 同步广播，handler 异常不传播
  clear(): void;  // 仅测试用
  listenerCount(event?: string): number;  // 测试用：单事件或全部监听器数量（v3.0.2+）
}
```

测试侧也可通过 `LX.TestAPI.busListenerCount(event?)` 读取全局 `bus` 的监听数（检测 UI 订阅泄漏）。

### 2.3 Events 枚举与 Payload 契约

| 事件名 | 触发者 | Payload |
|---|---|---|
| `LIBRARY_SWITCHED` | LibraryAPI.switch | `{ libId, libName }` |
| `LIBRARY_CREATED` | LibraryAPI.create | `{ id, name, questionCount }` |
| `LIBRARY_DELETED` | LibraryAPI.delete | `{ libId, libName }` |
| `LIBRARY_RENAMED` | LibraryAPI.rename | `{ libId, name }` |
| `QUESTION_ADDED` | QuestionAPI.add | `{ libId, qId }` |
| `QUESTION_UPDATED` | QuestionAPI.update | `{ libId, qId }` |
| `QUESTION_DELETED` | QuestionAPI.delete | `{ libId, qId }` |
| `QUESTION_ANSWERED` | QuestionAPI.answer | `{ libId, qId, correct, autoStatus }` |
| `QUESTION_STATUS_CHANGED` | ProgressAPI.setStatus | `{ libId, qId, oldStatus, newStatus, source }` |
| `PROGRESS_UPDATED` | ProgressAPI.setStatus | `{ libId, stats: StatsSummary \| null }` |
| `PROGRESS_RESET` | ProgressAPI.reset | `{ libId }` |
| `PROGRESS_IMPORTED` | ProgressAPI.import | `{ progress: object }` |
| `NAVIGATION_CHANGED` | NavigationAPI | `{ index?, qId?, total?, source }` |
| `WRONGBOOK_ENTERED` | WrongBookAPI.enter | `{ wrongCount }` |
| `WRONGBOOK_EXITED` | WrongBookAPI.exit | `{ clearedAt }` |
| `WRONGBOOK_CLEARED` | WrongBookAPI | `{ clearedCount }` |
| `CATEGORY_RENAMED` | CategoryAPI.rename | `{ libId, oldName, newName }` |
| `STATE_ERROR` | bus（handler 异常时） | `{ event, error }` |
| `LX_READY` | bootstrap | `{ version, mountedAt }` |

### 2.4 调用方契约

- **emit 是同步的**：所有 handler 在 emit 返回前执行完毕。  
- **handler 异常不传播**：bus 内部 try/catch，handler 抛错只会 `console.error`，不会影响后续 handler 或 emit 调用方。  
- **禁止在 handler 内 emit 同名事件**：会无限递归。

---

## 3. `core/state.js`

### 3.1 导出

| 名称 | 类型 | 说明 |
|---|---|---|
| `initialState` | `ReadonlyObject` | 状态默认值（frozen） |
| `getState()` | 函数 | 返回当前状态（**只读视图**） |
| `setState(patch)` | 函数 | 浅合并更新，返回新状态 |
| `subscribe(listener)` | 函数 | 订阅变更，返回取消订阅 |
| `resetState()` | 函数 | 重置为默认（测试用） |
| `snapshotState()` | 函数 | 深拷贝当前状态（调试用） |

### 3.2 全局状态 shape

```typescript
interface AppState {
  currentLibId: string | null;
  mode: 'sequential' | 'random';
  category: string;              // 'all' 或分类名
  statusFilter: 'all' | 'none' | 'mastered' | 'review';
  isWrongBookMode: boolean;
  wrongBookSnapshot: {
    category: string;
    mode: string;
    index: number;
    statusFilter: string;
  } | null;
  lastIndex: number;
  lastQId: string | number | null;
  filteredQIds: (string|number)[];
  uiVisibility: { mnemonic: boolean; answer: boolean; remark: boolean };
}
```

### 3.3 调用方契约

- **getState 返回的对象禁止直接修改**：必须用 `setState({ key: newValue })`。  
- **setState 是浅合并**：嵌套对象（如 `uiVisibility`）修改要传完整对象，setState 会做一层浅合并。  
- **subscribe 同步触发**：setState 后所有 listener 立即执行。  
- **listener 异常不传播**：内部 try/catch。

### 3.4 反模式（禁止）

```javascript
// ❌ 直接改 getState 返回值
getState().currentLibId = 'xxx';

// ❌ listener 里 emit 事件导致递归
subscribe((newState) => {
  if (newState.currentLibId) bus.emit('xxx'); // 可能触发别的 setState，递归
});

// ❌ 在 core/ 之外修改 initialState
```

---

## 4. `core/storage.js`

### 4.1 导出

| 名称 | 类型 | 说明 |
|---|---|---|
| `KEYS` | `ReadonlyObject` | localStorage 键名常量 |
| `getLibraries()` | 函数 | 读取所有题库（带内存缓存） |
| `setLibraries(obj)` | 函数 | 写入所有题库 |
| `getProgress()` | 函数 | 读取所有进度 |
| `setProgress(obj)` | 函数 | 写入所有进度 |
| `getLastLibraryId()` | 函数 | 读取上次题库 ID |
| `setLastLibraryId(id)` | 函数 | 写入上次题库 ID |
| `clearAll()` | 函数 | 清空题库+进度+lastLib（不删 test snapshots） |
| `estimateUsage()` | 函数 | 估算 localStorage 占用 |
| `invalidateCache()` | 函数 | 清内存缓存（多标签页同步用） |
| `migrateLegacyKeys()` | 函数 | 一次性迁移旧键（v4 → v1） |

### 4.2 调用方契约

- **所有函数返回 Result**：成功 `{ ok:true, data }`，失败 `{ ok:false, error }`。  
- **内存缓存自动同步**：写入后立即更新缓存；`storage` 事件触发时清缓存。  
- **禁止跨层调用**：render 层禁止直接调 storage，必须通过 api 层。  
- **多标签页**：A 标签写入后，B 标签通过 `storage` 事件感知并清缓存，下次读拿到新值。

### 4.3 KEYS 常量

```javascript
KEYS = {
  LIBRARIES: 'lx_libraries_v1',
  PROGRESS:  'lx_progress_v1',
  LAST_LIB:  'lx_last_library_v1',
  MIGRATED:  'lx_migrated',
  TEST_SNAPSHOTS: 'lx_test_snapshots',
  LEGACY: { LIBRARIES, PROGRESS, LAST_LIB }  // 旧版兼容
}
```

---

## 5. `core/id.js`

### 5.1 导出

| 名称 | 类型 | 说明 |
|---|---|---|
| `genLibId()` | 函数 | 生成题库 ID：`lib_<timestamp>_<rand>` |
| `genQId()` | 函数 | 自增计数器（测试场景用） |
| `resetQIdCounter()` | 函数 | 重置计数器（测试用） |

### 5.2 调用方契约

- **业务题目 ID 不依赖 `genQId`**：导入时由序列号决定（`normalizeQuestion(q, idx+1)`）。  
- **`genQId` 仅测试用**：业务代码禁止调用。

---

## 6. `core/validators/question.js`

### 6.1 导出

| 名称 | 类型 | 说明 |
|---|---|---|
| `normalizeQuestion(rawQ, id)` | 函数 | 归一化题目对象，分配 `id`/`displayId` |

### 6.2 归一化后 shape

```typescript
interface NormalizedQuestion {
  id: number;             // 序号（1-based）
  uid: number;            // 内部稳定标识（== id，向后兼容用）
  displayId: number;      // 展示用 ID（== id）
  type: 'single' | 'multi' | 'judge' | 'fill' | 'essay';
  question: string;
  options?: string[];     // single/multi/judge 必填
  answer: string;         // 字母（'A'/'A,B,C'/'对'/'错'）或文本
  explanation?: string;
  answerText?: string;    // essay 参考答案（用于模糊判分）
  remarks?: string;
  category?: string;
}
```

### 6.3 调用方契约

- **必须传 id**：归一化不会自动分配 id。  
- **uid 与 id 同值**：未来可能 diverge，调用方应优先用 `q.uid` 作 ProgressAPI key（见 [CONTRACT-api.md](./CONTRACT-api.md)）。

---

## 7. `core/parsers/*` （Excel/JSON/CSV/PDF/Text 解析器）

### 7.1 统一返回 shape

```typescript
type ParseResult = Result<{
  questions: NormalizedQuestion[];  // 归一化前的 raw 数组
  warnings?: string[];
}>;
```

### 7.2 调用方契约

- **解析器不归一化题目**：返回 raw，由 IOAPI 调用 `normalizeQuestion` 完成归一化。  
- **解析器不依赖 LX 全局**：纯函数，输入是文本/二进制，输出是结构化数据。  
- **SheetJS / pdf.js 是外部依赖**：解析器内部 `if (typeof XLSX === 'undefined')` 兜底返回 `err(DEP_MISSING)`，不抛错。

---

## 8. 兼容性矩阵

| core 模块 | 依赖 | 可被谁调用 |
|---|---|---|
| errors | 无 | 任何层 |
| events | 无 | 任何层（包括 render） |
| state | utils（deepClone） | api 层 |
| storage | errors | api 层 |
| id | 无 | api 层 |
| validators/question | utils | api 层（library/io） |
| parsers/* | errors, utils | api 层（io） |

---

## 9. 变更流程

**任何对 core 层的接口变更**（新增/删除导出、改函数签名、改返回 shape）必须：

1. 同步更新本文件；  
2. 全代码库 grep 受影响的调用点，逐一修正；  
3. 跑全量测试（`test.html`）；  
4. 提交 commit message 带前缀 `core:` 或 `contract:`，便于回溯。  
5. 升级版本号 minor（如 2.6.x → 2.7.0）。
