import { describe, it } from '../../runner.js';
import { assertEqual, assertTrue } from '../../assert.js';
import {
    normalizeQuestion, validateQuestion, QUESTION_TYPES,
} from '../../../src/core/validators/question.js';

describe('core/validators/question', () => {
    it('QUESTION_TYPES 含五题型', () => {
        assertEqual(QUESTION_TYPES.slice().sort(), ['essay', 'fill', 'judge', 'multi', 'single'].sort());
    });

    it('normalizeQuestion 补全 id/options/type', () => {
        const q = normalizeQuestion({
            id: 1,
            type: 'single',
            question: '题干',
            options: ['A.一', 'B.二'],
            answer: 'A',
        });
        assertEqual(q.type, 'single');
        assertEqual(q.question, '题干');
        assertTrue(Array.isArray(q.options));
        assertEqual(q.options.length, 2);
    });

    it('normalizeQuestion 中文题型映射', () => {
        const q = normalizeQuestion({ type: '多选题', question: 'q', options: ['A', 'B'], answer: 'A,B' });
        assertEqual(q.type, 'multi');
    });

    it('S=无效对象 A=normalizeQuestion → R=空白题骨架', () => {
        const q = normalizeQuestion(null, 9);
        assertEqual(q.type, 'essay');
        assertEqual(q.displayId, 9);
        assertEqual(q.question, '');
    });

    it('S=未知英文题型 A=normalize → R=降级 essay', () => {
        const q = normalizeQuestion({ type: 'unknown', question: 'x' });
        assertEqual(q.type, 'essay');
    });

    it('validateQuestion：空题干/无效题型/选择题选项不足/缺答案', () => {
        assertEqual(validateQuestion(null).valid, false);
        assertEqual(validateQuestion({ type: 'single', question: '', options: ['A', 'B'], answer: 'A' }).valid, false);
        assertEqual(validateQuestion({ type: 'weird', question: 'q' }).valid, false);
        assertEqual(validateQuestion({ type: 'single', question: 'q', options: ['A'], answer: 'A' }).valid, false);
        assertEqual(validateQuestion({ type: 'fill', question: 'q', answer: '' }).valid, false);
        assertEqual(validateQuestion({
            type: 'single', question: 'q', options: ['A', 'B'], answer: 'A',
        }).valid, true);
    });

    it('normalize：explanation/mnemonic 互相同步', () => {
        const a = normalizeQuestion({ question: 'q', explanation: '解析文' });
        assertEqual(a.mnemonic, '解析文');
        const b = normalizeQuestion({ question: 'q', mnemonic: '口诀文' });
        assertEqual(b.explanation, '口诀文');
    });
}, { layer: 'core', tags: ['unit', 'validators', 'sar'] });
