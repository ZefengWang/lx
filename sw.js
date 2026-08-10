/**
 * 刷题器 Service Worker（最小可用）
 * - 同源壳资源：cache-first（预缓存失败不阻断安装）
 * - CDN（SheetJS / pdf.js）：network-first，失败回退缓存
 * - 题库数据仍在 localStorage，SW 不替代存储
 */
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `lx-static-${CACHE_VERSION}`;
const CDN_CACHE = `lx-cdn-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    './',
    './index.html',
    './app.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './src/render/assets/logo.svg',
    './src/render/theme.css',
    './src/render/components.css',
    './src/main.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(async (cache) => {
            await Promise.all(
                STATIC_ASSETS.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[lx-sw] precache skip', url, err);
                    })
                )
            );
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== STATIC_CACHE && k !== CDN_CACHE)
                    .map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

function isCdn(url) {
    return (
        url.hostname.includes('cdn.sheetjs.com') ||
        url.hostname.includes('cdnjs.cloudflare.com')
    );
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    if (url.origin === self.location.origin) {
        // 测试台 / 工具链：始终走网络，避免 SW 缓存挡住新测例
        const path = url.pathname || '';
        if (
            path.endsWith('/test.html') ||
            path.includes('/test/') ||
            path.includes('/tools/') ||
            path.includes('/e2e/')
        ) {
            event.respondWith(fetch(req));
            return;
        }
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) return cached;
                return fetch(req).then((resp) => {
                    if (resp && resp.ok && resp.type === 'basic') {
                        const clone = resp.clone();
                        caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
                    }
                    return resp;
                }).catch(() => caches.match('./app.html'));
            })
        );
        return;
    }

    if (isCdn(url)) {
        event.respondWith(
            fetch(req)
                .then((resp) => {
                    if (resp && resp.ok) {
                        const clone = resp.clone();
                        caches.open(CDN_CACHE).then((c) => c.put(req, clone));
                    }
                    return resp;
                })
                .catch(() => caches.match(req))
        );
    }
});
