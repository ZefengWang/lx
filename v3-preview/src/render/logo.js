/**
 * logo.js — 刷题器应用图标
 * 紫底圆 + 白色打开的书 + 右下角绿色对勾
 *   - 紫 #4f46e5：与 theme-color 一致，主品牌色
 *   - 书：学习/题库
 *   - 对勾：刷题答对的瞬时语义
 *
 * 复用位置：favicon / 顶栏 / 首页欢迎卡 / 抽屉顶部
 *
 * @module render/logo
 */

/**
 * SVG 源码字符串
 *   - viewBox 64×64，矢量任意缩放不糊
 *   - 自闭合，无外部依赖
 */
export const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="刷题器">
  <!-- 紫色圆底 -->
  <circle cx="32" cy="32" r="32" fill="#4f46e5"/>

  <!-- 打开的书：左右两页（梯形）+ 中缝 -->
  <g fill="#ffffff">
    <!-- 左页 -->
    <path d="M30 18 L13 22 L13 46 L30 42 Z"/>
    <!-- 右页 -->
    <path d="M34 18 L51 22 L51 46 L34 42 Z"/>
    <!-- 书脊厚度（顶部 + 底部） -->
    <rect x="30" y="17" width="4" height="2" fill="#ffffff"/>
    <rect x="30" y="41" width="4" height="2" fill="#ffffff"/>
  </g>

  <!-- 书页文字线（淡紫色，示意印刷内容） -->
  <g stroke="#4f46e5" stroke-width="1" opacity="0.35" stroke-linecap="round" fill="none">
    <line x1="18" y1="27" x2="26" y2="25"/>
    <line x1="18" y1="31" x2="26" y2="29"/>
    <line x1="18" y1="35" x2="24" y2="33"/>
    <line x1="38" y1="25" x2="46" y2="27"/>
    <line x1="38" y1="29" x2="46" y2="31"/>
    <line x1="38" y1="33" x2="44" y2="35"/>
  </g>

  <!-- 右下角对勾圆 -->
  <circle cx="46" cy="46" r="11" fill="#22c55e"/>
  <path d="M40.5 46 L44.5 50 L51.5 42.5" fill="none" stroke="#ffffff"
        stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`.trim();

/**
 * favicon data URI（URL 编码，避免特殊字符转义问题）
 *   - 直接放进 <link rel="icon" href="...">
 *   - 浏览器标签页 / 收藏夹 / PWA 安装都用这个
 */
export const LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

/**
 * 创建一个 logo DOM 节点（包装 div + 内嵌 SVG）
 * @param {object} [opts]
 * @param {number} [opts.size=32] 像素尺寸
 * @param {string} [opts.className] 额外 class
 * @param {string} [opts.label] aria-label（默认「刷题器」）
 * @returns {HTMLDivElement}
 */
export function createLogo({ size = 32, className = '', label = '刷题器' } = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = `lx-logo${className ? ` ${className}` : ''}`;
    wrapper.style.cssText = `width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;`;
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', label);
    wrapper.innerHTML = LOGO_SVG;
    // 把 SVG 的 width/height 同步成目标尺寸
    const svg = wrapper.querySelector('svg');
    if (svg) {
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.removeAttribute('aria-label'); // wrapper 已有
    }
    return wrapper;
}
