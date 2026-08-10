// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E 仅作主路径烟雾；日常开发仍以 test.html 为准。
 * 运行时 app 不依赖本配置 / node_modules。
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? 'github' : 'list',
    timeout: 30_000,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'python3 tools/dev-server.py 4173',
        url: 'http://127.0.0.1:4173/app.html',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
