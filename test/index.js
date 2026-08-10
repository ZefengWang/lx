/**
 * 测试聚合入口
 * 此文件 import 所有 .test.js 文件，触发 describe/it 注册
 * test.html 加载此文件后，所有测试套件就绪
 *
 * 分层约定（runner describe 第三参 meta.layer）：
 *   core | api | ui | integration | system | regression
 *
 * @module test/index
 */

// —— core 单测 ——
import './unit/core/errors.test.js';
import './unit/core/events.test.js';
import './unit/core/state.test.js';
import './unit/core/validators.test.js';
import './unit/core/storage.test.js';
import './unit/core/id.test.js';
import './unit/core/parsers.test.js';

// —— api 单测 ——
import './unit/library.test.js';
import './unit/question.test.js';
import './unit/question-crud.test.js';
import './unit/question-search.test.js';
import './unit/drill.test.js';
import './unit/progress.test.js';
import './unit/navigation.test.js';
import './unit/test-hooks.test.js';
import './unit/runner-runcase.test.js';
import './unit/events-matrix.test.js';
import './unit/api-errors.test.js';
import './unit/wrong-book.test.js';
import './unit/category.test.js';
import './unit/io.test.js';
import './unit/stats.test.js';
import './unit/test-api.test.js';
import './unit/default-library.test.js';

// —— UI 契约 / 生命周期 / 钩子 ——
import './unit/router-hook.test.js';
import './ui/wrongbook-flow.test.js';
import './ui/study-lifecycle.test.js';
import './ui/catalog-search.test.js';
import './unit/catalog-search-state.test.js';
import './ui/gestures.test.js';
import './ui/harness-rerun.test.js';

// —— UI 按钮级 DOM（需 dom-harness）——
import './ui/pages/home.buttons.test.js';
import './ui/pages/help.buttons.test.js';
import './ui/pages/browse.buttons.test.js';
import './ui/pages/browse-session.test.js';
import './unit/ui-session.test.js';
import './unit/search-playlist.test.js';
import './ui/pages/study-card.buttons.test.js';
import './ui/pages/study-drill.buttons.test.js';
import './ui/pages/wrongbook.buttons.test.js';
import './ui/pages/settings.buttons.test.js';
import './ui/pages/add-question.buttons.test.js';
import './ui/pages/stats.render.test.js';
import './ui/shell/bottombar.buttons.test.js';
import './ui/shell/topbar.buttons.test.js';
import './ui/shell/drawer.buttons.test.js';

// —— 集成（跨 API 模块流程）——
import './integration/study-flow.test.js';
import './integration/import-export.test.js';
import './integration/wrong-book-cycle.test.js';
import './integration/progress-backup.test.js';
import './integration/multi-library-switch.test.js';
import './integration/category-merge.test.js';

// —— 系统级完整旅程 ——
import './system/wrongbook-celebration.test.js';
import './system/full-journey.test.js';
import './system/search-journey.test.js';
import './system/drill-journey.test.js';
import './system/failure-injection.test.js';
import './system/default-library-journey.test.js';
// 手写 ui-state-* 样板已由矩阵 iframe SAR 覆盖；仅保留高风险稀有锁
import './system/ui-state-risk-locks.test.js';
import './system/ui-iframe-smoke.test.js';
import './system/ui-sar-matrix/matrix.test.js';

// —— 回归 ——
import './regression/bugs.test.js';
import './regression/multi-wrongbook.test.js';
