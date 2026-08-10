/**
 * 浏览页搜索跳转契约
 * 点搜索命中：按当前关键词 + 分类/状态范围拉全量命中，进入 searchPlaylist，再 goto。
 * 不清除「只练本类」等导航筛选——playlist 优先；退出搜索后仍回到原分类上下文。
 * @module render/contracts/catalog-search
 */

/**
 * @param {object} LX
 * @param {string|number} uid
 * @param {{ keywords?: string[], category?: string, status?: string }} [opts]
 * @returns {{ ok: true, data: { index: number; clearedFilters: boolean; playlistTotal: number; scopedCategory: string|null } } | { ok: false, error: { code: string, message: string } }}
 */
export function jumpToQuestionFromSearch(LX, uid, opts = {}) {
    const target = String(uid);
    const keywords = Array.isArray(opts.keywords)
        ? opts.keywords.map((k) => String(k || '').trim()).filter(Boolean)
        : [];

    if (!keywords.length) {
        return {
            ok: false,
            error: { code: 'INVALID_INPUT', message: '缺少搜索条件' },
        };
    }

    const category = opts.category != null
        ? opts.category
        : (LX.NavigationAPI.getCategory() || 'all');
    const status = opts.status != null
        ? opts.status
        : (LX.NavigationAPI.getStatusFilter() || 'all');

    /** @type {{ keywords: string[], limit: number, offset: number, category?: string, status?: string }} */
    const base = { keywords, limit: 1, offset: 0 };
    if (category && category !== 'all') base.category = category;
    if (status && status !== 'all') base.status = status;

    // 先取 total，再一次拉全量命中（避免只进已续载的一页）
    const probe = LX.QuestionAPI.search('', base);
    if (!probe.ok) return probe;
    const total = probe.data.total || 0;
    if (total < 1) {
        return {
            ok: false,
            error: { code: 'NOT_FOUND', message: '当前搜索无命中' },
        };
    }
    const full = LX.QuestionAPI.search('', { ...base, limit: total, offset: 0 });
    if (!full.ok) return full;
    const uids = (full.data.questions || []).map((q) => (q.uid != null ? q.uid : q.id));
    if (!uids.length) {
        return {
            ok: false,
            error: { code: 'NOT_FOUND', message: '当前搜索无命中' },
        };
    }

    const idx = uids.findIndex((id) => String(id) === target);
    if (idx < 0) {
        return {
            ok: false,
            error: { code: 'NOT_FOUND', message: '当前搜索结果中找不到该题' },
        };
    }

    const enter = LX.NavigationAPI.enterSearchPlaylist({
        keywords,
        uids,
        category: base.category || null,
        status: base.status || null,
    });
    if (!enter.ok) return enter;

    const gotoR = LX.NavigationAPI.goto(idx);
    if (!gotoR.ok) return gotoR;
    return {
        ok: true,
        data: {
            index: gotoR.data.index,
            // 不再为跳转清分类；保留「只练本类」上下文
            clearedFilters: false,
            playlistTotal: uids.length,
            scopedCategory: base.category || null,
        },
    };
}
