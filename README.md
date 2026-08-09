# lx — 纯静态刷题网页

> **零后端、零构建、零运行时 npm 依赖**：源码即部署文件，`app.html` 直接在浏览器跑。所有数据保存在浏览器 localStorage。

## 快速开始

```bash
# 一行启动本地开发服务器（自动开浏览器 + 带 no-cache 清缓存）
./serve.sh

# 只起服务器
./serve.sh --no-open
```

然后打开：
- UI：http://127.0.0.1:8080/app.html
- 测试控制台：http://127.0.0.1:8080/test.html （点「▶ 运行全部」，目标 **52/52 全通过**）

在线预览：
- 稳定版：https://zefengwang.github.io/lx/app.html
- 预览版（v3-preview）：https://zefengwang.github.io/lx/v3-preview/app.html

## 文档总入口（开发者 & 维护者必读）

> **所有接手人员先从下面 4 个文档读起**，顺序：MAINTENANCE → CONTRACT-core → CONTRACT-api → types.js。

| 文档 | 说明 | 路径 |
|---|---|---|
| **📘 开发与维护手册** | **总入口**：架构说明、调试排障 SOP、测试体系、版本与部署流程、历次 Bug 索引表、新增功能范式、FAQ | [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md) |
| 🔗 core ↔ api 接口契约 | core 层（基础层）对外给 api 层（业务层）的函数、错误码、事件、状态结构 | [`docs/CONTRACT-core.md`](docs/CONTRACT-core.md) |
| 🔗 api ↔ UI 接口契约 | `window.LX.*` 给 UI 层的全部 API（LibraryAPI、QuestionAPI、WrongBookAPI…）| [`docs/CONTRACT-api.md`](docs/CONTRACT-api.md) |
| 🏷️ 全局类型定义（JSDoc） | 无运行时代码，只做 IDE 静态检查；所有题目 / Result / AnswerResult 等类型 | [`src/types.js`](src/types.js) |

**一句话快速判断该看哪份：**
- "这个 bug 怎么修 / 测试怎么跑 / 怎么部署？" → **看 MAINTENANCE.md**
- "QuestionAPI.answer 的参数到底传字符串还是数组？返回什么？" → **看 CONTRACT-api.md**
- "localStorage 存什么 key / 错误码 STORAGE_FULL 怎么返回？" → **看 CONTRACT-core.md**
- "为什么 IDE 报类型不匹配？" → **看 src/types.js**

## 版本号

当前版本：**3.0.1**（[version.txt](version.txt) ↔ [src/api/index.js](src/api/index.js) 的 `VERSION` 常量，两者必须同步）

## 三层架构一览（单向依赖，禁止反向）

```
render/  (UI 层)      ← 只能 import api/；产出 DOM、toast、主题、路由
   ▲ 单向调用（window.LX.*）
api/     (业务层)     ← 只能 import core/；产出 QuestionAPI / WrongBookAPI ...
   ▲ 单向调用（Result + 事件）
core/    (基础层)     ← 零 DOM、零业务依赖；状态机、存储、解析、校验、错误码
```

**禁止反向依赖：** core 不能 import api/render，render 不能 import core。详细规则见 `docs/MAINTENANCE.md` 第 2 节。
