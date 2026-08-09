/**
 * 测试聚合入口
 * 此文件 import 所有 .test.js 文件，触发 describe/it 注册
 * test.html 加载此文件后，所有测试套件就绪
 * @module test/index
 */

// 单元测试
import './unit/library.test.js';
import './unit/question.test.js';
import './unit/progress.test.js';
import './unit/navigation.test.js';
import './unit/wrong-book.test.js';
import './unit/category.test.js';
import './unit/io.test.js';
import './unit/stats.test.js';
import './unit/test-api.test.js';

// 集成测试（用户流程）
import './integration/study-flow.test.js';
import './integration/import-export.test.js';
import './integration/wrong-book-cycle.test.js';
import './integration/progress-backup.test.js';
import './integration/multi-library-switch.test.js';
import './integration/category-merge.test.js';

// 回归测试
import './regression/bugs.test.js';
import './regression/multi-wrongbook.test.js';
