/**
 * Playwright 烟雾辅助：等 LX 就绪并用 LibraryAPI 种一库。
 * @param {import('@playwright/test').Page} page
 */
export async function waitForLX(page) {
    await page.waitForFunction(() => window.LX && window.LX.LibraryAPI, null, {
        timeout: 15_000,
    });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ name?: string, question?: string }} [opts]
 */
export async function seedMinimalLibrary(page, opts = {}) {
    const name = opts.name || 'e2e-smoke';
    const question = opts.question || 'E2E 烟雾题：1+1=?';
    return page.evaluate(({ name: libName, qText }) => {
        const LX = window.LX;
        // 清库避免脏数据干扰（E2E 专用上下文）
        const listed = LX.LibraryAPI.list();
        if (listed.ok && Array.isArray(listed.data)) {
            for (const lib of listed.data) {
                LX.LibraryAPI.delete(lib.id);
            }
        }
        const created = LX.LibraryAPI.create(
            libName,
            [
                {
                    type: 'single',
                    category: 'E2E',
                    question: qText,
                    options: ['1', '2', '3', '4'],
                    answer: 'B',
                    explanation: '1+1=2',
                },
            ],
            { skipDuplicateCheck: true }
        );
        if (!created.ok) throw new Error('create failed: ' + JSON.stringify(created));
        const sw = LX.LibraryAPI.switch(created.data.id);
        if (!sw.ok) throw new Error('switch failed: ' + JSON.stringify(sw));
        return created.data.id;
    }, { name, qText: question });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} hash 如 '#/study'
 */
export async function goHash(page, hash) {
    await page.evaluate((h) => {
        location.hash = h;
    }, hash);
    await page.waitForFunction((h) => location.hash === h || location.hash.startsWith(h), hash);
}
