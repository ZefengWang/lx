import { describe, it, beforeEach } from '../runner.js';
import { assertOk, assertEqual, assertErr, assertTrue } from '../assert.js';
import { getLX, resetStateBeforeEach } from '../helpers.js';

describe('NavigationAPI', () => {
    let LX;
    let libId;

    beforeEach(async () => {
        await resetStateBeforeEach();
        LX = getLX();
        const r = LX.LibraryAPI.create('导航题库', [
            { id: 1, type: 'essay', question: 'q1', category: 'A', answer: '', explanation: '' },
            { id: 2, type: 'essay', question: 'q2', category: 'A', answer: '', explanation: '' },
            { id: 3, type: 'essay', question: 'q3', category: 'B', answer: '', explanation: '' },
        ]);
        libId = r.data.id;
        LX.LibraryAPI.switch(libId);
    });

    it('next 循环到末尾后回 0', () => {
        // 从 0 开始
        let cur = LX.NavigationAPI.current();
        assertEqual(cur.data.index, 0);
        assertEqual(cur.data.total, 3);

        LX.NavigationAPI.next();
        assertEqual(LX.NavigationAPI.current().data.index, 1);

        LX.NavigationAPI.next();
        assertEqual(LX.NavigationAPI.current().data.index, 2);

        LX.NavigationAPI.next();
        assertEqual(LX.NavigationAPI.current().data.index, 0, '末尾后应循环回 0');

        LX.NavigationAPI.prev();
        assertEqual(LX.NavigationAPI.current().data.index, 2, 'prev 从 0 应回到末尾');
    });

    it('setCategory 后 filteredQIds 仅含该分类', () => {
        const r = LX.NavigationAPI.setCategory('A');
        assertOk(r);
        const cur = LX.NavigationAPI.current();
        assertEqual(cur.data.total, 2, '分类 A 有 2 题');

        LX.NavigationAPI.setCategory('B');
        assertEqual(LX.NavigationAPI.current().data.total, 1, '分类 B 有 1 题');

        LX.NavigationAPI.setCategory('all');
        assertEqual(LX.NavigationAPI.current().data.total, 3, 'all 应含全部 3 题');
    });

    it('current() 不引发 setState 循环（bug C 回归）', () => {
        // 监听 state 变化，current() 不应触发无意义 setState
        const { getState, subscribe } = LX; // 注意：state 模块未直接挂载到 LX，需通过事件监听
        let navChanges = 0;
        const off = LX.on(LX.Events.NAVIGATION_CHANGED, () => {
            navChanges++;
        });

        // 连续调用 current() 不应触发 NAVIGATION_CHANGED
        LX.NavigationAPI.current();
        LX.NavigationAPI.current();
        LX.NavigationAPI.current();

        assertEqual(navChanges, 0, 'current() 不应触发 NAVIGATION_CHANGED 事件');
        off();

        // 主动 next() 应触发
        let navCount2 = 0;
        const off2 = LX.on(LX.Events.NAVIGATION_CHANGED, () => navCount2++);
        LX.NavigationAPI.next();
        assertEqual(navCount2, 1, 'next() 应触发一次');
        off2();
    });
});
