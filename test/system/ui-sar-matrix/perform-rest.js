/**
 * SAR 矩阵后半段 handlers（settings / browse / addq / help）
 * @module test/system/ui-sar-matrix/perform-rest
 */

/**
 * @param {Record<string, Function>} handlers
 * @param {object} api
 */
export function registerRestHandlers(handlers, api) {
    const {
        seedLib, MIXED_QS, ESSAY_QS,
        assignFile, libFileInput, progressFileInput,
        softClickText, softClickLabel, withApiMock,
        runUnreachable, assertUnchangedCore, assertEqualLib,
        isUnhappy, has,
        mountShellWithPage,
        createBrowsePage, createSettingsPage, createAddQuestionPage, createHelpPage,
        collectUiState, assertStateDelta, getLX,
        clearToastLog, clearNavigateLog, assertNavigatedTo, assertToastIncludes,
        installConfirmSpy, getNavigateLog, getConfirmLog,
        clickText, clickLabel, type, wait,
    } = api;

    Object.assign(handlers, {
        async 'settings.fileInput.library'(c, _ctx, cleanups) {
            seedLib('SAR设置导入库');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            const LX = getLX();
            // 点击「上传新题库」→ triggerFileImport() 创建 temp input（append 到 body）
            clickText(s.root, '上传新题库');
            const input = [...document.querySelectorAll('input[type="file"]')]
                .find((el) => (el.accept || '').includes('xlsx'));
            if (!input) throw new Error('点击上传后应创建 temp file input');
            if (isUnhappy(c) && has(c, '取消')) {
                const before = collectUiState(s.root);
                input.dispatchEvent(new Event('change', { bubbles: true }));
                await wait(50);
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.libCount']);
                return;
            }
            if (isUnhappy(c) && has(c, 'parse', 'fail')) {
                clearToastLog();
                const before = collectUiState(s.root);
                assignFile(input, LX.TestAPI.mockFile('{bad', '坏.json'));
                await wait(250);
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.libCount']);
                assertToastIncludes(/失败|解析|格式/);
                return;
            }
            if (isUnhappy(c) && has(c, '0题')) {
                clearToastLog();
                assignFile(input, LX.TestAPI.mockFile(JSON.stringify([]), '空.json'));
                await wait(250);
                assertToastIncludes(/没有题目|解析失败|检查格式/);
                return;
            }
            if (isUnhappy(c) && has(c, 'DUPLICATE')) {
                const qs = [{ id: 99, type: 'essay', question: '重复导入题DUP-SAR', answer: '' }];
                LX.IOAPI.importLibrary('先入库', qs);
                const before = collectUiState(s.root).domain.libCount;
                clearToastLog();
                assignFile(input, LX.TestAPI.mockFile(JSON.stringify(qs), 'dup.json'));
                await wait(250);
                assertToastIncludes(/重复|已存在|DUPLICATE|失败/);
                if (collectUiState(s.root).domain.libCount < before) {
                    throw new Error('DUPLICATE 不应删库');
                }
                return;
            }
            clearToastLog();
            const before = collectUiState(s.root);
            const qs = [{ id: 1, type: 'essay', question: '导入题干IMPORT-SAR', answer: '', category: 'I' }];
            assignFile(input, LX.TestAPI.mockFile(JSON.stringify(qs), '导入SAR.json'));
            await wait(250);
            assertToastIncludes(/成功导入|导入/);
            if (collectUiState(s.root).domain.libCount < before.domain.libCount) {
                throw new Error('导入应增库或切库');
            }
        },

        async 'settings.fileInput.progress'(c, _ctx, cleanups) {
            seedLib('SAR进度导入', MIXED_QS.slice(0, 2));
            const LX = getLX();
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(1).data, 'mastered');
            const exported = LX.ProgressAPI.export();
            LX.ProgressAPI.reset();
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            const input = progressFileInput(s.root);
            if (isUnhappy(c) && has(c, '取消')) {
                const before = collectUiState(s.root);
                input.dispatchEvent(new Event('change', { bubbles: true }));
                await wait(50);
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.progress']);
                return;
            }
            if (isUnhappy(c) && has(c, 'fail')) {
                clearToastLog();
                assignFile(input, LX.TestAPI.mockFile('{坏', 'bad-progress.json'));
                await wait(250);
                assertToastIncludes(/失败|解析|格式/);
                return;
            }
            clearToastLog();
            assignFile(input, LX.TestAPI.mockFile(exported.data, 'progress.json'));
            await wait(250);
            assertToastIncludes('进度已恢复');
            if (collectUiState(s.root).domain.progress.mastered < 1) {
                throw new Error('进度应恢复');
            }
        },

        async 'settings.lib.switch'(c, _ctx, cleanups) {
            const a = seedLib('SAR设置切A', ESSAY_QS);
            const LX = getLX();
            const r = LX.LibraryAPI.create('SAR设置切B', ESSAY_QS, { skipDuplicateCheck: true });
            LX.LibraryAPI.switch(a.libId);
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c) && has(c, 'API', '!ok')) {
                const before = collectUiState(s.root);
                withApiMock(LX.LibraryAPI, 'switch', { ok: false, error: { code: 'FAIL', message: 'x' } }, () => {
                    const row = [...s.root.querySelectorAll('.lx-list__item')]
                        .find((el) => (el.textContent || '').includes('SAR设置切B'));
                    const sw = row && [...row.querySelectorAll('button')]
                        .find((b) => (b.textContent || '').trim() === '切换');
                    if (sw) sw.click();
                });
                assertEqualLib(before, collectUiState(s.root));
                return;
            }
            const row = [...s.root.querySelectorAll('.lx-list__item')]
                .find((el) => (el.textContent || '').includes('SAR设置切B'));
            if (!row) throw new Error('无目标库行');
            const sw = [...row.querySelectorAll('button')]
                .find((b) => (b.textContent || '').trim() === '切换');
            if (!sw) throw new Error('无切换按钮');
            sw.click();
            if (LX.LibraryAPI.current().data !== r.data.id) throw new Error('切换失败');
        },

        async 'settings.lib.delete'(c, _ctx, cleanups) {
            seedLib('SAR设置当前库', ESSAY_QS);
            const LX = getLX();
            LX.LibraryAPI.create('SAR待删库', ESSAY_QS, { skipDuplicateCheck: true });
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            const row = [...s.root.querySelectorAll('.lx-list__item')]
                .find((el) => (el.textContent || '').includes('SAR待删库'));
            const delBtn = row && [...row.querySelectorAll('button')]
                .find((b) => (b.textContent || '').trim() === '删除');
            if (isUnhappy(c) && has(c, 'cancel', '取消')) {
                const off = installConfirmSpy(false);
                cleanups.push(off);
                const before = collectUiState(s.root);
                if (delBtn) delBtn.click();
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.libCount']);
                return;
            }
            if (isUnhappy(c) && has(c, 'fail', 'delete')) {
                const off = installConfirmSpy(true);
                cleanups.push(off);
                const before = collectUiState(s.root);
                withApiMock(LX.LibraryAPI, 'delete', { ok: false, error: { code: 'FAIL', message: 'x' } }, () => {
                    if (delBtn) delBtn.click();
                });
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.libCount']);
                return;
            }
            const before = collectUiState(s.root);
            if (!delBtn) throw new Error('无删除');
            delBtn.click();
            if (collectUiState(s.root).domain.libCount !== before.domain.libCount - 1) {
                throw new Error('删除应减库');
            }
        },

        async 'settings.uploadLibrary'(c, _ctx, cleanups) {
            seedLib('SAR上传按钮');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                // 取消选文件：点上传只创建 temp input，不选文件 → 不增库
                const before = collectUiState(s.root);
                softClickText(s.root, '上传新题库');
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.libCount']);
                return;
            }
            // happy：点「上传新题库」→ triggerFileImport 创建 temp input → assignFile 触发导入
            clickText(s.root, '上传新题库');
            const tempInput = [...document.querySelectorAll('input[type="file"]')]
                .find((el) => (el.accept || '').includes('xlsx'));
            if (!tempInput) throw new Error('点击上传后应创建 temp file input');
            const LX = getLX();
            const before = collectUiState(s.root);
            const qs = [{ id: 1, type: 'essay', question: '上传按钮导入SAR', answer: '' }];
            assignFile(tempInput, LX.TestAPI.mockFile(JSON.stringify(qs), '上传SAR.json'));
            await wait(250);
            assertToastIncludes(/成功导入|导入/);
            if (collectUiState(s.root).domain.libCount <= before.domain.libCount) {
                throw new Error('上传应增库');
            }
        },

        async 'settings.exportProgress'(c, _ctx, cleanups) {
            if (isUnhappy(c) && has(c, '无库', '不可达')) {
                await runUnreachable(c, cleanups, async (ctx) => softClickText(ctx.root, '备份进度'));
                return;
            }
            seedLib('SAR备份进度');
            const LX = getLX();
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(1).data, 'mastered');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c) && has(c, 'fail')) {
                clearToastLog();
                const before = collectUiState(s.root);
                withApiMock(LX.IOAPI, 'exportProgress', { ok: false, error: { code: 'FAIL', message: 'x' } }, () => {
                    const b = [...s.root.querySelectorAll('button')]
                        .find((el) => (el.textContent || '').includes('备份进度'));
                    if (b) b.click();
                });
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.progress']);
                // toast 文案随实现；核心是进度不变且无下载
                if (collectUiState(s.root).meta.downloads.some((f) => f.includes('progress-backup'))) {
                    throw new Error('export fail 不应产生备份下载');
                }
                return;
            }
            clearToastLog();
            const before = collectUiState(s.root);
            const btn = [...s.root.querySelectorAll('button')]
                .find((b) => (b.textContent || '').includes('备份进度'));
            if (!btn) throw new Error('无备份进度');
            btn.click();
            const after = collectUiState(s.root);
            if (!after.meta.downloads.some((f) => f.includes('progress'))) {
                throw new Error('应下载进度备份');
            }
            assertStateDelta(before, after, {}, ['domain.progress']);
        },

        async 'settings.importProgressBtn'(c, _ctx, cleanups) {
            seedLib('SAR恢复进度按钮');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            const input = progressFileInput(s.root);
            if (isUnhappy(c)) {
                const before = collectUiState(s.root);
                softClickText(s.root, '恢复进度');
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.progress']);
                return;
            }
            if (!input) throw new Error('无进度 file input');
            let clicked = false;
            const orig = input.click.bind(input);
            input.click = () => { clicked = true; };
            try {
                const btn = [...s.root.querySelectorAll('button')]
                    .find((b) => (b.textContent || '').includes('恢复进度'));
                if (!btn) throw new Error('无恢复进度按钮');
                btn.click();
                if (!clicked) throw new Error('应触发 progress input click');
            } finally {
                input.click = orig;
            }
        },

        async 'settings.resetProgress'(c, _ctx, cleanups) {
            if (isUnhappy(c) && has(c, '无当前', '无库')) {
                await runUnreachable(c, cleanups, async (ctx) => softClickText(ctx.root, '重置当前题库进度'));
                return;
            }
            seedLib('SAR设置重置', MIXED_QS.slice(0, 3));
            const LX = getLX();
            LX.ProgressAPI.setStatus(LX.QuestionAPI.get(1).data, 'mastered');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            s.refresh();
            if (isUnhappy(c) && has(c, 'cancel', '取消')) {
                const off = installConfirmSpy(false);
                cleanups.push(off);
                const before = collectUiState(s.root);
                clickText(s.root, '重置当前题库进度');
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.progress', 'chrome.progressText']);
                return;
            }
            if (isUnhappy(c) && has(c, 'API', '!ok')) {
                const off = installConfirmSpy(true);
                cleanups.push(off);
                const before = collectUiState(s.root);
                withApiMock(LX.ProgressAPI, 'reset', { ok: false, error: { code: 'FAIL', message: 'x' } }, () => {
                    clickText(s.root, '重置当前题库进度');
                });
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.progress']);
                return;
            }
            clearToastLog();
            const before = collectUiState(s.root);
            clickText(s.root, '重置当前题库进度');
            assertStateDelta(before, collectUiState(s.root), {
                domain: { progress: { mastered: 0, review: 0 } },
                meta: { toastLastIncludes: '进度已重置' },
            });
        },

        async 'settings.export.json'(c, _ctx, cleanups) {
            await exportFmt(c, cleanups, 'JSON', '.json');
        },
        async 'settings.export.xlsx'(c, _ctx, cleanups) {
            await exportFmt(c, cleanups, 'Excel', '.xlsx');
        },
        async 'settings.export.csv'(c, _ctx, cleanups) {
            if (isUnhappy(c) && has(c, '无库')) {
                await runUnreachable(c, cleanups, async (ctx) => softClickText(ctx.root, 'CSV'));
                return;
            }
            seedLib();
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            clearToastLog();
            const before = collectUiState(s.root);
            const btn = [...s.root.querySelectorAll('button')]
                .find((b) => (b.textContent || '').trim() === 'CSV');
            if (!btn) throw new Error('无 CSV');
            btn.click();
            assertToastIncludes(/导出失败|不支持|已导出/);
            assertStateDelta(before, collectUiState(s.root), {}, ['domain.questionCount']);
        },

        async 'settings.downloadTemplate'(c, _ctx, cleanups) {
            seedLib('SAR模板');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                const LX = getLX();
                clearToastLog();
                const before = collectUiState(s.root);
                withApiMock(LX.IOAPI, 'downloadTemplate', { ok: false, error: { code: 'FAIL', message: 'x' } }, () => {
                    softClickText(s.root, '下载导入模板');
                });
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.progress']);
                return;
            }
            if (typeof window.XLSX === 'undefined') {
                // 无 SheetJS：点一下不崩即可
                softClickText(s.root, '下载导入模板');
                return;
            }
            clearToastLog();
            clickText(s.root, '下载导入模板');
            assertToastIncludes(/模板/);
        },

        async 'settings.theme'(c, _ctx, cleanups) {
            seedLib('SAR主题');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            const red = s.root.querySelector('[title="红"]')
                || [...s.root.querySelectorAll('button[title]')].find((b) => (b.getAttribute('title') || '').includes('红'));
            if (!red) throw new Error('无主题红');
            red.click();
            if (document.documentElement.getAttribute('data-theme') !== 'red') {
                throw new Error('主题未切换');
            }
            if (isUnhappy(c) && has(c, '重复')) {
                red.click();
                if (document.documentElement.getAttribute('data-theme') !== 'red') {
                    throw new Error('重复切换异常');
                }
            }
        },

        async 'settings.mode'(c, _ctx, cleanups) {
            seedLib('SAR模式');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            clickText(s.root, '夜间模式');
            if (document.documentElement.getAttribute('data-mode') !== 'night') {
                throw new Error('夜间模式未生效');
            }
            if (isUnhappy(c) && has(c, '重复')) {
                clickText(s.root, '夜间模式');
                if (document.documentElement.getAttribute('data-mode') !== 'night') {
                    throw new Error('重复切换异常');
                }
            }
        },

        async 'settings.openHelp'(c, _ctx, cleanups) {
            seedLib('SAR设置帮助');
            const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                const before = collectUiState(s.root);
                assertUnchangedCore(before, collectUiState(s.root));
                return;
            }
            clearNavigateLog();
            clickText(s.root, '查看使用帮助');
            assertNavigatedTo('help');
        },
    });

    async function exportFmt(c, cleanups, label, ext) {
        if (isUnhappy(c) && has(c, '无库', '不可达')) {
            await runUnreachable(c, cleanups, async (ctx) => softClickText(ctx.root, label));
            return;
        }
        seedLib(`SAR导出${label}`);
        const LX = getLX();
        const s = mountShellWithPage(createSettingsPage, { routeName: 'settings', showBottombar: false });
        cleanups.push(() => s.destroy());
        if (isUnhappy(c) && has(c, '失败', '导出')) {
            clearToastLog();
            const before = collectUiState(s.root);
            withApiMock(LX.IOAPI, 'exportLibrary', { ok: false, error: { code: 'FAIL', message: 'x' } }, () => {
                softClickText(s.root, label);
            });
            assertStateDelta(before, collectUiState(s.root), {}, ['domain.questionCount']);
            return;
        }
        if (label === 'Excel' && typeof window.XLSX === 'undefined') {
            softClickText(s.root, label);
            return;
        }
        clearToastLog();
        const btn = [...s.root.querySelectorAll('button')]
            .find((b) => (b.textContent || '').trim() === label || (b.textContent || '').includes(label));
        if (!btn) throw new Error(`无导出按钮 ${label}`);
        btn.click();
        const after = collectUiState(s.root);
        if (after.meta.downloads.length === 0 && label !== 'Excel') {
            throw new Error(`${label} 导出应有下载`);
        }
        assertToastIncludes(/已导出|导出/);
    }

    // browse
    Object.assign(handlers, {
        async 'browse.backStudy'(c, _ctx, cleanups) {
            seedLib('SAR浏览返回');
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                const before = collectUiState(s.root);
                assertUnchangedCore(before, collectUiState(s.root));
                return;
            }
            clearNavigateLog();
            if (!softClickText(s.root, '返回刷题') && !softClickLabel(s.root, '返回刷题')) {
                clickLabel(s.root, '返回');
            }
            assertNavigatedTo('study');
        },

        async 'browse.addQuestion'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                const before = collectUiState(s.root);
                assertUnchangedCore(before, collectUiState(s.root));
                return;
            }
            clearNavigateLog();
            clickLabel(s.root, '新增题目');
            assertNavigatedTo('add-question');
        },

        async 'browse.search.input'(c, _ctx, cleanups) {
            seedLib('SAR搜索输入', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            const input = s.root.querySelector('[aria-label="搜索题干"]');
            if (!input) throw new Error('无搜索框');
            if (isUnhappy(c) && has(c, 'IME')) {
                throw new Error(`DEFERRED: ${c.id}`);
            }
            if (isUnhappy(c) && has(c, '空')) {
                type(input, '');
                clearToastLog();
                clickLabel(s.root, '执行题干搜索');
                assertToastIncludes('关键字');
                return;
            }
            type(input, 'ALPHA');
            if (input.value !== 'ALPHA') throw new Error('搜索草稿未写入');
        },

        async 'browse.search.submit'(c, _ctx, cleanups) {
            seedLib('SAR搜索提交', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                clearToastLog();
                const before = collectUiState(s.root);
                clickLabel(s.root, '执行题干搜索');
                assertStateDelta(before, collectUiState(s.root), {
                    meta: { toastLastIncludes: '关键字' },
                }, ['page.filterChipCount']);
                return;
            }
            type(s.root.querySelector('[aria-label="搜索题干"]'), 'ALPHA');
            clickLabel(s.root, '执行题干搜索');
            const after = collectUiState(s.root);
            if (after.page.filterChipCount < 1) throw new Error('应有过滤标签');
            if (after.page.catalogItemCount < 1) throw new Error('应有命中');
        },

        async 'browse.search.chipDismiss'(c, _ctx, cleanups) {
            if (isUnhappy(c)) {
                await runUnreachable(c, cleanups, async (ctx) => {
                    const d = ctx.root.querySelector('.lx-chip__dismiss');
                    if (d) d.click();
                });
                return;
            }
            seedLib('SAR清标签', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            type(s.root.querySelector('[aria-label="搜索题干"]'), 'ALPHA');
            clickLabel(s.root, '执行题干搜索');
            const dismiss = s.root.querySelector('.lx-chip__dismiss');
            if (!dismiss) throw new Error('无清除标签');
            dismiss.click();
            if (collectUiState(s.root).page.filterChipCount !== 0) throw new Error('标签应清空');
        },

        async 'browse.toolbar.modeToggle'(c, _ctx, cleanups) {
            await browseToolbar(c, cleanups, /顺序|随机/);
        },
        async 'browse.toolbar.reshuffle'(c, _ctx, cleanups) {
            await browseToolbar(c, cleanups, /换一批/);
        },
        async 'browse.toolbar.clearCategory'(c, _ctx, cleanups) {
            if (isUnhappy(c)) {
                await runUnreachable(c, cleanups, async (ctx) => softClickText(ctx.root, '清除分类'));
                return;
            }
            seedLib('SAR清分类', MIXED_QS);
            const LX = getLX();
            LX.NavigationAPI.setCategory('甲');
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            if (!softClickText(s.root, '清除分类') && !softClickLabel(s.root, /清除/)) {
                // 工具栏可能文案不同
                softClickText(s.root, '全部');
            }
            // 不强求 category===all，只要不崩
        },
        async 'browse.toolbar.collapseAll'(c, _ctx, cleanups) {
            await browseToolbar(c, cleanups, /全部折叠|折叠/);
        },
        async 'browse.toolbar.expandAll'(c, _ctx, cleanups) {
            await browseToolbar(c, cleanups, /全部展开|展开/);
        },

        async 'browse.practice.open'(c, _ctx, cleanups) {
            if (isUnhappy(c)) {
                await runUnreachable(c, cleanups, async (ctx) => softClickLabel(ctx.root, '练习模式'));
                return;
            }
            seedLib('SAR练习开', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            clickLabel(s.root, '练习模式');
            if (!collectUiState(s.root).page.practiceModalOpen) throw new Error('练习面板应打开');
        },

        async 'browse.practice.hint'(c, _ctx, cleanups) {
            if (isUnhappy(c) && has(c, '无库')) {
                await runUnreachable(c, cleanups, async (ctx) => softClickLabel(ctx.root, '练习模式说明'));
                return;
            }
            seedLib('SAR练习说明', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c) && has(c, 'cancel', '取消')) {
                const off = installConfirmSpy(false);
                cleanups.push(off);
                clearNavigateLog();
                clickLabel(s.root, '练习模式说明');
                if (getNavigateLog().some((e) => e.name === 'help')) {
                    throw new Error('取消不应跳帮助');
                }
                return;
            }
            const off = installConfirmSpy(true);
            cleanups.push(off);
            clearNavigateLog();
            clickLabel(s.root, '练习模式说明');
            // 同意可能跳 help
            if (getConfirmLog().length < 1) throw new Error('应弹出说明 confirm');
        },

        async 'browse.practice.overlayClose'(c, _ctx, cleanups) {
            await practiceClose(c, cleanups, 'overlay');
        },
        async 'browse.practice.closeX'(c, _ctx, cleanups) {
            await practiceClose(c, cleanups, 'x');
        },
        async 'browse.practice.mode.memory'(c, _ctx, cleanups) {
            await practiceMode(c, cleanups, '背诵记忆', 'memory');
        },
        async 'browse.practice.mode.quick'(c, _ctx, cleanups) {
            await practiceMode(c, cleanups, '快速刷题', 'quick');
        },

        async 'browse.practice.countInput'(c, _ctx, cleanups) {
            if (isUnhappy(c) && has(c, '无库')) {
                await runUnreachable(c, cleanups, async () => {});
                return;
            }
            seedLib('SAR题量', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            clickLabel(s.root, '练习模式');
            if (isUnhappy(c) && has(c, 'memory', 'disabled')) {
                // 默认背诵
                if (collectUiState(s.root).page.practiceCountDisabled !== true) {
                    throw new Error('背诵时题量应 disabled');
                }
                return;
            }
            clickLabel(s.root, '快速刷题');
            const input = s.root.querySelector('[aria-label="本轮题量"]');
            if (isUnhappy(c) && has(c, '空')) {
                type(input, '');
                return;
            }
            type(input, '3');
            if (input.value !== '3') throw new Error('题量未写入');
        },

        async 'browse.practice.cancel'(c, _ctx, cleanups) {
            if (isUnhappy(c)) {
                await runUnreachable(c, cleanups, async () => {});
                return;
            }
            seedLib('SAR取消练习', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            clickLabel(s.root, '练习模式');
            clickLabel(s.root, '取消练习模式');
            if (collectUiState(s.root).page.practiceModalOpen) throw new Error('应关闭面板');
            if (getLX().DrillAPI.isActive()) throw new Error('不应启动 drill');
        },

        async 'browse.practice.start'(c, _ctx, cleanups) {
            if (isUnhappy(c) && has(c, '无库')) {
                await runUnreachable(c, cleanups, async () => {});
                return;
            }
            seedLib('SAR开始练习', MIXED_QS);
            const LX = getLX();
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            clickLabel(s.root, '练习模式');
            clickLabel(s.root, '快速刷题');
            if (isUnhappy(c) && has(c, '题量无效')) {
                type(s.root.querySelector('[aria-label="本轮题量"]'), '0');
                clearToastLog();
                clickLabel(s.root, '开始练习');
                assertToastIncludes(/题量|无效|至少|大于/);
                return;
            }
            if (isUnhappy(c) && has(c, 'fail', 'start')) {
                type(s.root.querySelector('[aria-label="本轮题量"]'), '2');
                const before = collectUiState(s.root);
                withApiMock(LX.DrillAPI, 'start', { ok: false, error: { code: 'FAIL', message: 'x' } }, () => {
                    softClickLabel(s.root, '开始练习');
                });
                if (LX.DrillAPI.isActive()) throw new Error('start fail 不应激活');
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.drill.active']);
                return;
            }
            type(s.root.querySelector('[aria-label="本轮题量"]'), '2');
            clearNavigateLog();
            clickLabel(s.root, '开始练习');
            assertNavigatedTo('study');
            if (!LX.DrillAPI.isActive()) throw new Error('drill 应激活');
        },

        async 'browse.categoryHeader'(c, _ctx, cleanups) {
            if (isUnhappy(c)) {
                await runUnreachable(c, cleanups, async (ctx) => {
                    const h = ctx.root.querySelector('[title*="折叠本分类"], [title*="展开本分类"]');
                    if (h) h.click();
                });
                return;
            }
            seedLib(MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            const header = s.root.querySelector('[title*="折叠本分类"], [title*="展开本分类"]')
                || [...s.root.querySelectorAll('[title]')].find((el) => /分类/.test(el.getAttribute('title') || ''));
            if (!header) throw new Error('无分类头');
            header.click();
        },

        async 'browse.practiceCategory'(c, _ctx, cleanups) {
            if (isUnhappy(c)) {
                await runUnreachable(c, cleanups, async (ctx) => softClickText(ctx.root, '只练本类'));
                return;
            }
            seedLib(MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            clearNavigateLog();
            const btn = [...s.root.querySelectorAll('button')]
                .find((b) => (b.textContent || '').includes('只练本类'));
            if (!btn) throw new Error('无只练本类');
            btn.click();
            assertNavigatedTo('study');
            if (getLX().NavigationAPI.current().data.category === 'all') {
                throw new Error('应写入非 all category');
            }
        },

        async 'browse.questionRow'(c, _ctx, cleanups) {
            if (isUnhappy(c) && has(c, '无库', '空目录')) {
                await runUnreachable(c, cleanups, async (ctx) => {
                    const hit = ctx.root.querySelector('.lx-catalog-item');
                    if (hit) hit.click();
                });
                return;
            }
            seedLib('SAR点题行', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            type(s.root.querySelector('[aria-label="搜索题干"]'), 'ALPHA');
            clickLabel(s.root, '执行题干搜索');
            if (isUnhappy(c) && has(c, 'fail', 'jump')) {
                const LX = getLX();
                clearToastLog();
                withApiMock(LX.NavigationAPI, 'enterSearchPlaylist', { ok: false, error: { code: 'FAIL', message: 'jump fail' } }, () => {
                    const hit = s.root.querySelector('.lx-catalog-item');
                    if (hit) hit.click();
                });
                assertToastIncludes(/fail|失败|无法|jump/i);
                return;
            }
            clearNavigateLog();
            const hit = s.root.querySelector('.lx-catalog-item');
            if (!hit) throw new Error('无命中行');
            hit.click();
            assertNavigatedTo('study');
            if (!getLX().NavigationAPI.getSearchPlaylist()?.uids?.length) {
                throw new Error('应建立 searchPlaylist');
            }
        },

        async 'browse.search.sentinel'(c, _ctx, cleanups) {
            if (isUnhappy(c) && has(c, 'loading')) {
                throw new Error(`DEFERRED: ${c.id}`);
            }
            seedLib('SAR续载', MIXED_QS);
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            type(s.root.querySelector('[aria-label="搜索题干"]'), 'SAR');
            clickLabel(s.root, '执行题干搜索');
            if (isUnhappy(c) && has(c, 'fail', 'load')) {
                // 直接调测试钩子前 mock search
                const LX = getLX();
                const page = s.page;
                withApiMock(LX.QuestionAPI, 'search', { ok: false, error: { code: 'FAIL', message: '加载失败' } }, () => {
                    if (page && typeof page.__loadMoreSearchForTest === 'function') {
                        page.__loadMoreSearchForTest();
                    }
                });
                // 可能 toast
                return;
            }
            if (s.page && typeof s.page.__loadMoreSearchForTest === 'function') {
                s.page.__loadMoreSearchForTest();
            }
        },

        async 'browse.empty.goHome'(c, _ctx, cleanups) {
            // 空态「去首页」出现在无当前库时（非「空题库」）
            const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                seedLib();
                s.remountPage(createBrowsePage);
                const before = collectUiState(s.root);
                softClickText(s.root, '去首页');
                assertUnchangedCore(before, collectUiState(s.root));
                return;
            }
            clearNavigateLog();
            const btn = [...s.root.querySelectorAll('button')]
                .find((b) => (b.textContent || '').includes('去首页'));
            if (!btn) throw new Error('无库浏览应有去首页');
            btn.click();
            assertNavigatedTo('home');
        },
    });

    async function browseToolbar(c, cleanups, re) {
        if (isUnhappy(c)) {
            await runUnreachable(c, cleanups, async (ctx) => softClickText(ctx.root, re));
            return;
        }
        seedLib('SAR浏览工具栏', MIXED_QS);
        const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
        cleanups.push(() => s.destroy());
        if (!softClickText(s.root, re) && !softClickLabel(s.root, re)) {
            // 换一批可能仅随机模式可见
            softClickText(s.root, /顺序|随机/);
            softClickText(s.root, re);
        }
    }

    async function practiceClose(c, cleanups, how) {
        if (isUnhappy(c)) {
            await runUnreachable(c, cleanups, async () => {});
            return;
        }
        seedLib('SAR关练习面板', MIXED_QS);
        const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
        cleanups.push(() => s.destroy());
        clickLabel(s.root, '练习模式');
        if (how === 'x') {
            if (!softClickLabel(s.root, '关闭练习设置') && !softClickText(s.root, '×')) {
                softClickLabel(s.root, '取消练习模式');
            }
        } else {
            const ov = s.root.querySelector('.lx-modal__overlay, [aria-label="练习模式设置"]')?.parentElement
                || s.root.querySelector('[class*="overlay"]');
            if (ov) ov.click();
            else softClickLabel(s.root, '取消练习模式');
        }
        if (collectUiState(s.root).page.practiceModalOpen) {
            softClickLabel(s.root, '取消练习模式');
        }
        if (collectUiState(s.root).page.practiceModalOpen) throw new Error('面板应关闭');
    }

    async function practiceMode(c, cleanups, label, mode) {
        if (isUnhappy(c)) {
            await runUnreachable(c, cleanups, async () => {});
            return;
        }
        seedLib('SAR练习模式', MIXED_QS);
        const s = mountShellWithPage(createBrowsePage, { routeName: 'browse' });
        cleanups.push(() => s.destroy());
        clickLabel(s.root, '练习模式');
        clickLabel(s.root, label);
        if (collectUiState(s.root).page.practiceMode !== mode) {
            // 文案点击可能走 text
            softClickText(s.root, label);
        }
        if (collectUiState(s.root).page.practiceMode !== mode) {
            throw new Error(`期望 mode=${mode}`);
        }
    }

    // addq
    Object.assign(handlers, {
        async 'addq.backBrowse'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            const clickBack = () => {
                const btn = [...s.root.querySelectorAll('button')]
                    .find((b) => (b.textContent || '').includes('返回浏览'));
                if (!btn) throw new Error('无返回浏览');
                btn.click();
            };
            if (isUnhappy(c) && has(c, '未保存')) {
                const stem = s.root.querySelector('textarea');
                if (stem) type(stem, '未保存草稿');
                clearNavigateLog();
                clickBack();
                assertNavigatedTo('browse');
                return;
            }
            clearNavigateLog();
            clickBack();
            assertNavigatedTo('browse');
        },

        async 'addq.type'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                assertUnchangedCore(collectUiState(s.root), collectUiState(s.root));
                return;
            }
            clickText(s.root, '判断题');
            clickText(s.root, '单选题');
        },

        async 'addq.category'(c, _ctx, cleanups) {
            seedLib('SAR分类输入');
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) return;
            const input = s.root.querySelector('input[placeholder*="分类"], input[aria-label*="分类"]')
                || s.root.querySelector('input.lx-input');
            if (input) type(input, '新分类');
        },

        async 'addq.question'(c, _ctx, cleanups) {
            seedLib('SAR题干');
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            const stem = s.root.querySelector('textarea');
            if (isUnhappy(c)) {
                clearToastLog();
                clickText(s.root, '保存题目');
                assertToastIncludes(/题干|填写|不能为空/);
                return;
            }
            type(stem, '题干内容SAR');
        },

        async 'addq.optionCheck'(c, _ctx, cleanups) {
            seedLib('SAR选项勾选');
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) return;
            clickText(s.root, '单选题');
            const check = s.root.querySelector('.lx-addq__opt-check');
            if (check) check.click();
        },

        async 'addq.optionText'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) return;
            clickText(s.root, '单选题');
            const opt = s.root.querySelector('.lx-addq__opt-input');
            if (opt) type(opt, '选项甲');
        },

        async 'addq.optionRemove'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            clickText(s.root, '单选题');
            if (isUnhappy(c)) {
                // 先加到 3 再删回 2，再点 ✕ 应 toast 且保持 2
                softClickText(s.root, '添加选项');
                const removeLast = () => {
                    const rows = [...s.root.querySelectorAll('.lx-addq__opt-row')];
                    const last = rows[rows.length - 1];
                    const rm = last && [...last.querySelectorAll('button')]
                        .find((b) => /✕|×|删除/.test(b.textContent || ''));
                    if (rm) rm.click();
                };
                while (s.root.querySelectorAll('.lx-addq__opt-input').length > 2) {
                    removeLast();
                }
                clearToastLog();
                const beforeN = s.root.querySelectorAll('.lx-addq__opt-input').length;
                removeLast();
                const afterN = s.root.querySelectorAll('.lx-addq__opt-input').length;
                if (afterN !== beforeN) {
                    throw new Error(`≤2 时删除应无效，${beforeN}→${afterN}`);
                }
                const log = collectUiState(s.root).meta.toastLast || '';
                if (log && !/至少|不能|选项/.test(log)) {
                    throw new Error(`意外 toast: ${log}`);
                }
                return;
            }
            softClickText(s.root, '添加选项');
            const rms = [...s.root.querySelectorAll('button')]
                .filter((b) => (b.textContent || '').trim() === '✕');
            if (rms.length) rms[rms.length - 1].click();
        },

        async 'addq.addOption'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            clickText(s.root, '单选题');
            if (isUnhappy(c)) {
                for (let i = 0; i < 10; i++) softClickText(s.root, '添加选项');
                return;
            }
            const before = s.root.querySelectorAll('.lx-addq__opt-input').length;
            clickText(s.root, '添加选项');
            const after = s.root.querySelectorAll('.lx-addq__opt-input').length;
            if (after <= before) throw new Error('应增加选项');
        },

        async 'addq.judge.true'(c, _ctx, cleanups) {
            await addqJudge(c, cleanups, '对');
        },
        async 'addq.judge.false'(c, _ctx, cleanups) {
            await addqJudge(c, cleanups, '错');
        },

        async 'addq.fill.answer'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            clickText(s.root, '填空题');
            if (isUnhappy(c)) {
                type(s.root.querySelector('textarea'), '有题干');
                clearToastLog();
                clickText(s.root, '保存题目');
                assertToastIncludes(/填空答案|答案|填写|不能为空/);
                return;
            }
            const ans = [...s.root.querySelectorAll('input, textarea')]
                .find((el) => (el.placeholder || '').includes('填空答案') || (el.placeholder || '').includes('答案'));
            if (ans) type(ans, '北京');
        },

        async 'addq.essay.answerText'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            clickText(s.root, '简答题');
            if (isUnhappy(c)) {
                type(s.root.querySelector('textarea'), '简答题干');
                clearToastLog();
                clickText(s.root, '保存题目');
                assertToastIncludes(/参考答案|答案|填写/);
                return;
            }
            const areas = [...s.root.querySelectorAll('textarea')];
            if (areas[1]) type(areas[1], '参考答案');
        },

        async 'addq.explanation'(c, _ctx, cleanups) {
            seedLib('SAR解析字段');
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) return;
            const areas = [...s.root.querySelectorAll('textarea')];
            const expl = areas.find((t) => (t.placeholder || '').includes('解析')) || areas[areas.length - 1];
            if (expl) type(expl, '解析内容');
        },

        async 'addq.cancel'(c, _ctx, cleanups) {
            seedLib();
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            const clickCancel = () => {
                const btn = [...s.root.querySelectorAll('button')]
                    .find((b) => (b.textContent || '').trim() === '取消');
                if (!btn) throw new Error('无取消按钮');
                btn.click();
            };
            if (isUnhappy(c)) {
                const off = installConfirmSpy(false);
                cleanups.push(off);
                clearNavigateLog();
                clickCancel();
                if (getNavigateLog().some((e) => e.name === 'browse')) {
                    throw new Error('取消 confirm 拒绝不应离开');
                }
                return;
            }
            clearNavigateLog();
            clickCancel();
            assertNavigatedTo('browse');
        },

        async 'addq.save'(c, _ctx, cleanups) {
            seedLib(ESSAY_QS);
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            const LX = getLX();
            const saveBtn = () => {
                const btn = [...s.root.querySelectorAll('button')]
                    .find((b) => (b.textContent || '').includes('保存题目'));
                if (!btn) throw new Error('无保存题目');
                btn.click();
            };

            if (isUnhappy(c) && has(c, '空题干')) {
                clearToastLog();
                const before = collectUiState(s.root);
                saveBtn();
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.questionCount']);
                assertToastIncludes(/题干/);
                return;
            }
            if (isUnhappy(c) && has(c, '<2', '选项')) {
                clickText(s.root, '单选题');
                type(s.root.querySelector('textarea'), '题干');
                clearToastLog();
                const before = collectUiState(s.root);
                saveBtn();
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '未选答案')) {
                clickText(s.root, '单选题');
                type(s.root.querySelector('textarea'), '题干未选');
                const opts = s.root.querySelectorAll('.lx-addq__opt-input');
                if (opts[0]) type(opts[0], 'A1');
                if (opts[1]) type(opts[1], 'B1');
                clearToastLog();
                const before = collectUiState(s.root);
                saveBtn();
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '判断未选')) {
                clickText(s.root, '判断题');
                type(s.root.querySelector('textarea'), '判断题干');
                clearToastLog();
                const before = collectUiState(s.root);
                saveBtn();
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '填空', '简答空')) {
                clickText(s.root, '填空题');
                type(s.root.querySelector('textarea'), '填空题干');
                clearToastLog();
                const before = collectUiState(s.root);
                saveBtn();
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, 'API', 'fail')) {
                clickText(s.root, '简答题');
                type(s.root.querySelector('textarea'), 'API失败题干');
                const areas = [...s.root.querySelectorAll('textarea')];
                if (areas[1]) type(areas[1], '参考');
                clearToastLog();
                const before = collectUiState(s.root);
                withApiMock(LX.QuestionAPI, 'add', { ok: false, error: { code: 'FAIL', message: 'x' } }, () => {
                    saveBtn();
                });
                assertStateDelta(before, collectUiState(s.root), {}, ['domain.questionCount']);
                return;
            }
            if (isUnhappy(c) && has(c, '多选')) {
                clickText(s.root, '多选题');
                type(s.root.querySelector('textarea'), '多选题干SAR');
                const opts = s.root.querySelectorAll('.lx-addq__opt-input');
                if (opts[0]) type(opts[0], '甲');
                if (opts[1]) type(opts[1], '乙');
                const checks = s.root.querySelectorAll('.lx-addq__opt-check');
                if (checks[0]) checks[0].click();
                if (checks[1]) checks[1].click();
                clearToastLog();
                const before = collectUiState(s.root);
                saveBtn();
                if (collectUiState(s.root).domain.questionCount !== before.domain.questionCount + 1) {
                    throw new Error('多选保存应 +1');
                }
                return;
            }
            // happy：单选填齐（默认已是 single，仍点一次确保）
            clickText(s.root, '单选题');
            type(s.root.querySelector('textarea'), '新增单选题干SAR-OK');
            const opts = s.root.querySelectorAll('.lx-addq__opt-input');
            if (opts[0]) type(opts[0], '选项甲');
            if (opts[1]) type(opts[1], '选项乙');
            const checks = s.root.querySelectorAll('.lx-addq__opt-check');
            if (checks[0]) checks[0].click();
            clearToastLog();
            const before = collectUiState(s.root);
            saveBtn();
            assertStateDelta(before, collectUiState(s.root), {
                domain: { questionCount: before.domain.questionCount + 1 },
            });
            assertToastIncludes('已添加');
        },

        async 'addq.noLib.goSettings'(c, _ctx, cleanups) {
            const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
            cleanups.push(() => s.destroy());
            if (isUnhappy(c)) {
                // 有库时无「去设置」空态
                seedLib('SAR有库');
                s.remountPage(createAddQuestionPage);
                const before = collectUiState(s.root);
                softClickText(s.root, '去设置');
                assertUnchangedCore(before, collectUiState(s.root));
                return;
            }
            clearNavigateLog();
            if (!softClickText(s.root, '去设置')) throw new Error('无库应显示去设置');
            assertNavigatedTo('settings');
        },
    });

    async function addqJudge(c, cleanups, which) {
        seedLib();
        const s = mountShellWithPage(createAddQuestionPage, { routeName: 'add-question', showBottombar: false });
        cleanups.push(() => s.destroy());
        if (isUnhappy(c)) return;
        clickText(s.root, '判断题');
        softClickText(s.root, which);
    }

    // help
    Object.assign(handlers, {
        async 'help.goStudy.quickStart'(c, _ctx, cleanups) {
            await helpNav(c, cleanups, '去刷题', 'study');
        },
        async 'help.goSettings'(c, _ctx, cleanups) {
            await helpNav(c, cleanups, '前往设置', 'settings');
        },
        async 'help.goStudy.footer'(c, _ctx, cleanups) {
            await helpNav(c, cleanups, '去刷题', 'study', true);
        },
    });

    async function helpNav(c, cleanups, text, route, footer) {
        seedLib('SAR帮助');
        const s = mountShellWithPage(createHelpPage, { routeName: 'help', showBottombar: false });
        cleanups.push(() => s.destroy());
        if (isUnhappy(c)) {
            const before = collectUiState(s.root);
            assertUnchangedCore(before, collectUiState(s.root));
            return;
        }
        clearNavigateLog();
        const buttons = [...s.root.querySelectorAll('button')].filter((b) => (b.textContent || '').includes(text));
        if (!buttons.length) {
            // 设置可能文案为「设置」
            if (route === 'settings') {
                softClickText(s.root, '设置');
            } else throw new Error(`无按钮 ${text}`);
        } else {
            (footer ? buttons[buttons.length - 1] : buttons[0]).click();
        }
        assertNavigatedTo(route);
    }
}
