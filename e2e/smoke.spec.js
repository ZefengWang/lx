import { test, expect } from '@playwright/test';
import { waitForLX, seedMinimalLibrary, goHash } from './helpers.js';

/**
 * Playwright 薄烟雾：只锁「能打开 / 能进 study·browse / SW·manifest」。
 * 禁止在此重做 UI SAR 矩阵（全量见 test/system/ui-sar-matrix + #lxSarAppIframe）。
 */
test.describe('app.html 主路径烟雾', () => {
    test('打开应用并挂载 LX', async ({ page }) => {
        await page.goto('/app.html');
        await waitForLX(page);
        await expect(page.locator('#app')).not.toBeEmpty();
        const version = await page.evaluate(() => window.LX.version);
        expect(version).toBeTruthy();
    });

    test('种子题库后进入刷题页可见题干', async ({ page }) => {
        await page.goto('/app.html');
        await waitForLX(page);
        const qText = 'E2E 烟雾题：刷题页可见';
        await seedMinimalLibrary(page, { question: qText });
        await goHash(page, '#/study');
        await expect(page.getByText(qText)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('.lx-bottombar')).toBeVisible();
    });

    test('浏览页可见题库与搜索入口', async ({ page }) => {
        await page.goto('/app.html');
        await waitForLX(page);
        await seedMinimalLibrary(page, { name: 'e2e-browse-lib', question: 'E2E 浏览页题目' });
        await goHash(page, '#/browse');
        await expect(page.getByText('e2e-browse-lib')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('input.lx-input').first()).toBeVisible();
    });

    test('manifest 可访问且 app 注册了 SW 脚本', async ({ page }) => {
        const manifest = await page.request.get('/manifest.json');
        expect(manifest.ok()).toBeTruthy();
        const body = await manifest.json();
        expect(body.name).toBe('刷题器');
        expect(body.start_url).toContain('app.html');

        await page.goto('/app.html');
        await waitForLX(page);
        // 注册脚本在 load 后；允许短暂等待
        await page.waitForFunction(
            () => navigator.serviceWorker && navigator.serviceWorker.getRegistration,
            null,
            { timeout: 5_000 }
        );
        const hasControllerOrReg = await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration('./');
            return !!(reg || navigator.serviceWorker.controller);
        });
        // 首次访问可能尚无 controller，但 registration 应存在
        expect(hasControllerOrReg).toBeTruthy();
    });
});
